-- Supabase Database Schema for User Wallets
--
-- Run this SQL in your Supabase SQL Editor to create the user_wallets table.
-- This table tracks wallets seen/created through the TIWI platform by address only
-- (no private keys or seed phrases are ever stored).
--
-- Table: user_wallets
--  - id: UUID primary key
--  - wallet_address: on-chain address (EVM or Solana)
--  - source: how this wallet was first seen/registered
--            ('local', 'metamask', 'walletconnect', 'coinbase', 'rabby', 'phantom', 'other')
--  - created_at: timestamp
--
-- Security:
--  - This table intentionally stores ONLY public addresses and metadata.
--  - Do NOT add columns for mnemonics, private keys, or any secrets.

CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN (
    'local',
    'metamask',
    'walletconnect',
    'coinbase',
    'rabby',
    'phantom',
    'other'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate registrations for the same address+source
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_wallets_unique
  ON user_wallets (wallet_address, source);

-- Helpful indexes for analytics
CREATE INDEX IF NOT EXISTS idx_user_wallets_address
  ON user_wallets (wallet_address);

CREATE INDEX IF NOT EXISTS idx_user_wallets_source
  ON user_wallets (source);

CREATE INDEX IF NOT EXISTS idx_user_wallets_created_at
  ON user_wallets (created_at DESC);


