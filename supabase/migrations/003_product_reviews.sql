-- 003: product reviews
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_read ON product_reviews FOR SELECT USING (true);
CREATE POLICY reviews_write ON product_reviews FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Update rating aggregates in one place (average + count via view)
CREATE OR REPLACE VIEW product_ratings AS
SELECT product_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*) AS review_count
FROM product_reviews GROUP BY product_id;