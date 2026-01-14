/**
 * FAQs API Route
 * 
 * Endpoint for managing FAQs (Frequently Asked Questions).
 * Uses Supabase database for persistent storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/backend/utils/supabase';

// ============================================================================
// Types
// ============================================================================

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'General' | 'Transactions' | 'Chains' | 'Lending' | 'Staking' | 'Liquidity' | 'NFTs' | 'Referrals' | 'Security' | 'Troubleshooting';
  createdAt: string;
  updatedAt: string;
}

export interface FAQsAPIResponse {
  faqs: FAQ[];
  total: number;
}

export interface CreateFAQRequest {
  question: string;
  answer: string;
  category: FAQ['category'];
}

export interface UpdateFAQRequest {
  id: string;
  question?: string;
  answer?: string;
  category?: FAQ['category'];
}

// ============================================================================
// GET Handler - Retrieve FAQs
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category') as FAQ['category'] | null;
    
    // Build Supabase query
    let query = supabase
      .from('faqs')
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
      throw new Error(error.message || 'Failed to fetch FAQs from database');
    }
    
    // Map database rows to FAQ interface
    const faqs: FAQ[] = (data || []).map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      category: row.category,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    const response: FAQsAPIResponse = {
      faqs,
      total: faqs.length,
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] /api/v1/faqs GET error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to fetch FAQs', 
        faqs: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Create a new FAQ
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body: CreateFAQRequest = await req.json();
    
    // Validate required fields
    if (!body.question || !body.answer || !body.category) {
      return NextResponse.json(
        { error: 'question, answer, and category are required' },
        { status: 400 }
      );
    }
    
    // Validate category
    const validCategories = ['General', 'Transactions', 'Chains', 'Lending', 'Staking', 'Liquidity', 'NFTs', 'Referrals', 'Security', 'Troubleshooting'];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('faqs')
      .insert({
        question: body.question,
        answer: body.answer,
        category: body.category,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[API] Supabase insert error:', error);
      throw new Error(error.message || 'Failed to create FAQ in database');
    }
    
    // Map database row to FAQ interface
    const newFAQ: FAQ = {
      id: data.id,
      question: data.question,
      answer: data.answer,
      category: data.category,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    return NextResponse.json(
      { 
        success: true,
        faq: newFAQ,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API] /api/v1/faqs POST error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to create FAQ', 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH Handler - Update existing FAQ
// ============================================================================

export async function PATCH(req: NextRequest) {
  try {
    const body: UpdateFAQRequest = await req.json();
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'FAQ ID is required' },
        { status: 400 }
      );
    }
    
    // Validate category if provided
    if (body.category) {
      const validCategories = ['General', 'Transactions', 'Chains', 'Lending', 'Staking', 'Liquidity', 'NFTs', 'Referrals', 'Security', 'Troubleshooting'];
      if (!validCategories.includes(body.category)) {
        return NextResponse.json(
          { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
          { status: 400 }
        );
      }
    }
    
    // Build update object
    const updateData: any = {};
    if (body.question !== undefined) updateData.question = body.question;
    if (body.answer !== undefined) updateData.answer = body.answer;
    if (body.category !== undefined) updateData.category = body.category;
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'At least one field (question, answer, or category) must be provided' },
        { status: 400 }
      );
    }
    
    // Update in Supabase
    const { data, error } = await supabase
      .from('faqs')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();
    
    if (error) {
      console.error('[API] Supabase update error:', error);
      if (error.code === 'PGRST116') {
        // No rows returned - FAQ not found
        return NextResponse.json(
          { error: 'FAQ not found' },
          { status: 404 }
        );
      }
      throw new Error(error.message || 'Failed to update FAQ in database');
    }
    
    // Map database row to FAQ interface
    const updatedFAQ: FAQ = {
      id: data.id,
      question: data.question,
      answer: data.answer,
      category: data.category,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    return NextResponse.json(
      { 
        success: true,
        faq: updatedFAQ,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] /api/v1/faqs PATCH error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to update FAQ', 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE Handler - Remove FAQ
// ============================================================================

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'FAQ ID is required' },
        { status: 400 }
      );
    }
    
    // Delete from Supabase
    const { error } = await supabase
      .from('faqs')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[API] Supabase delete error:', error);
      throw new Error(error.message || 'Failed to delete FAQ from database');
    }
    
    return NextResponse.json({
      success: true,
      message: 'FAQ deleted successfully',
    });
  } catch (error: any) {
    console.error('[API] /api/v1/faqs DELETE error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete FAQ' },
      { status: 500 }
    );
  }
}

