/**
 * Token Spotlight API Route
 * 
 * Endpoint for managing token spotlight features.
 * Uses Supabase database for persistent storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/backend/utils/supabase';

// ============================================================================
// Types
// ============================================================================

export interface SpotlightToken {
  id: string;
  symbol: string;
  name?: string;
  address?: string;
  rank: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpotlightTokensResponse {
  tokens: SpotlightToken[];
  total: number;
}

export interface CreateSpotlightTokenRequest {
  symbol: string;
  name?: string;
  address?: string;
  rank: number;
  startDate: string;
  endDate: string;
}

export interface UpdateSpotlightTokenRequest {
  id: string;
  symbol?: string;
  name?: string;
  address?: string;
  rank?: number;
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// GET Handler - Retrieve all spotlight tokens
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    
    // Build Supabase query
    let query = supabase
      .from('token_spotlight')
      .select('*')
      .order('rank', { ascending: true })
      .order('symbol', { ascending: true });
    
    // Filter by symbol if provided
    if (symbol) {
      query = query.ilike('symbol', `%${symbol}%`);
    }
    
    // Filter active tokens (within date range) if requested
    if (activeOnly) {
      const today = new Date().toISOString().split('T')[0];
      query = query.lte('start_date', today).gte('end_date', today);
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(error.message || 'Failed to fetch spotlight tokens from database');
    }
    
    // Map database rows to SpotlightToken interface
    const tokens: SpotlightToken[] = (data || []).map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name || undefined,
      address: row.address || undefined,
      rank: row.rank,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    const response: SpotlightTokensResponse = {
      tokens,
      total: tokens.length,
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] /api/v1/token-spotlight GET error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch spotlight tokens',
        tokens: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Create spotlight token
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body: CreateSpotlightTokenRequest = await req.json();
    
    if (!body.symbol || !body.rank || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: 'Symbol, rank, startDate, and endDate are required' },
        { status: 400 }
      );
    }
    
    // Validate dates
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    
    if (end < start) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }
    
    if (body.rank < 1) {
      return NextResponse.json(
        { error: 'Rank must be at least 1' },
        { status: 400 }
      );
    }
    
    // Insert into database
    const { data, error } = await supabase
      .from('token_spotlight')
      .insert({
        symbol: body.symbol,
        name: body.name || null,
        address: body.address || null,
        rank: body.rank,
        start_date: body.startDate,
        end_date: body.endDate,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[API] Supabase error:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A spotlight token with this symbol and date range already exists' },
          { status: 400 }
        );
      }
      
      throw new Error(error.message || 'Failed to create spotlight token in database');
    }
    
    // Map database row to SpotlightToken interface
    const token: SpotlightToken = {
      id: data.id,
      symbol: data.symbol,
      name: data.name || undefined,
      address: data.address || undefined,
      rank: data.rank,
      startDate: data.start_date,
      endDate: data.end_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    return NextResponse.json({
      success: true,
      token,
    });
  } catch (error: any) {
    console.error('[API] /api/v1/token-spotlight POST error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create spotlight token' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH Handler - Update spotlight token
// ============================================================================

export async function PATCH(req: NextRequest) {
  try {
    const body: UpdateSpotlightTokenRequest = await req.json();
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Token ID is required' },
        { status: 400 }
      );
    }
    
    // Check if token exists
    const { data: existing, error: fetchError } = await supabase
      .from('token_spotlight')
      .select('*')
      .eq('id', body.id)
      .single();
    
    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Spotlight token not found' },
        { status: 404 }
      );
    }
    
    // Validate dates if provided
    if (body.startDate && body.endDate) {
      const start = new Date(body.startDate);
      const end = new Date(body.endDate);
      
      if (end < start) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        );
      }
    }
    
    // Validate rank if provided
    if (body.rank !== undefined && body.rank < 1) {
      return NextResponse.json(
        { error: 'Rank must be at least 1' },
        { status: 400 }
      );
    }
    
    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (body.symbol) updateData.symbol = body.symbol;
    if (body.name !== undefined) updateData.name = body.name || null;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.rank !== undefined) updateData.rank = body.rank;
    if (body.startDate) updateData.start_date = body.startDate;
    if (body.endDate) updateData.end_date = body.endDate;
    
    // Update in database
    const { data, error } = await supabase
      .from('token_spotlight')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();
    
    if (error) {
      console.error('[API] Supabase error:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A spotlight token with this symbol and date range already exists' },
          { status: 400 }
        );
      }
      
      throw new Error(error.message || 'Failed to update spotlight token in database');
    }
    
    // Map database row to SpotlightToken interface
    const updatedToken: SpotlightToken = {
      id: data.id,
      symbol: data.symbol,
      name: data.name || undefined,
      address: data.address || undefined,
      rank: data.rank,
      startDate: data.start_date,
      endDate: data.end_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    return NextResponse.json({
      success: true,
      token: updatedToken,
    });
  } catch (error: any) {
    console.error('[API] /api/v1/token-spotlight PATCH error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update spotlight token' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE Handler - Remove spotlight token
// ============================================================================

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Token ID is required' },
        { status: 400 }
      );
    }
    
    // Check if token exists
    const { data: existing, error: fetchError } = await supabase
      .from('token_spotlight')
      .select('id')
      .eq('id', id)
      .single();
    
    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Spotlight token not found' },
        { status: 404 }
      );
    }
    
    // Delete from database
    const { error } = await supabase
      .from('token_spotlight')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(error.message || 'Failed to delete spotlight token from database');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Spotlight token deleted successfully',
    });
  } catch (error: any) {
    console.error('[API] /api/v1/token-spotlight DELETE error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete spotlight token' },
      { status: 500 }
    );
  }
}

