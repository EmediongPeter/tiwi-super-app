/**
 * Live Status API Route
 * 
 * Endpoint for managing live status updates for services.
 * Uses in-memory storage (can be replaced with external service/API).
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Types
// ============================================================================

export interface LiveStatus {
  id: string;
  service: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance';
  updatedAt: string;
  updatedBy?: string;
}

export interface LiveStatusResponse {
  statuses: LiveStatus[];
  total: number;
}

export interface CreateLiveStatusRequest {
  service: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance';
}

export interface UpdateLiveStatusRequest {
  id: string;
  service?: string;
  status?: 'operational' | 'degraded' | 'down' | 'maintenance';
}

// ============================================================================
// In-Memory Storage (Replace with external service/API as needed)
// ============================================================================

// In a production environment, this would connect to an external status service
// For now, we use in-memory storage that persists during server runtime
let liveStatusStore: Map<string, LiveStatus> = new Map();

// Initialize with default statuses
const defaultServices = [
  'Swap',
  'Liquidity',
  'Bridge',
  'Governance',
  'Nodes',
  'Staking',
  'NFT',
  'Referrals',
];

// Initialize store with default services if empty
// All services are hardcoded to 'maintenance' status until live endpoints are ready
if (liveStatusStore.size === 0) {
  defaultServices.forEach((service) => {
    const id = service.toLowerCase().replace(/\s+/g, '-');
    liveStatusStore.set(id, {
      id,
      service,
      status: 'maintenance',
      updatedAt: new Date().toISOString(),
    });
  });
}

// ============================================================================
// GET Handler - Retrieve all live statuses
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const service = searchParams.get('service');
    
    // Ensure store is initialized with all default services in maintenance status
    if (liveStatusStore.size === 0) {
      defaultServices.forEach((svc) => {
        const id = svc.toLowerCase().replace(/\s+/g, '-');
        liveStatusStore.set(id, {
          id,
          service: svc,
          status: 'maintenance',
          updatedAt: new Date().toISOString(),
        });
      });
    }
    
    let statuses: LiveStatus[] = Array.from(liveStatusStore.values());
    
    // Hardcode all statuses to 'maintenance' until live endpoints are ready
    statuses = statuses.map((s) => ({
      ...s,
      status: 'maintenance' as const,
    }));
    
    // Filter by service if provided
    if (service) {
      statuses = statuses.filter((s) => 
        s.service.toLowerCase().includes(service.toLowerCase())
      );
    }
    
    // Sort by service name
    statuses.sort((a, b) => a.service.localeCompare(b.service));
    
    const response: LiveStatusResponse = {
      statuses,
      total: statuses.length,
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] /api/v1/live-status GET error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch live statuses',
        statuses: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Create or update live status
// ============================================================================
// DISABLED: Status updates are disabled until live endpoints are ready
// All services are hardcoded to 'maintenance' status

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'Status updates are disabled. All services are in maintenance mode until live endpoints are ready.' },
    { status: 403 }
  );
}

// ============================================================================
// PATCH Handler - Update existing live status
// ============================================================================
// DISABLED: Status updates are disabled until live endpoints are ready
// All services are hardcoded to 'maintenance' status

export async function PATCH(req: NextRequest) {
  return NextResponse.json(
    { error: 'Status updates are disabled. All services are in maintenance mode until live endpoints are ready.' },
    { status: 403 }
  );
}

// ============================================================================
// DELETE Handler - Remove live status
// ============================================================================
// DISABLED: Status deletion is disabled until live endpoints are ready

export async function DELETE(req: NextRequest) {
  return NextResponse.json(
    { error: 'Status deletion is disabled. All services are in maintenance mode until live endpoints are ready.' },
    { status: 403 }
  );
}

