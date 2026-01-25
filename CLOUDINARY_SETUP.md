# Cloudinary Upload Preset Setup

This document explains how to create an unsigned upload preset in Cloudinary for secure image uploads.

## Why Unsigned Upload Preset?

- **Security**: Validates file types and sizes server-side at Cloudinary
- **No Signature Required**: Frontend can upload directly without backend signing
- **Consistent Restrictions**: Enforced at both client and Cloudinary levels

## Setup Instructions

### 1. Log in to Cloudinary Dashboard

Visit [https://cloudinary.com/console](https://cloudinary.com/console) and log in.

### 2. Navigate to Upload Presets

1. Click on **Settings** (gear icon) in the top right
2. In the left sidebar, click **Upload**
3. Scroll down to **Upload presets** section
4. Click **Add upload preset**

### 3. Configure the Preset

**Basic Settings:**
- **Preset name**: `mappico_unsigned`
- **Signing Mode**: **Unsigned** (important!)
- **Folder**: `mappico`

**Media Analysis and AI:**
- Leave default settings

**Upload manipulations:**
- **Allowed formats**: `jpg,jpeg,png,webp`
- **Max file size**: `5242880` (5MB in bytes)

**Eager transformations** (Optional but recommended):
- Click **Add eager transformation**
- **Width**: `1600`
- **Quality**: `auto`
- **Crop**: `limit`

This will automatically resize large images to max 1600px width while maintaining aspect ratio.

**Access Control:**
- **Access mode**: `public` (default)

### 4. Save the Preset

Click **Save** at the bottom of the page.

### 5. Update Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=mappico_unsigned
```

Replace `your_cloud_name_here` with your actual Cloudinary cloud name (found in Dashboard > Settings > Account).

## Validation Flow

### Client-Side (Browser)
1. File selected by user
2. JavaScript validates:
   - File size ≤ 5MB
   - File type in [image/jpeg, image/png, image/webp]
   - File extension matches [.jpg, .jpeg, .png, .webp]
3. If invalid: Show error, clear file input
4. If valid: Show preview, allow upload

### Cloudinary-Side (Upload)
1. File uploaded to Cloudinary with preset
2. Cloudinary validates:
   - File format allowed (jpg, jpeg, png, webp)
   - File size ≤ 5MB
3. If invalid: Upload rejected with error
4. If valid: Image stored, URL returned

### Backend-Side (Point Creation)
1. photoUrl received from frontend
2. Backend validates:
   - URL must start with `https://res.cloudinary.com/YOUR_CLOUD_NAME/`
3. If invalid: 400 error
4. If valid: Point saved to database

## Security Benefits

1. **Type Validation**: Prevents .exe renamed to .jpg attacks
2. **Size Limits**: Prevents storage abuse
3. **URL Allowlist**: Prevents external/malicious image URLs
4. **Cloudinary Enforcement**: Double-check at upload time
5. **No Client Secrets**: Unsigned preset doesn't expose API keys

## Testing

After setup, test:

1. ✅ Upload valid JPG/PNG/WEBP under 5MB → Success
2. ❌ Upload PDF renamed to .jpg → Rejected
3. ❌ Upload 6MB image → Rejected
4. ❌ Try setting external photoUrl → Rejected

## Troubleshooting

### "Upload preset not found" error
- Verify preset name is exactly `mappico_unsigned`
- Check that it's set to **Unsigned** mode
- Ensure `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` env var matches

### "File size exceeds limit" error
- Verify max file size in preset is set to 5242880 bytes
- Check client-side validation matches (5 * 1024 * 1024)

### "Invalid image URL" error on point creation
- Verify `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` matches your actual cloud name
- Check photoUrl starts with `https://res.cloudinary.com/YOUR_CLOUD_NAME/`

## Production Deployment

When deploying to production:

1. Set environment variables in your hosting platform (Vercel, etc.)
2. Ensure `NEXT_PUBLIC_` variables are set at build time
3. Verify Cloudinary preset exists and is properly configured
4. Test uploads in production environment
