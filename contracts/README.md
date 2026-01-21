# TIWI Staking Pool Contracts

## Contract Overview

**TiwiStakingPool.sol** - Main staking contract implementing TIWI Protocol reward equations.

### Key Features

- ✅ Time-based reward distribution
- ✅ Admin-configurable rewards (maxTvl, poolReward, duration)
- ✅ Automatic reward per second calculation
- ✅ User staking/unstaking
- ✅ Reward claiming
- ✅ Max TVL enforcement
- ✅ Safe reward transfer (handles insufficient balance)

## Contract Functions

### User Functions
- `deposit(uint256 amount)` - Stake tokens
- `withdraw(uint256 amount)` - Unstake tokens
- `claim()` - Claim pending rewards
- `pendingReward(address user)` - View pending rewards

### Admin Functions (Owner Only)
- `setRewardConfig(uint256 poolReward, uint256 durationSeconds, uint256 maxTvl)` - Configure rewards
- `fundRewards()` - Fund pool with reward tokens
- `emergencyWithdrawRewards(address to)` - Emergency withdraw (testing only)

## Deployment

See `../DEPLOYMENT_GUIDE.md` for full deployment instructions.

Quick deploy:
```bash
pnpm run deploy:mainnet
```

## Contract Address

After deployment, add the contract address to your staking pool in the admin panel.
