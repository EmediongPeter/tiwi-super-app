# Supabase Storage Setup for Tutorial Thumbnails

## Overview
The tutorial thumbnail upload feature requires a Supabase Storage bucket named `tutorials` to store uploaded images.

## Setup Instructions

### 1. Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Name the bucket: `tutorials`
5. Set it as **Public** (so images can be accessed via public URLs)
6. Click **Create bucket**

### 2. Configure Bucket Policies (Optional but Recommended)

For public access, you can set up policies:

```sql
-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'tutorials');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tutorials' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own uploads
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tutorials' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tutorials' 
  AND auth.role() = 'authenticated'
);
```

### 3. File Size and Type Limits

- **Max file size**: 5MB (configured in `/app/api/v1/upload/route.ts`)
- **Allowed types**: JPEG, JPG, PNG, GIF, WebP
- **Recommended dimensions**: 400x300px

### 4. Storage Structure

Files are stored in the following structure:
```
tutorials/
  ├── {timestamp}-{random}.{ext}
  ├── {timestamp}-{random}.{ext}
  └── ...
```

### 5. Environment Variables

Make sure you have these environment variables set:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` - Your Supabase anon/public key

## Testing

After setup, you can test the upload functionality:
1. Go to Admin → Support Hub → Tutorials
2. Click "Add Tutorial"
3. Fill in the form
4. Click "Browse File" to select an image
5. The image should upload and display a preview
6. Submit the form

## Troubleshooting

### Error: "Bucket not found"
- Make sure the bucket is named exactly `tutorials`
- Check that the bucket exists in your Supabase Storage

### Error: "Permission denied"
- Check bucket policies
- Ensure the bucket is set to Public if using public access
- Verify your Supabase keys are correct

### Error: "File size exceeds limit"
- The file must be under 5MB
- Compress the image if needed

### Images not displaying
- Check that the bucket is Public
- Verify the public URL is accessible
- Check browser console for CORS errors

