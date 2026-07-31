import React from "react";

// Turn bare URLs in plain text into clickable links, without dangerouslySetInnerHTML
// (so email content can't inject markup). Only http(s) URLs are linkified.
const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"])/g;
const isUrl = (s: string) => /^https?:\/\//.test(s);

export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        isUrl(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all text-brand-600 underline hover:text-brand-700"
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}
