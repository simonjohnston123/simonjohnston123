-- "Only show products we can actually send to this customer" is the core query
-- of a worldwide storefront, and it runs on every page view. Without an index
-- it table-scans the whole catalogue (84k rows today, far more once the China
-- warehouse lands).
--
-- GIN over the jsonb array makes `"shipCountries" @> '["US"]'` an index lookup.
CREATE INDEX IF NOT EXISTS "Product_shipCountries_gin_idx" ON "Product" USING GIN ("shipCountries");

-- CJ returns a pseudo-code "CN_US" (China warehouse, US-bound) which is not a
-- country. Left as-is those products never match a customer in the US, so
-- 6,259 items were silently unsellable. Normalise it to US.
UPDATE "Product"
SET "shipCountries" = (
  SELECT coalesce(jsonb_agg(DISTINCT CASE WHEN c = 'CN_US' THEN 'US' ELSE c END), '[]'::jsonb)
  FROM jsonb_array_elements_text("shipCountries") AS c
)
WHERE "shipCountries" @> '["CN_US"]'::jsonb;
