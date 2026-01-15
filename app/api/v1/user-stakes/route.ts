/**
 * User Stakes API Route
 * 
 * Endpoint for managing user staking positions.
 * Uses Supabase database for persistent storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/backend/utils/supabase';

// ============================================================================
// Types
// ============================================================================

export interface UserStake {
  id: string;
  userWallet: string;
  poolId: string;
  stakedAmount: number;
  rewardsEarned: number;
  lockPeriodDays?: number;
  lockEndDate?: string;
  status: 'active' | 'completed' | 'withdrawn';
  transactionHash?: string;
  createdAt: string;
  updatedAt: string;
  // Pool details (joined from staking_pools)
  pool?: {
    tokenSymbol?: string;
    tokenName?: string;
    tokenLogo?: string;
    apy?: number;
    chainName?: string;
  };
}

export interface UserStakesResponse {
  stakes: UserStake[];
  total: number;
}

// ============================================================================
// Helper: Map database row to UserStake interface
// ============================================================================

function mapRowToStake(row: any, poolData?: any): UserStake {
  return {
    id: row.id,
    userWallet: row.user_wallet,
    poolId: row.pool_id,
    stakedAmount: parseFloat(row.staked_amount || '0'),
    rewardsEarned: parseFloat(row.rewards_earned || '0'),
    lockPeriodDays: row.lock_period_days || undefined,
    lockEndDate: row.lock_end_date || undefined,
    status: row.status || 'active',
    transactionHash: row.transaction_hash || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pool: poolData ? {
      tokenSymbol: poolData.token_symbol,
      tokenName: poolData.token_name,
      tokenLogo: poolData.token_logo,
      apy: poolData.apy ? parseFloat(poolData.apy) : undefined,
      chainName: poolData.chain_name,
    } : undefined,
  };
}

// ============================================================================
// GET Handler - Retrieve user stakes
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userWallet = searchParams.get('userWallet');
    const status = searchParams.get('status') as 'active' | 'completed' | 'withdrawn' | null;
    
    if (!userWallet) {
      return NextResponse.json(
        { error: 'userWallet parameter is required' },
        { status: 400 }
      );
    }
    
    // Build Supabase query
    let query = supabase
      .from('user_stakes')
      .select('*')
      .eq('user_wallet', userWallet)
      .order('created_at', { ascending: false });
    
    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(error.message || 'Failed to fetch user stakes from database');
    }
    
    // Fetch pool details for each stake
    const stakesWithPools = await Promise.all(
      (data || []).map(async (row: any) => {
        // Fetch pool details
        const { data: poolData } = await supabase
          .from('staking_pools')
          .select('token_symbol, token_name, token_logo, apy, chain_name')
          .eq('id', row.pool_id)
          .single();
        
        return mapRowToStake(row, poolData);
      })
    );
    
    const stakes: UserStake[] = stakesWithPools;
    
    const response: UserStakesResponse = {
      stakes,
      total: stakes.length,
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] /api/v1/user-stakes GET error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch user stakes',
        stakes: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Create user stake
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.userWallet || !body.poolId || body.stakedAmount === undefined) {
      return NextResponse.json(
        { error: 'userWallet, poolId, and stakedAmount are required' },
        { status: 400 }
      );
    }
    
    // Calculate lock end date if lock period is provided
    let lockEndDate = null;
    if (body.lockPeriodDays) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + body.lockPeriodDays);
      lockEndDate = endDate.toISOString();
    }
    
    // Insert into database
    const { data, error } = await supabase
      .from('user_stakes')
      .insert({
        user_wallet: body.userWallet,
        pool_id: body.poolId,
        staked_amount: body.stakedAmount,
        rewards_earned: body.rewardsEarned || 0,
        lock_period_days: body.lockPeriodDays || null,
        lock_end_date: lockEndDate,
        status: body.status || 'active',
        transaction_hash: body.transactionHash || null,
      })
      .select('*')
      .single();
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(error.message || 'Failed to create user stake in database');
    }
    
    // Fetch pool details
    const { data: poolData } = await supabase
      .from('staking_pools')
      .select('token_symbol, token_name, token_logo, apy, chain_name')
      .eq('id', data.pool_id)
      .single();
    
    // Map database row to UserStake interface
    const stake: UserStake = mapRowToStake(data, poolData);
    
    return NextResponse.json({
      success: true,
      stake,
    });
  } catch (error: any) {
    console.error('[API] /api/v1/user-stakes POST error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create user stake' },
      { status: 500 }
    );
  }
}

