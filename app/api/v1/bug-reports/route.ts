/**
 * Bug Reports API Route
 * 
 * Endpoint for creating and retrieving bug reports from users.
 * Uses Supabase database for persistent storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { BugReport, CreateBugReportRequest, BugReportsAPIResponse } from '@/lib/shared/types/bug-reports';
import { supabase } from '@/lib/backend/utils/supabase';

// ============================================================================
// GET Handler - Retrieve bug reports
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') as BugReport['status'] | null;
    const userWallet = searchParams.get('userWallet');
    
    // Build Supabase query
    let query = supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    // Filter by user wallet if provided
    if (userWallet) {
      query = query.ilike('user_wallet', userWallet);
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(error.message || 'Failed to fetch bug reports from database');
    }
    
    // Map database rows to BugReport interface
    const bugReports: BugReport[] = (data || []).map((row) => ({
      id: row.id,
      userWallet: row.user_wallet,
      description: row.description,
      screenshot: row.screenshot || undefined,
      logFile: row.log_file || undefined,
      deviceInfo: row.device_info || undefined,
      status: row.status,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at || undefined,
      reviewedBy: row.reviewed_by || undefined,
    }));
    
    const response: BugReportsAPIResponse = {
      bugReports,
      total: bugReports.length,
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] /api/v1/bug-reports GET error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to fetch bug reports', 
        bugReports: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Create a new bug report
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body: CreateBugReportRequest = await req.json();
    
    // Validate required fields
    if (!body.userWallet || !body.description) {
      return NextResponse.json(
        { error: 'userWallet and description are required' },
        { status: 400 }
      );
    }
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('bug_reports')
      .insert({
        user_wallet: body.userWallet,
        description: body.description,
        screenshot: body.screenshot || null,
        log_file: body.logFile || null,
        device_info: body.deviceInfo || null,
        status: 'pending',
      })
      .select()
      .single();
    
    if (error) {
      console.error('[API] Supabase insert error:', error);
      throw new Error(error.message || 'Failed to create bug report in database');
    }
    
    // Map database row to BugReport interface
    const newReport: BugReport = {
      id: data.id,
      userWallet: data.user_wallet,
      description: data.description,
      screenshot: data.screenshot || undefined,
      logFile: data.log_file || undefined,
      deviceInfo: data.device_info || undefined,
      status: data.status,
      createdAt: data.created_at,
      reviewedAt: data.reviewed_at || undefined,
      reviewedBy: data.reviewed_by || undefined,
    };
    
    return NextResponse.json(
      { 
        success: true,
        bugReport: newReport,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API] /api/v1/bug-reports POST error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to create bug report', 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH Handler - Update bug report status
// ============================================================================

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, reviewedBy } = body;
    
    if (!id || !status) {
      return NextResponse.json(
        { error: 'id and status are required' },
        { status: 400 }
      );
    }
    
    // Update in Supabase
    const updateData: any = {
      status: status as BugReport['status'],
      reviewed_at: new Date().toISOString(),
    };
    
    if (reviewedBy) {
      updateData.reviewed_by = reviewedBy;
    }
    
    const { data, error } = await supabase
      .from('bug_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[API] Supabase update error:', error);
      if (error.code === 'PGRST116') {
        // No rows returned - report not found
        return NextResponse.json(
          { error: 'Bug report not found' },
          { status: 404 }
        );
      }
      throw new Error(error.message || 'Failed to update bug report in database');
    }
    
    // Map database row to BugReport interface
    const updatedReport: BugReport = {
      id: data.id,
      userWallet: data.user_wallet,
      description: data.description,
      screenshot: data.screenshot || undefined,
      logFile: data.log_file || undefined,
      deviceInfo: data.device_info || undefined,
      status: data.status,
      createdAt: data.created_at,
      reviewedAt: data.reviewed_at || undefined,
      reviewedBy: data.reviewed_by || undefined,
    };
    
    return NextResponse.json(
      { 
        success: true,
        bugReport: updatedReport,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] /api/v1/bug-reports PATCH error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to update bug report', 
      },
      { status: 500 }
    );
  }
}

