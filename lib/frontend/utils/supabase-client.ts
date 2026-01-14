/**
 * Client-side Supabase Client for Authentication
 * 
 * Creates a Supabase client instance for browser-side authentication.
 * This client persists sessions in localStorage.
 */

'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    '[Supabase Client] Missing Supabase environment variables. ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY'
  );
}

// Create Supabase client for client-side authentication
// This client persists sessions in localStorage
export const supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

