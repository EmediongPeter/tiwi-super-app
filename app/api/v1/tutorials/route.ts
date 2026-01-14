/**
 * Tutorials API Route
 * 
 * Endpoint for managing tutorials.
 * Uses Supabase database for persistent storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/backend/utils/supabase';

// ============================================================================
// Types
// ============================================================================

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: 'Trading' | 'Liquidity' | 'Staking' | 'NFTs' | 'Social' | 'Security' | 'Getting Started' | 'Advanced';
  link: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TutorialsAPIResponse {
  tutorials: Tutorial[];
  total: number;
}

export interface CreateTutorialRequest {
  title: string;
  description: string;
  category: Tutorial['category'];
  link: string;
  thumbnailUrl?: string;
}

export interface UpdateTutorialRequest {
  id: string;
  title?: string;
  description?: string;
  category?: Tutorial['category'];
  link?: string;
  thumbnailUrl?: string;
}

// ============================================================================
// GET Handler - Retrieve Tutorials
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category') as Tutorial['category'] | null;
    
    // Build Supabase query
    let query = supabase
      .from('tutorials')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Filter by category if provided
    if (category) {
      query = query.eq('category', category);
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(error.message || 'Failed to fetch tutorials from database');
    }
    
    // Map database rows to Tutorial interface
    const tutorials: Tutorial[] = (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      link: row.link,
      thumbnailUrl: row.thumbnail_url || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    const response: TutorialsAPIResponse = {
      tutorials,
      total: tutorials.length,
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] /api/v1/tutorials GET error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to fetch tutorials', 
        tutorials: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Create a new Tutorial
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body: CreateTutorialRequest = await req.json();
    
    // Validate required fields
    if (!body.title || !body.description || !body.category || !body.link) {
      return NextResponse.json(
        { error: 'title, description, category, and link are required' },
        { status: 400 }
      );
    }
    
    // Validate category
    const validCategories = ['Trading', 'Liquidity', 'Staking', 'NFTs', 'Social', 'Security', 'Getting Started', 'Advanced'];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('tutorials')
      .insert({
        title: body.title,
        description: body.description,
        category: body.category,
        link: body.link,
        thumbnail_url: body.thumbnailUrl || null,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[API] Supabase insert error:', error);
      throw new Error(error.message || 'Failed to create tutorial in database');
    }
    
    // Map database row to Tutorial interface
    const newTutorial: Tutorial = {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      link: data.link,
      thumbnailUrl: data.thumbnail_url || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    return NextResponse.json(
      { 
        success: true,
        tutorial: newTutorial,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API] /api/v1/tutorials POST error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to create tutorial', 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH Handler - Update existing Tutorial
// ============================================================================

export async function PATCH(req: NextRequest) {
  try {
    const body: UpdateTutorialRequest = await req.json();
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Tutorial ID is required' },
        { status: 400 }
      );
    }
    
    // Validate category if provided
    if (body.category) {
      const validCategories = ['Trading', 'Liquidity', 'Staking', 'NFTs', 'Social', 'Security', 'Getting Started', 'Advanced'];
      if (!validCategories.includes(body.category)) {
        return NextResponse.json(
          { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
          { status: 400 }
        );
      }
    }
    
    // Build update object
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.link !== undefined) updateData.link = body.link;
    if (body.thumbnailUrl !== undefined) updateData.thumbnail_url = body.thumbnailUrl || null;
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'At least one field must be provided for update' },
        { status: 400 }
      );
    }
    
    // Update in Supabase
    const { data, error } = await supabase
      .from('tutorials')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();
    
    if (error) {
      console.error('[API] Supabase update error:', error);
      if (error.code === 'PGRST116') {
        // No rows returned - Tutorial not found
        return NextResponse.json(
          { error: 'Tutorial not found' },
          { status: 404 }
        );
      }
      throw new Error(error.message || 'Failed to update tutorial in database');
    }
    
    // Map database row to Tutorial interface
    const updatedTutorial: Tutorial = {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      link: data.link,
      thumbnailUrl: data.thumbnail_url || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    return NextResponse.json(
      { 
        success: true,
        tutorial: updatedTutorial,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] /api/v1/tutorials PATCH error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to update tutorial', 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE Handler - Remove Tutorial
// ============================================================================

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Tutorial ID is required' },
        { status: 400 }
      );
    }
    
    // Delete from Supabase
    const { error } = await supabase
      .from('tutorials')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[API] Supabase delete error:', error);
      throw new Error(error.message || 'Failed to delete tutorial from database');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Tutorial deleted successfully',
    });
  } catch (error: any) {
    console.error('[API] /api/v1/tutorials DELETE error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete tutorial' },
      { status: 500 }
    );
  }
}

