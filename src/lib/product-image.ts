// ---------------------------------------------------------------------------
// Supplier images, at a sane size.
//
// The suppliers serve originals: CJ's are ~1.7 MB PNGs, so a 24-product grid was
// a 40 MB page and simply never rendered. Optimising them on our own box didn't
// work either — a 1.9 GB server can't resize two dozen of those per request.
//
// Both CDNs will resize on request, which makes the whole problem someone
// else's: CJ 1.7 MB -> 78 KB, Shopify 57 KB -> 22 KB, no work at our end.
// ---------------------------------------------------------------------------

/** Ask the supplier's CDN for a width-constrained version where it supports one. */
export function productImage(url: string | null | undefined, width = 400): string | null {
  if (!url) return null;

  try {
    const u = new URL(url);

    // Alibaba OSS (CJ Dropshipping) — the big win.
    if (u.hostname.includes("cjdropshipping.com")) {
      u.searchParams.set("x-oss-process", `image/resize,w_${width}`);
      return u.toString();
    }

    // Shopify CDN takes a plain width parameter.
    if (u.hostname.includes("cdn.shopify.com")) {
      u.searchParams.set("width", String(width));
      return u.toString();
    }

    return url;
  } catch {
    return url;
  }
}
