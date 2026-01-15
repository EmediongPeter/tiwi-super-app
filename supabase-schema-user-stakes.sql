-- ============================================================================
-- User Stakes System
-- ============================================================================
-- This table tracks user stakes in staking pools

-- Create user_stakes table to store user staking positions
CREATE TABLE IF NOT EXISTS user_stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  pool_id UUID NOT NULL REFERENCES staking_pools(id) ON DELETE CASCADE,
  staked_amount NUMERIC(38, 8) NOT NULL,
  rewards_earned NUMERIC(38, 8) NOT NULL DEFAULT 0,
  lock_period_days INTEGER, -- Lock period in days
  lock_end_date TIMESTAMPTZ, -- When the lock period ends
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
  transaction_hash TEXT, -- Blockchain transaction hash for the stake
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for user_stakes
CREATE INDEX IF NOT EXISTS idx_user_stakes_wallet ON user_stakes(user_wallet);
CREATE INDEX IF NOT EXISTS idx_user_stakes_pool ON user_stakes(pool_id);
CREATE INDEX IF NOT EXISTS idx_user_stakes_status ON user_stakes(status);
CREATE INDEX IF NOT EXISTS idx_user_stakes_wallet_status ON user_stakes(user_wallet, status);
CREATE INDEX IF NOT EXISTS idx_user_stakes_created_at ON user_stakes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_stakes_lock_end_date ON user_stakes(lock_end_date);

-- Create index for active stakes (most common query)
CREATE INDEX IF NOT EXISTS idx_user_stakes_active ON user_stakes(user_wallet, status) WHERE status = 'active';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_stakes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_user_stakes_updated_at
  BEFORE UPDATE ON user_stakes
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stakes_updated_at();

