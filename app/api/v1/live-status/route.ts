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
if (liveStatusStore.size === 0) {
  defaultServices.forEach((service) => {
    const id = service.toLowerCase().replace(/\s+/g, '-');
    liveStatusStore.set(id, {
      id,
      service,
      status: 'operational',
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
    
    let statuses: LiveStatus[] = Array.from(liveStatusStore.values());
    
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

export async function POST(req: NextRequest) {
  try {
    const body: CreateLiveStatusRequest = await req.json();
    
    if (!body.service || !body.status) {
      return NextResponse.json(
        { error: 'Service and status are required' },
        { status: 400 }
      );
    }
    
    // Validate status
    const validStatuses = ['operational', 'degraded', 'down', 'maintenance'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Generate ID from service name
    const id = body.service.toLowerCase().replace(/\s+/g, '-');
    
    // Create or update status
    const status: LiveStatus = {
      id,
      service: body.service,
      status: body.status,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin', // In production, get from auth context
    };
    
    liveStatusStore.set(id, status);
    
    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error: any) {
    console.error('[API] /api/v1/live-status POST error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create/update live status' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH Handler - Update existing live status
// ============================================================================

export async function PATCH(req: NextRequest) {
  try {
    const body: UpdateLiveStatusRequest = await req.json();
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Status ID is required' },
        { status: 400 }
      );
    }
    
    const existingStatus = liveStatusStore.get(body.id);
    if (!existingStatus) {
      return NextResponse.json(
        { error: 'Live status not found' },
        { status: 404 }
      );
    }
    
    // Validate status if provided
    if (body.status) {
      const validStatuses = ['operational', 'degraded', 'down', 'maintenance'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }
    
    // Update status
    const updatedStatus: LiveStatus = {
      ...existingStatus,
      ...(body.service && { service: body.service }),
      ...(body.status && { status: body.status }),
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin', // In production, get from auth context
    };
    
    liveStatusStore.set(body.id, updatedStatus);
    
    return NextResponse.json({
      success: true,
      status: updatedStatus,
    });
  } catch (error: any) {
    console.error('[API] /api/v1/live-status PATCH error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update live status' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE Handler - Remove live status
// ============================================================================

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Status ID is required' },
        { status: 400 }
      );
    }
    
    const existingStatus = liveStatusStore.get(id);
    if (!existingStatus) {
      return NextResponse.json(
        { error: 'Live status not found' },
        { status: 404 }
      );
    }
    
    liveStatusStore.delete(id);
    
    return NextResponse.json({
      success: true,
      message: 'Live status deleted successfully',
    });
  } catch (error: any) {
    console.error('[API] /api/v1/live-status DELETE error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete live status' },
      { status: 500 }
    );
  }
}

