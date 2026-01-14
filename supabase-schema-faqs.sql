-- Supabase Database Schema for FAQs System
-- 
-- Run this SQL in your Supabase SQL Editor to create the FAQs table
-- 
-- Table:
-- 1. faqs - Stores frequently asked questions and answers

-- Create faqs table
CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General' CHECK (category IN ('General', 'Transactions', 'Chains', 'Lending', 'Staking', 'Liquidity', 'NFTs', 'Referrals', 'Security', 'Troubleshooting')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faqs
CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category);
CREATE INDEX IF NOT EXISTS idx_faqs_created_at ON faqs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_faqs_category_created ON faqs(category, created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_faqs_updated_at
  BEFORE UPDATE ON faqs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


