/**
 * Admin Dashboard API Route
 * 
 * Endpoint for fetching admin dashboard metrics and data.
 * Uses Supabase database for persistent storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/backend/utils/supabase';

// ============================================================================
// Types
// ============================================================================

export interface DashboardStats {
  totalTokensLocked: number;
  totalTokensLockedGrowth: number; // Percentage growth from 2 weeks ago
  activeStakingPools: number;
  activeStakingPoolsGrowth: number; // Percentage growth from 2 weeks ago
  totalStakedAmount: number;
  activeLiquidityPools: number;
  liveNotifications: number;
  liveNotificationsGrowth: number; // Percentage growth from 2 weeks ago
  incomingNotifications: number;
  activeAdCampaigns: number;
  activeAdCampaignsGrowth: number; // Percentage growth from 2 weeks ago
  newCampaignsRunning: number;
  protocolStatus: number; // Count of issues (non-operational statuses)
  protocolStatusGrowth: number; // Percentage change from 2 weeks ago (negative is good)
  criticalAlerts: Array<{
    title: string;
    description: string;
    service: string;
    status: string;
  }>;
  recentNotifications: Array<{
    message: string;
    time: string;
    id: string;
  }>;
}

// ============================================================================
// GET Handler - Retrieve dashboard stats
// ============================================================================

// Helper function to calculate growth percentage
function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

export async function GET(req: NextRequest) {
  try {
    // Calculate date 2 weeks ago for comparison
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoISO = twoWeeksAgo.toISOString();

    // 1. Total Tokens Locked - Sum of all active staked amounts
    const { data: activeStakes, error: stakesError } = await supabase
      .from('user_stakes')
      .select('staked_amount, created_at')
      .eq('status', 'active');
    
    if (stakesError) {
      console.error('[API] Error fetching active stakes:', stakesError);
    }
    
    const totalTokensLocked = (activeStakes || []).reduce((sum, stake) => {
      return sum + parseFloat(stake.staked_amount || '0');
    }, 0);

    // Calculate total tokens locked 2 weeks ago
    // This includes stakes that were created before 2 weeks ago (assuming they were active then)
    const totalTokensLockedTwoWeeksAgo = (activeStakes || [])
      .filter((stake) => {
        const createdAt = new Date(stake.created_at);
        return createdAt < twoWeeksAgo;
      })
      .reduce((sum, stake) => {
        return sum + parseFloat(stake.staked_amount || '0');
      }, 0);
    
    const totalTokensLockedGrowth = calculateGrowth(totalTokensLocked, totalTokensLockedTwoWeeksAgo);

    // 2. Active Staking Pools - Count and total staked amount
    const { data: activePools, error: poolsError } = await supabase
      .from('staking_pools')
      .select('id, created_at')
      .eq('status', 'active');
    
    if (poolsError) {
      console.error('[API] Error fetching active pools:', poolsError);
    }
    
    const activeStakingPools = (activePools || []).length;
    
    // Calculate active pools count 2 weeks ago
    const activeStakingPoolsTwoWeeksAgo = (activePools || []).filter(
      (pool) => new Date(pool.created_at) < twoWeeksAgo
    ).length;
    
    const activeStakingPoolsGrowth = calculateGrowth(activeStakingPools, activeStakingPoolsTwoWeeksAgo);
    
    // Get total staked amount from user_stakes for active pools
    const { data: allStakes, error: allStakesError } = await supabase
      .from('user_stakes')
      .select('staked_amount')
      .eq('status', 'active');
    
    if (allStakesError) {
      console.error('[API] Error fetching all stakes:', allStakesError);
    }
    
    const totalStakedAmount = (allStakes || []).reduce((sum, stake) => {
      return sum + parseFloat(stake.staked_amount || '0');
    }, 0);

    // 3. Active Liquidity Pools - Show nothing (coming soon)
    const activeLiquidityPools = 0;

    // 4. Live Notifications - Count of bug reports
    const { data: allBugReports, error: bugReportsError } = await supabase
      .from('bug_reports')
      .select('id, status, created_at, description, user_wallet')
      .order('created_at', { ascending: false });
    
    if (bugReportsError) {
      console.error('[API] Error fetching bug reports:', bugReportsError);
    }
    
    const liveNotifications = (allBugReports || []).length;
    
    // Calculate bug reports count 2 weeks ago
    const liveNotificationsTwoWeeksAgo = (allBugReports || []).filter(
      (report) => new Date(report.created_at) < twoWeeksAgo
    ).length;
    
    const liveNotificationsGrowth = calculateGrowth(liveNotifications, liveNotificationsTwoWeeksAgo);
    
    // Incoming notifications (pending bug reports that admin hasn't viewed)
    const incomingNotifications = (allBugReports || []).filter(
      (report) => report.status === 'pending'
    ).length;

    // 5. Active Ad Campaigns - Count of published campaigns
    const { data: publishedAds, error: adsError } = await supabase
      .from('adverts')
      .select('id, status, created_at')
      .eq('status', 'published');
    
    if (adsError) {
      console.error('[API] Error fetching ad campaigns:', adsError);
    }
    
    const activeAdCampaigns = (publishedAds || []).length;
    
    // Calculate active ad campaigns count 2 weeks ago
    const activeAdCampaignsTwoWeeksAgo = (publishedAds || []).filter(
      (ad) => new Date(ad.created_at) < twoWeeksAgo
    ).length;
    
    const activeAdCampaignsGrowth = calculateGrowth(activeAdCampaigns, activeAdCampaignsTwoWeeksAgo);
    
    // New campaigns running (recently published, within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newCampaignsRunning = (publishedAds || []).filter((ad) => {
      const createdAt = new Date(ad.created_at);
      return createdAt >= sevenDaysAgo;
    }).length;

    // 6. Protocol Status - Count of issues from live_status (non-operational statuses)
    // Note: live_status is currently in-memory, so we'll use the API endpoint
    const liveStatusResponse = await fetch(
      `${req.nextUrl.origin}/api/v1/live-status`
    ).catch(() => null);
    
    let protocolStatus = 0;
    let protocolStatusGrowth = 0;
    let criticalAlerts: Array<{
      title: string;
      description: string;
      service: string;
      status: string;
    }> = [];
    
    if (liveStatusResponse && liveStatusResponse.ok) {
      const liveStatusData = await liveStatusResponse.json();
      const statuses = liveStatusData.statuses || [];
      
      // Count non-operational statuses
      protocolStatus = statuses.filter(
        (s: any) => s.status !== 'operational'
      ).length;
      
      // For protocol status, we'll assume previous count was 0 if no historical data
      // In a real scenario, you'd track this in a database
      // For now, we'll calculate based on a baseline (assuming 0 issues is the baseline)
      const protocolStatusBaseline = 0; // All services operational
      protocolStatusGrowth = calculateGrowth(protocolStatus, protocolStatusBaseline);
      
      // Build critical alerts from non-operational statuses
      criticalAlerts = statuses
        .filter((s: any) => s.status !== 'operational')
        .map((s: any) => {
          const statusLabels: Record<string, { title: string; description: string }> = {
            degraded: {
              title: 'Protocol Performance Degraded',
              description: `${s.service} is experiencing degraded performance. Users may experience delays.`,
            },
            down: {
              title: 'Service Down',
              description: `${s.service} is currently down. Please investigate immediately.`,
            },
            maintenance: {
              title: 'Service Under Maintenance',
              description: `${s.service} is currently under maintenance.`,
            },
          };
          
          const labels = statusLabels[s.status] || {
            title: `${s.service} Status: ${s.status}`,
            description: `${s.service} status is set to ${s.status}.`,
          };
          
          return {
            title: labels.title,
            description: labels.description,
            service: s.service,
            status: s.status,
          };
        });
    }

    // 7. Recent Notifications - Recent bug reports
    const recentNotifications = (allBugReports || [])
      .slice(0, 3)
      .map((report) => {
        const createdAt = new Date(report.created_at);
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
        
        let timeString = '';
        if (diffMinutes < 1) {
          timeString = 'Just now';
        } else if (diffMinutes < 60) {
          timeString = `${diffMinutes} ${diffMinutes === 1 ? 'min' : 'mins'} ago`;
        } else {
          const diffHours = Math.floor(diffMinutes / 60);
          timeString = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
        }
        
        // Format wallet address
        const wallet = report.user_wallet || '';
        const formattedWallet = wallet.length > 10 
          ? `${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}`
          : wallet;
        
        // Truncate description if too long
        const description = report.description || '';
        const truncatedDescription = description.length > 100 
          ? `${description.substring(0, 100)}...`
          : description;
        
        return {
          message: `Bug report from ${formattedWallet}: ${truncatedDescription}`,
          time: timeString,
          id: report.id,
        };
      });

    const stats: DashboardStats = {
      totalTokensLocked,
      totalTokensLockedGrowth,
      activeStakingPools,
      activeStakingPoolsGrowth,
      totalStakedAmount,
      activeLiquidityPools,
      liveNotifications,
      liveNotificationsGrowth,
      incomingNotifications,
      activeAdCampaigns,
      activeAdCampaignsGrowth,
      newCampaignsRunning,
      protocolStatus,
      protocolStatusGrowth,
      criticalAlerts,
      recentNotifications,
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('[API] /api/v1/admin/dashboard GET error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch dashboard stats',
      },
      { status: 500 }
    );
  }
}

