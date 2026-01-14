-- Supabase Database Schema for Tutorials System
-- 
-- Run this SQL in your Supabase SQL Editor to create the tutorials table
-- 
-- Table:
-- 1. tutorials - Stores tutorial information and links

-- Create tutorials table
CREATE TABLE IF NOT EXISTS tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Trading' CHECK (category IN ('Trading', 'Liquidity', 'Staking', 'NFTs', 'Social', 'Security', 'Getting Started', 'Advanced')),
  link TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for tutorials
CREATE INDEX IF NOT EXISTS idx_tutorials_category ON tutorials(category);
CREATE INDEX IF NOT EXISTS idx_tutorials_created_at ON tutorials(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tutorials_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tutorials_updated_at
  BEFORE UPDATE ON tutorials
  FOR EACH ROW
  EXECUTE FUNCTION update_tutorials_updated_at_column();

