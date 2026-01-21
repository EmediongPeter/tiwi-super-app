// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TiwiStakingPoolFactory
 * @notice Factory contract that manages multiple staking pools for different tokens
 * 
 * Architecture:
 * - ONE contract deployed once per chain
 * - Admin creates pools via createPool() - NO deployment needed
 * - Each pool supports different staking/reward token pairs
 * - Users stake on specific pools identified by poolId
 * 
 * Benefits:
 * - No need to deploy new contracts for each token
 * - Admin creates pools instantly from frontend
 * - All pools managed in one place
 * - Lower gas costs (no deployment per pool)
 */

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract TiwiStakingPoolFactory {
    address public owner;
    uint256 public poolCount;
    
    // Authorized admins who can create pools
    mapping(address => bool) public authorizedAdmins;
    
    // Pool configuration
    struct PoolConfig {
        uint256 poolId;                    // Unique pool ID
        address stakingToken;              // Token users stake
        address rewardToken;               // Token for rewards
        address poolOwner;                 // Owner/Admin of this specific pool (who created it)
        uint256 poolReward;                // Total reward tokens
        uint256 rewardDurationSeconds;     // Reward duration
        uint256 maxTvl;                    // Maximum TVL
        uint256 rewardPerSecond;           // Rewards per second
        uint256 startTime;                 // Pool start time
        uint256 endTime;                   // Pool end time
        bool active;                       // Pool active status
        uint256 createdAt;                 // Creation timestamp
    }
    
    // Pool state
    struct PoolState {
        uint256 totalStaked;               // Total staked tokens
        uint256 accRewardPerShare;         // Accumulated rewards per share
        uint256 lastRewardTime;            // Last reward update time
    }
    
    // User info per pool
    struct UserInfo {
        uint256 amount;                    // Staked amount
        uint256 rewardDebt;                // Reward debt
        uint256 stakeTime;                 // First stake time
    }
    
    // Pool data: poolId => PoolConfig
    mapping(uint256 => PoolConfig) public pools;
    
    // Pool state: poolId => PoolState
    mapping(uint256 => PoolState) public poolState;
    
    // User info: poolId => user => UserInfo
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    
    // Track which pools exist
    uint256[] public activePoolIds;
    mapping(uint256 => bool) public poolExists;
    
    // Track pools by token pair (for easy lookup)
    mapping(address => mapping(address => uint256[])) public poolsByTokenPair;
    
    uint256 public constant ACC_PRECISION = 1e12;
    
    // Events
    event PoolCreated(
        uint256 indexed poolId,
        address indexed stakingToken,
        address indexed rewardToken,
        uint256 poolReward,
        uint256 rewardDurationSeconds,
        uint256 maxTvl
    );
    
    event PoolConfigured(
        uint256 indexed poolId,
        uint256 poolReward,
        uint256 rewardDurationSeconds,
        uint256 maxTvl
    );
    
    event Deposit(
        uint256 indexed poolId,
        address indexed user,
        uint256 amount
    );
    
    event Withdraw(
        uint256 indexed poolId,
        address indexed user,
        uint256 amount
    );
    
    event Claim(
        uint256 indexed poolId,
        address indexed user,
        uint256 amount
    );
    
    event FundRewards(
        uint256 indexed poolId,
        address indexed funder,
        uint256 amount
    );
    
    event AdminAuthorized(address indexed admin);
    event AdminRevoked(address indexed admin);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }
    
    modifier onlyAuthorizedAdmin() {
        require(msg.sender == owner || authorizedAdmins[msg.sender], "NOT_AUTHORIZED");
        _;
    }
    
    modifier onlyPoolOwnerOrFactoryOwner(uint256 _poolId) {
        require(poolExists[_poolId], "POOL_NOT_EXISTS");
        require(
            msg.sender == owner || msg.sender == pools[_poolId].poolOwner,
            "NOT_POOL_OWNER"
        );
        _;
    }
    
    modifier poolExistsCheck(uint256 _poolId) {
        require(poolExists[_poolId], "POOL_NOT_EXISTS");
        _;
    }
    
    constructor(address _owner) {
        require(_owner != address(0), "ZERO_OWNER");
        owner = _owner;
        // Factory owner is automatically an authorized admin
        authorizedAdmins[_owner] = true;
    }
    
    /**
     * @notice Authorize an admin to create pools (Factory owner only)
     * @param _admin Address to authorize
     */
    function authorizeAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "ZERO_ADDR");
        authorizedAdmins[_admin] = true;
        emit AdminAuthorized(_admin);
    }
    
    /**
     * @notice Revoke admin authorization (Factory owner only)
     * @param _admin Address to revoke
     */
    function revokeAdmin(address _admin) external onlyOwner {
        require(_admin != owner, "CANNOT_REVOKE_OWNER");
        authorizedAdmins[_admin] = false;
        emit AdminRevoked(_admin);
    }
    
    /**
     * @notice Create a new staking pool (Anyone can create)
     * @notice The caller's wallet becomes the pool owner
     * @param _stakingToken Token users will stake
     * @param _rewardToken Token for rewards
     * @param _poolReward Total reward tokens
     * @param _rewardDurationSeconds Reward duration in seconds
     * @param _maxTvl Maximum TVL
     * @return poolId The created pool ID
     */
    function createPool(
        address _stakingToken,
        address _rewardToken,
        uint256 _poolReward,
        uint256 _rewardDurationSeconds,
        uint256 _maxTvl
    ) external returns (uint256 poolId) {
        require(_stakingToken != address(0) && _rewardToken != address(0), "ZERO_ADDR");
        require(_poolReward > 0, "INVALID_POOL_REWARD");
        require(_rewardDurationSeconds > 0, "INVALID_DURATION");
        require(_maxTvl > 0, "INVALID_MAX_TVL");
        
        poolId = ++poolCount;
        
        uint256 rewardPerSecond = _poolReward / _rewardDurationSeconds;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + _rewardDurationSeconds;
        
        // msg.sender (connected wallet) becomes the pool owner
        address poolOwner = msg.sender;
        
        pools[poolId] = PoolConfig({
            poolId: poolId,
            stakingToken: _stakingToken,
            rewardToken: _rewardToken,
            poolOwner: poolOwner,  // Connected wallet is the pool owner
            poolReward: _poolReward,
            rewardDurationSeconds: _rewardDurationSeconds,
            maxTvl: _maxTvl,
            rewardPerSecond: rewardPerSecond,
            startTime: startTime,
            endTime: endTime,
            active: true,
            createdAt: block.timestamp
        });
        
        poolState[poolId] = PoolState({
            totalStaked: 0,
            accRewardPerShare: 0,
            lastRewardTime: startTime
        });
        
        poolExists[poolId] = true;
        activePoolIds.push(poolId);
        poolsByTokenPair[_stakingToken][_rewardToken].push(poolId);
        
        emit PoolCreated(poolId, _stakingToken, _rewardToken, _poolReward, _rewardDurationSeconds, _maxTvl);
        
        // Emit additional event with pool owner
        // Note: This is for indexing - the poolOwner is already in PoolConfig
        
        return poolId;
    }
    
    /**
     * @notice Update pool reward configuration (Pool owner or Factory owner only)
     * @param _poolId Pool ID
     * @param _poolReward New total reward tokens
     * @param _rewardDurationSeconds New reward duration
     * @param _maxTvl New maximum TVL
     */
    function updatePoolConfig(
        uint256 _poolId,
        uint256 _poolReward,
        uint256 _rewardDurationSeconds,
        uint256 _maxTvl
    ) external onlyPoolOwnerOrFactoryOwner(_poolId) {
        require(_poolReward > 0, "INVALID_POOL_REWARD");
        require(_rewardDurationSeconds > 0, "INVALID_DURATION");
        require(_maxTvl > 0, "INVALID_MAX_TVL");
        
        _updatePool(_poolId);
        
        PoolConfig storage pool = pools[_poolId];
        
        pool.poolReward = _poolReward;
        pool.rewardDurationSeconds = _rewardDurationSeconds;
        pool.maxTvl = _maxTvl;
        pool.rewardPerSecond = _poolReward / _rewardDurationSeconds;
        
        if (pool.startTime == 0) {
            pool.startTime = block.timestamp;
        }
        pool.endTime = pool.startTime + _rewardDurationSeconds;
        
        emit PoolConfigured(_poolId, _poolReward, _rewardDurationSeconds, _maxTvl);
    }
    
    /**
     * @notice Fund a pool with reward tokens (Pool owner or Factory owner only)
     * @param _poolId Pool ID
     */
    function fundPoolRewards(uint256 _poolId) external onlyPoolOwnerOrFactoryOwner(_poolId) {
        PoolConfig memory pool = pools[_poolId];
        require(pool.poolReward > 0, "REWARD_NOT_CONFIGURED");
        
        IERC20Minimal rewardToken = IERC20Minimal(pool.rewardToken);
        require(rewardToken.transferFrom(msg.sender, address(this), pool.poolReward), "TRANSFER_FAIL");
        
        emit FundRewards(_poolId, msg.sender, pool.poolReward);
    }
    
    /**
     * @notice Deposit tokens into a pool
     * @param _poolId Pool ID
     * @param _amount Amount to stake
     */
    function deposit(uint256 _poolId, uint256 _amount) external poolExistsCheck(_poolId) {
        require(_amount > 0, "ZERO_AMOUNT");
        
        PoolConfig memory pool = pools[_poolId];
        require(pool.active, "POOL_NOT_ACTIVE");
        require(block.timestamp >= pool.startTime && block.timestamp <= pool.endTime, "POOL_NOT_ACTIVE_TIME");
        
        PoolState storage state = poolState[_poolId];
        
        if (pool.maxTvl > 0) {
            require(state.totalStaked + _amount <= pool.maxTvl, "MAX_TVL_EXCEEDED");
        }
        
        _updatePool(_poolId);
        
        UserInfo storage user = userInfo[_poolId][msg.sender];
        
        // Pay pending rewards
        uint256 pending = _pendingReward(_poolId, msg.sender);
        if (pending > 0) {
            _safeRewardTransfer(_poolId, msg.sender, pending);
            emit Claim(_poolId, msg.sender, pending);
        }
        
        // Transfer staking tokens
        IERC20Minimal stakingToken = IERC20Minimal(pool.stakingToken);
        require(stakingToken.transferFrom(msg.sender, address(this), _amount), "TRANSFER_FAIL");
        
        // Update user info
        if (user.amount == 0) {
            user.stakeTime = block.timestamp;
        }
        
        user.amount += _amount;
        state.totalStaked += _amount;
        user.rewardDebt = (user.amount * state.accRewardPerShare) / ACC_PRECISION;
        
        emit Deposit(_poolId, msg.sender, _amount);
    }
    
    /**
     * @notice Withdraw tokens from a pool
     * @param _poolId Pool ID
     * @param _amount Amount to withdraw
     */
    function withdraw(uint256 _poolId, uint256 _amount) external poolExistsCheck(_poolId) {
        require(_amount > 0, "ZERO_AMOUNT");
        
        _updatePool(_poolId);
        
        UserInfo storage user = userInfo[_poolId][msg.sender];
        require(user.amount >= _amount, "INSUFFICIENT_STAKE");
        
        PoolConfig memory pool = pools[_poolId];
        PoolState storage state = poolState[_poolId];
        
        // Pay pending rewards
        uint256 pending = _pendingReward(_poolId, msg.sender);
        if (pending > 0) {
            _safeRewardTransfer(_poolId, msg.sender, pending);
            emit Claim(_poolId, msg.sender, pending);
        }
        
        // Update user info
        user.amount -= _amount;
        state.totalStaked -= _amount;
        user.rewardDebt = (user.amount * state.accRewardPerShare) / ACC_PRECISION;
        
        // Transfer staking tokens back
        IERC20Minimal stakingToken = IERC20Minimal(pool.stakingToken);
        require(stakingToken.transfer(msg.sender, _amount), "TRANSFER_FAIL");
        
        emit Withdraw(_poolId, msg.sender, _amount);
    }
    
    /**
     * @notice Claim pending rewards
     * @param _poolId Pool ID
     */
    function claim(uint256 _poolId) external poolExistsCheck(_poolId) {
        _updatePool(_poolId);
        
        uint256 pending = _pendingReward(_poolId, msg.sender);
        require(pending > 0, "NO_REWARD");
        
        _safeRewardTransfer(_poolId, msg.sender, pending);
        
        UserInfo storage user = userInfo[_poolId][msg.sender];
        PoolState storage state = poolState[_poolId];
        user.rewardDebt = (user.amount * state.accRewardPerShare) / ACC_PRECISION;
        
        emit Claim(_poolId, msg.sender, pending);
    }
    
    /**
     * @notice Get pending reward for a user
     * @param _poolId Pool ID
     * @param _user User address
     * @return Pending reward amount
     */
    function pendingReward(uint256 _poolId, address _user) external view poolExistsCheck(_poolId) returns (uint256) {
        return _pendingReward(_poolId, _user);
    }
    
    /**
     * @notice Get user info for a pool
     * @param _poolId Pool ID
     * @param _user User address
     * @return amount Staked amount
     * @return rewardDebt Reward debt
     * @return stakeTime First stake time
     * @return pending Pending rewards
     */
    function getUserInfo(uint256 _poolId, address _user) 
        external 
        view 
        poolExistsCheck(_poolId)
        returns (uint256 amount, uint256 rewardDebt, uint256 stakeTime, uint256 pending)
    {
        UserInfo memory user = userInfo[_poolId][_user];
        amount = user.amount;
        rewardDebt = user.rewardDebt;
        stakeTime = user.stakeTime;
        pending = _pendingReward(_poolId, _user);
    }
    
    /**
     * @notice Get pool info
     * @param _poolId Pool ID
     * @return config Pool configuration
     * @return state Pool state
     */
    function getPoolInfo(uint256 _poolId) 
        external 
        view 
        poolExistsCheck(_poolId)
        returns (PoolConfig memory config, PoolState memory state)
    {
        config = pools[_poolId];
        state = poolState[_poolId];
    }
    
    /**
     * @notice Get all active pool IDs
     * @return Array of active pool IDs
     */
    function getActivePoolIds() external view returns (uint256[] memory) {
        return activePoolIds;
    }
    
    /**
     * @notice Get pools for a token pair
     * @param _stakingToken Staking token address
     * @param _rewardToken Reward token address
     * @return Array of pool IDs
     */
    function getPoolsByTokenPair(address _stakingToken, address _rewardToken) 
        external 
        view 
        returns (uint256[] memory)
    {
        return poolsByTokenPair[_stakingToken][_rewardToken];
    }
    
    // Internal functions
    
    /**
     * @notice Update pool state (accumulate rewards)
     */
    function _updatePool(uint256 _poolId) internal {
        PoolConfig memory pool = pools[_poolId];
        PoolState storage state = poolState[_poolId];
        
        if (block.timestamp <= state.lastRewardTime || state.totalStaked == 0 || pool.rewardPerSecond == 0) {
            if (state.totalStaked == 0) {
                state.lastRewardTime = block.timestamp;
            }
            return;
        }
        
        uint256 secondsElapsed = _getSecondsElapsed(_poolId);
        if (secondsElapsed == 0) return;
        
        uint256 reward = secondsElapsed * pool.rewardPerSecond;
        state.accRewardPerShare = state.accRewardPerShare + (reward * ACC_PRECISION) / state.totalStaked;
        state.lastRewardTime = block.timestamp;
    }
    
    /**
     * @notice Get seconds elapsed since last update (capped to end time)
     */
    function _getSecondsElapsed(uint256 _poolId) internal view returns (uint256) {
        PoolConfig memory pool = pools[_poolId];
        PoolState memory state = poolState[_poolId];
        
        uint256 currentTime = block.timestamp;
        uint256 rewardEndTime = pool.endTime;
        
        if (rewardEndTime == 0) return 0;
        if (currentTime > rewardEndTime) {
            currentTime = rewardEndTime;
        }
        if (currentTime <= state.lastRewardTime) return 0;
        
        return currentTime - state.lastRewardTime;
    }
    
    /**
     * @notice Calculate pending reward internally
     */
    function _pendingReward(uint256 _poolId, address _user) internal view returns (uint256) {
        PoolConfig memory pool = pools[_poolId];
        PoolState memory state = poolState[_poolId];
        UserInfo memory user = userInfo[_poolId][_user];
        
        uint256 _acc = state.accRewardPerShare;
        
        if (block.timestamp > state.lastRewardTime && state.totalStaked > 0 && pool.rewardPerSecond > 0) {
            uint256 secondsElapsed = _getSecondsElapsed(_poolId);
            uint256 reward = secondsElapsed * pool.rewardPerSecond;
            _acc = _acc + (reward * ACC_PRECISION) / state.totalStaked;
        }
        
        uint256 accumulated = (user.amount * _acc) / ACC_PRECISION;
        if (accumulated < user.rewardDebt) return 0;
        return accumulated - user.rewardDebt;
    }
    
    /**
     * @notice Safely transfer reward tokens
     */
    function _safeRewardTransfer(uint256 _poolId, address _to, uint256 _amount) internal {
        PoolConfig memory pool = pools[_poolId];
        IERC20Minimal rewardToken = IERC20Minimal(pool.rewardToken);
        
        uint256 bal = rewardToken.balanceOf(address(this));
        uint256 send = _amount > bal ? bal : _amount;
        if (send > 0) {
            require(rewardToken.transfer(_to, send), "REWARD_TRANSFER_FAIL");
        }
    }
    
    /**
     * @notice Emergency withdraw rewards (owner only)
     */
    function emergencyWithdrawRewards(uint256 _poolId, address _to) external onlyOwner poolExistsCheck(_poolId) {
        PoolConfig memory pool = pools[_poolId];
        IERC20Minimal rewardToken = IERC20Minimal(pool.rewardToken);
        uint256 bal = rewardToken.balanceOf(address(this));
        require(rewardToken.transfer(_to, bal), "TRANSFER_FAIL");
    }
    
    /**
     * @notice Toggle pool active status (Pool owner or Factory owner only)
     */
    function setPoolActive(uint256 _poolId, bool _active) external onlyPoolOwnerOrFactoryOwner(_poolId) {
        pools[_poolId].active = _active;
    }
    
    /**
     * @notice Get pool owner address
     * @param _poolId Pool ID
     * @return Pool owner address
     */
    function getPoolOwner(uint256 _poolId) external view poolExistsCheck(_poolId) returns (address) {
        return pools[_poolId].poolOwner;
    }
    
    /**
     * @notice Check if address is authorized admin
     * @param _admin Address to check
     * @return true if authorized
     */
    function isAuthorizedAdmin(address _admin) external view returns (bool) {
        return _admin == owner || authorizedAdmins[_admin];
    }
}
