-- CJ quotes in USD but the catalogue prices in AUD, and the first import stored
-- CJ's figures unconverted. That understated cost by ~43%: a 1.7x markup on a
-- USD cost leaves roughly 3% margin once eBay's ~13% fee lands, i.e. selling at
-- break-even without knowing it.
--
-- Restate the already-imported CJ rows at the rate observed on 2026-08-03
-- (USD/AUD 1.4288, agreed by two independent sources). Future imports convert
-- at a live rate via src/lib/fx.ts.
--
-- Guarded by source = 'CJ Dropshipping' so Dropshipzone rows — which are
-- already AUD — are never touched.

UPDATE "Product"
SET "costCents"  = ROUND("costCents" * 1.4288),
    "priceCents" = ROUND("costCents" * 1.4288 * 1.7)
WHERE source = 'CJ Dropshipping'
  AND "costCents" IS NOT NULL;
