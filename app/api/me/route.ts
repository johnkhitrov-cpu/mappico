import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { profileUpdateSchema } from '@/lib/validators';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function deleteCloudinaryImage(url: string) {
  try {
    const urlParts = url.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
      const publicIdWithExt = urlParts.slice(uploadIndex + 2).join('/');
      const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
      return cloudinary.uploader.destroy(publicId);
    }
  } catch (err) {
    console.error('[PROFILE] Cloudinary delete error:', err);
  }
}

export async function GET(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('GET /api/me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;

  try {
    const body = await request.json();
    const validatedData = profileUpdateSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (validatedData.firstName !== undefined) {
      updateData.firstName = validatedData.firstName;
    }
    if (validatedData.lastName !== undefined) {
      updateData.lastName = validatedData.lastName;
    }

    // Handle avatar changes
    if (validatedData.removeAvatar) {
      updateData.avatarUrl = null;
      if (existingUser.avatarUrl) {
        await deleteCloudinaryImage(existingUser.avatarUrl);
      }
    } else if (validatedData.avatarUrl !== undefined) {
      if (existingUser.avatarUrl) {
        await deleteCloudinaryImage(existingUser.avatarUrl);
      }
      updateData.avatarUrl = validatedData.avatarUrl;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('PATCH /api/me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
