/**
 * Notification Types
 * 
 * Types for admin-created user notifications
 */

export type NotificationStatus = 'live' | 'removed' | 'scheduled';

export type NotificationTargetAudience = 
  | 'all-users' 
  | 'by-network' 
  | 'by-activity-stakers' 
  | 'by-activity-lps' 
  | 'by-activity-dao';

export type NotificationDeliveryType = 'push' | 'banner' | 'modal';

export type NotificationPriority = 'normal' | 'important' | 'critical';

export interface Notification {
  id: string;
  title: string;
  messageBody: string;
  status: NotificationStatus;
  targetAudience: NotificationTargetAudience;
  deliveryType: NotificationDeliveryType;
  priority: NotificationPriority;
  createdAt: string; // ISO string
  createdBy?: string | null; // Admin user who created it
  scheduledFor?: string | null; // ISO string for scheduled notifications
}

export interface CreateNotificationRequest {
  title: string;
  messageBody: string;
  targetAudience: NotificationTargetAudience;
  deliveryType: NotificationDeliveryType;
  priority: NotificationPriority;
  scheduledFor?: string | null;
  createdBy?: string | null;
}

export interface UpdateNotificationRequest {
  id: string;
  status?: NotificationStatus;
  title?: string;
  messageBody?: string;
  targetAudience?: NotificationTargetAudience;
  deliveryType?: NotificationDeliveryType;
  priority?: NotificationPriority;
}

export interface NotificationsAPIResponse {
  notifications: Notification[];
  total: number;
  unreadCount?: number;
  error?: string;
}

