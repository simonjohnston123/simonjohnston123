#!/usr/bin/env python3
"""
Mailcow -> Placid Connect CRM inbound bridge.

Polls an IMAP mailbox for unread mail and posts each message to the CRM's
inbound endpoint, which files it into the right business's Conversations as an
INBOUND message. Uses only the Python 3 standard library (imaplib + email) so
MIME parsing is rock-solid and there's nothing to pip install.

Run it from cron every minute, or with --loop as a long-running service.

Environment:
  IMAP_HOST         mail host (e.g. mail.placidconnect.com)
  IMAP_PORT         default 993 (IMAP over SSL)
  IMAP_USER         mailbox login (e.g. admin@placidconnect.com)
  IMAP_PASS         mailbox password / app password
  IMAP_FOLDER       default "INBOX"
  CRM_INBOUND_URL   https://placidcrm.com/api/inbound/email
  INBOUND_TOKEN     shared secret; sent as ?token= (must match the CRM's env)
  MARK_SEEN         "1" (default) to flag processed mail \\Seen so it isn't re-sent

Cron example (every minute):
  * * * * * /usr/bin/env IMAP_HOST=... IMAP_USER=... IMAP_PASS=... \\
    CRM_INBOUND_URL=https://placidcrm.com/api/inbound/email INBOUND_TOKEN=... \\
    python3 /opt/placidcrm/scripts/mailcow_inbox_bridge.py >> /var/log/inbox_bridge.log 2>&1
"""
import email
import imaplib
import json
import os
import sys
import time
import urllib.request
from email.header import decode_header, make_header


def env(name, default=None, required=False):
    v = os.environ.get(name, default)
    if required and not v:
        sys.exit(f"Missing required env var: {name}")
    return v


def header_text(msg, name):
    raw = msg.get(name, "")
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return raw


def body_text(msg):
    """Prefer text/plain; fall back to a crude strip of text/html."""
    plain, html = None, None
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if part.get("Content-Disposition", "").startswith("attachment"):
                continue
            if ctype == "text/plain" and plain is None:
                plain = decode_part(part)
            elif ctype == "text/html" and html is None:
                html = decode_part(part)
    else:
        if msg.get_content_type() == "text/html":
            html = decode_part(msg)
        else:
            plain = decode_part(msg)
    text = plain if plain else strip_html(html or "")
    return (text or "").strip()[:20000]


def decode_part(part):
    try:
        payload = part.get_payload(decode=True) or b""
        charset = part.get_content_charset() or "utf-8"
        return payload.decode(charset, errors="replace")
    except Exception:
        return ""


def strip_html(html):
    import re
    html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.I)
    html = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", html).strip()


def post_to_crm(url, token, payload):
    data = json.dumps(payload).encode("utf-8")
    full = f"{url}?token={token}" if token else url
    req = urllib.request.Request(full, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.status, resp.read().decode("utf-8", "replace")


def run_once():
    host = env("IMAP_HOST", required=True)
    port = int(env("IMAP_PORT", "993"))
    user = env("IMAP_USER", required=True)
    password = env("IMAP_PASS", required=True)
    folder = env("IMAP_FOLDER", "INBOX")
    url = env("CRM_INBOUND_URL", "https://placidcrm.com/api/inbound/email")
    token = env("INBOUND_TOKEN", "")
    mark_seen = env("MARK_SEEN", "1") == "1"

    imap = imaplib.IMAP4_SSL(host, port)
    imap.login(user, password)
    imap.select(folder)
    typ, data = imap.search(None, "UNSEEN")
    ids = data[0].split() if data and data[0] else []
    print(f"[bridge] {len(ids)} new message(s) in {folder}")

    for num in ids:
        typ, raw = imap.fetch(num, "(RFC822)")
        if typ != "OK" or not raw or not raw[0]:
            continue
        msg = email.message_from_bytes(raw[0][1])
        payload = {
            "from": header_text(msg, "From"),
            "to": header_text(msg, "To"),
            "subject": header_text(msg, "Subject"),
            "text": body_text(msg),
        }
        try:
            status, resp = post_to_crm(url, token, payload)
            ok = 200 <= status < 300
            print(f"[bridge] -> CRM {status} for {payload['from']!r}: {resp[:120]}")
            if ok and mark_seen:
                imap.store(num, "+FLAGS", "\\Seen")
        except Exception as e:
            print(f"[bridge] POST failed for {payload['from']!r}: {e}")

    imap.close()
    imap.logout()


def main():
    loop = "--loop" in sys.argv
    interval = int(env("POLL_SECONDS", "30"))
    while True:
        try:
            run_once()
        except Exception as e:
            print(f"[bridge] error: {e}")
        if not loop:
            break
        time.sleep(interval)


if __name__ == "__main__":
    main()
