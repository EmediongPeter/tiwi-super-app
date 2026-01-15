-- Migration: Remove display_order column from tutorials table
-- 
-- Run this SQL in your Supabase SQL Editor if you already have the tutorials table
-- with the display_order column and want to remove it.

-- Drop indexes that reference display_order
DROP INDEX IF EXISTS idx_tutorials_display_order;
DROP INDEX IF EXISTS idx_tutorials_category_order;

-- Remove display_order column from tutorials table
ALTER TABLE tutorials DROP COLUMN IF EXISTS display_order;

