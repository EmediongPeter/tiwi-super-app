/**
 * Notifications API Route
 * 
 * Endpoint for creating and retrieving admin-created user notifications.
 * Uses Supabase database for persistent storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Notification, CreateNotificationRequest, UpdateNotificationRequest, NotificationsAPIResponse } from '@/lib/shared/types/notifications';
import { supabase } from '@/lib/backend/utils/supabase';

// ============================================================================
// GET Handler - Retrieve notifications
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') as Notification['status'] | null;
    const userWallet = searchParams.get('userWallet');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    
    // Build Supabase query
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(error.message || 'Failed to fetch notifications from database');
    }
    
    // If userWallet is provided, check which notifications have been viewed
    let viewedNotificationIds: Set<string> = new Set();
    if (userWallet) {
      const { data: views } = await supabase
        .from('notification_views')
        .select('notification_id')
        .eq('user_wallet', userWallet);
      
      if (views) {
        viewedNotificationIds = new Set(views.map(v => v.notification_id));
      }
    }
    
    // Map database rows to Notification interface
    let notifications: Notification[] = (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      messageBody: row.message_body,
      status: row.status,
      targetAudience: row.target_audience,
      deliveryType: row.delivery_type,
      priority: row.priority,
      createdAt: row.created_at,
      createdBy: row.created_by || undefined,
      scheduledFor: row.scheduled_for || undefined,
    }));
    
    // Filter to unread only if requested
    if (unreadOnly && userWallet) {
      notifications = notifications.filter(n => !viewedNotificationIds.has(n.id));
    }
    
    // Calculate unread count if userWallet is provided
    let unreadCount = 0;
    if (userWallet) {
      unreadCount = notifications.filter(n => !viewedNotificationIds.has(n.id)).length;
    }
    
    const response: NotificationsAPIResponse = {
      notifications,
      total: notifications.length,
      unreadCount: userWallet ? unreadCount : undefined,
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] /api/v1/notifications GET error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to fetch notifications', 
        notifications: [],
        total: 0,
        unreadCount: 0,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Create a new notification
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body: CreateNotificationRequest = await req.json();
    
    // Validate required fields
    if (!body.title || !body.messageBody || !body.targetAudience || !body.deliveryType) {
      return NextResponse.json(
        { error: 'title, messageBody, targetAudience, and deliveryType are required' },
        { status: 400 }
      );
    }
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        title: body.title,
        message_body: body.messageBody,
        status: body.scheduledFor ? 'scheduled' : 'live',
        target_audience: body.targetAudience,
        delivery_type: body.deliveryType,
        priority: body.priority || 'normal',
        created_by: body.createdBy || null,
        scheduled_for: body.scheduledFor || null,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[API] Supabase insert error:', error);
      throw new Error(error.message || 'Failed to create notification in database');
    }
    
    // Map database row to Notification interface
    const newNotification: Notification = {
      id: data.id,
      title: data.title,
      messageBody: data.message_body,
      status: data.status,
      targetAudience: data.target_audience,
      deliveryType: data.delivery_type,
      priority: data.priority,
      createdAt: data.created_at,
      createdBy: data.created_by || undefined,
      scheduledFor: data.scheduled_for || undefined,
    };
    
    return NextResponse.json(
      { 
        success: true,
        notification: newNotification,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API] /api/v1/notifications POST error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to create notification', 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH Handler - Update notification
// ============================================================================

export async function PATCH(req: NextRequest) {
  try {
    const body: UpdateNotificationRequest = await req.json();
    const { id, ...updateFields } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }
    
    // Build update object (only include provided fields)
    const updateData: any = {};
    
    if (updateFields.status !== undefined) {
      updateData.status = updateFields.status;
    }
    if (updateFields.title !== undefined) {
      updateData.title = updateFields.title;
    }
    if (updateFields.messageBody !== undefined) {
      updateData.message_body = updateFields.messageBody;
    }
    if (updateFields.targetAudience !== undefined) {
      updateData.target_audience = updateFields.targetAudience;
    }
    if (updateFields.deliveryType !== undefined) {
      updateData.delivery_type = updateFields.deliveryType;
    }
    if (updateFields.priority !== undefined) {
      updateData.priority = updateFields.priority;
    }
    
    const { data, error } = await supabase
      .from('notifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[API] Supabase update error:', error);
      if (error.code === 'PGRST116') {
        // No rows returned - notification not found
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        );
      }
      throw new Error(error.message || 'Failed to update notification in database');
    }
    
    // Map database row to Notification interface
    const updatedNotification: Notification = {
      id: data.id,
      title: data.title,
      messageBody: data.message_body,
      status: data.status,
      targetAudience: data.target_audience,
      deliveryType: data.delivery_type,
      priority: data.priority,
      createdAt: data.created_at,
      createdBy: data.created_by || undefined,
      scheduledFor: data.scheduled_for || undefined,
    };
    
    return NextResponse.json(
      { 
        success: true,
        notification: updatedNotification,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] /api/v1/notifications PATCH error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to update notification', 
      },
      { status: 500 }
    );
  }
}

