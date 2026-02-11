import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';

// Validation constants
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

export async function POST(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 20MB limit' },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, and WEBP images are allowed' },
        { status: 400 }
      );
    }

    // Validate file extension (extra security against renamed files)
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext =>
      fileName.endsWith(`.${ext}`)
    );

    if (!hasValidExtension) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, and WEBP images are allowed' },
        { status: 400 }
      );
    }

    // File is valid
    return NextResponse.json({
      valid: true,
      size: file.size,
      type: file.type,
      name: file.name,
    });
  } catch (error) {
    console.error('POST /api/upload/validate error:', error);
    return NextResponse.json(
      { error: 'Failed to validate file' },
      { status: 500 }
    );
  }
}
