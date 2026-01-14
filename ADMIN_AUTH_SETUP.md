# Admin Authentication Setup Guide

This guide explains how to set up admin authentication for the TIWI Protocol admin dashboard.

## Overview

The admin section now includes:
- **Sign In Page**: `/admin/login` - Secure login with email and password
- **Sign Out**: Available in the user menu dropdown in the admin header
- **Protected Routes**: All admin pages require authentication
- **Session Management**: Automatic session persistence and refresh

## Setup Instructions

### 1. Create Admin User in Supabase

You need to create an admin user in your Supabase project:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **Users**
3. Click **Add User** > **Create new user**
4. Enter:
   - **Email**: Your admin email (e.g., `admin@tiwiprotocol.com`)
   - **Password**: A strong password
   - **Auto Confirm User**: ✅ (checked)
5. Click **Create User**

Alternatively, you can use the Supabase SQL Editor to create a user:

```sql
-- Create admin user (replace with your email and password)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@tiwiprotocol.com',  -- Replace with your admin email
  crypt('your_password_here', gen_salt('bf')),  -- Replace with your password
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Create user metadata
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'admin@tiwiprotocol.com';  -- Replace with your admin email
```

### 2. Verify Environment Variables

Make sure your `.env.local` file (or environment variables) includes:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_publishable_key
```

### 3. Test the Authentication

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/admin` - you should be redirected to `/admin/login`

3. Sign in with your admin credentials:
   - **Email**: The email you created in Supabase
   - **Password**: The password you set

4. After successful login, you'll be redirected to `/admin` dashboard

5. To sign out, click on your user profile in the header and select **Sign Out**

## Features

### Authentication Flow

1. **Unauthenticated Access**: Users trying to access `/admin/*` routes are redirected to `/admin/login`
2. **Authenticated Access**: After login, users can access all admin pages
3. **Session Persistence**: Login sessions are stored in localStorage and persist across page refreshes
4. **Auto Redirect**: Already authenticated users visiting `/admin/login` are redirected to `/admin`

### Security Notes

- All admin routes are protected and require authentication
- Sessions are managed by Supabase Auth
- Passwords are hashed and stored securely in Supabase
- The authentication uses Supabase's built-in security features

## Troubleshooting

### "Invalid email or password" Error

- Verify the user exists in Supabase Authentication > Users
- Check that the email and password are correct
- Ensure the user is confirmed (Auto Confirm User should be checked)

### Redirect Loop

- Clear your browser's localStorage
- Check that your Supabase environment variables are correct
- Verify the Supabase client is properly initialized

### Session Not Persisting

- Check browser console for errors
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` are set correctly
- Ensure cookies/localStorage are enabled in your browser

## File Structure

```
tiwi-super-app/
├── app/
│   └── admin/
│       ├── layout.tsx          # Admin layout with auth provider
│       └── login/
│           └── page.tsx         # Login page
├── components/
│   └── admin/
│       ├── admin-layout.tsx     # Main admin layout with sign out
│       └── admin-protected-route.tsx  # Route protection component
└── lib/
    └── frontend/
        ├── contexts/
        │   └── admin-auth-context.tsx  # Auth context and provider
        └── utils/
            └── supabase-client.ts     # Client-side Supabase client
```

