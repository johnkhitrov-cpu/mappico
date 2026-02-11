import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { broadcastToUsers } from '@/lib/sseClients';
import { pointUpdateSchema } from '@/lib/validators';
import { rateLimit, createAuthRateLimitKey } from '@/lib/rateLimit';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// DELETE /api/points/:id - Delete point
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;
  const { id: pointId } = await params;

  try {
    // Find the point
    const point = await prisma.point.findUnique({
      where: { id: pointId },
      select: {
        id: true,
        userId: true,
        photoUrl: true,
      },
    });

    // Check if point exists
    if (!point) {
      return NextResponse.json(
        { error: 'Point not found' },
        { status: 404 }
      );
    }

    // Check if user is the owner
    if (point.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own points' },
        { status: 403 }
      );
    }

    // Delete Cloudinary image if exists
    if (point.photoUrl) {
      try {
        // Extract public_id from Cloudinary URL
        // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{format}
        const urlParts = point.photoUrl.split('/');
        const uploadIndex = urlParts.indexOf('upload');

        if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
          // Get everything after version number
          const publicIdWithExt = urlParts.slice(uploadIndex + 2).join('/');
          // Remove file extension
          const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));

          console.log('[DELETE POINT] Deleting Cloudinary image:', publicId);

          const result = await cloudinary.uploader.destroy(publicId);
          console.log('[DELETE POINT] Cloudinary deletion result:', result);
        }
      } catch (cloudinaryError) {
        // Log error but don't block deletion
        console.error('[DELETE POINT] Cloudinary deletion failed:', cloudinaryError);
        console.log('[DELETE POINT] Continuing with database deletion anyway');
      }
    }

    // Delete the point from database
    await prisma.point.delete({
      where: { id: pointId },
    });

    console.log(`Point deleted: ${pointId} by user ${userId}`);

    // Broadcast to friends via SSE
    try {
      // Find all accepted friends
      const friendRequests = await prisma.friendRequest.findMany({
        where: {
          OR: [
            { fromUserId: userId, status: 'accepted' },
            { toUserId: userId, status: 'accepted' },
          ],
        },
        select: {
          fromUserId: true,
          toUserId: true,
        },
      });

      // Extract friend IDs
      const friendIds = friendRequests.map((req) => {
        if (req.fromUserId === userId) {
          return req.toUserId;
        } else {
          return req.fromUserId;
        }
      });

      // Broadcast to friends
      if (friendIds.length > 0) {
        broadcastToUsers(friendIds, 'point_deleted', {
          pointId: pointId,
          userId: userId,
        });
      }
    } catch (broadcastError) {
      // Log but don't fail the request
      console.error('[DELETE POINT] SSE broadcast error:', broadcastError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/points/:id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/points/:id - Update point
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;
  const { id: pointId } = await params;

  // Rate limiting
  const rateLimitKey = createAuthRateLimitKey(userId, '/api/points');
  const rateLimitResult = rateLimit({
    key: rateLimitKey,
    limit: 20,
    windowMs: 60 * 1000, // 1 minute
  });

  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a minute.' },
      {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfterSec.toString(),
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = pointUpdateSchema.parse(body);

    // Validate at least one field is present
    if (!validatedData.title && !validatedData.description && !validatedData.category && !validatedData.photoUrl && !validatedData.removePhoto) {
      return NextResponse.json(
        { error: 'At least one field must be provided' },
        { status: 400 }
      );
    }

    // Find the point
    const point = await prisma.point.findUnique({
      where: { id: pointId },
      select: {
        id: true,
        userId: true,
        photoUrl: true,
      },
    });

    // Check if point exists
    if (!point) {
      return NextResponse.json(
        { error: 'Point not found' },
        { status: 404 }
      );
    }

    // Check if user is the owner
    if (point.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit your own points' },
        { status: 403 }
      );
    }

    // Handle photo changes
    let photoUpdate: { photoUrl?: string | null } = {};
    if (validatedData.removePhoto) {
      photoUpdate = { photoUrl: null };
      // Delete old photo from Cloudinary
      if (point.photoUrl) {
        try {
          const urlParts = point.photoUrl.split('/');
          const uploadIndex = urlParts.indexOf('upload');
          if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
            const publicIdWithExt = urlParts.slice(uploadIndex + 2).join('/');
            const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
            await cloudinary.uploader.destroy(publicId);
          }
        } catch (err) {
          console.error('[PATCH POINT] Cloudinary delete old photo error:', err);
        }
      }
    } else if (validatedData.photoUrl) {
      // Delete old photo from Cloudinary if replacing
      if (point.photoUrl) {
        try {
          const urlParts = point.photoUrl.split('/');
          const uploadIndex = urlParts.indexOf('upload');
          if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
            const publicIdWithExt = urlParts.slice(uploadIndex + 2).join('/');
            const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
            await cloudinary.uploader.destroy(publicId);
          }
        } catch (err) {
          console.error('[PATCH POINT] Cloudinary delete old photo error:', err);
        }
      }
      photoUpdate = { photoUrl: validatedData.photoUrl };
    }

    // Update the point
    const updatedPoint = await prisma.point.update({
      where: { id: pointId },
      data: {
        ...(validatedData.title && { title: validatedData.title }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.category && { category: validatedData.category }),
        ...photoUpdate,
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        title: true,
        description: true,
        photoUrl: true,
        category: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    console.log(`Point updated: ${pointId} by user ${userId}`);

    // Broadcast to friends via SSE
    try {
      // Find all accepted friends
      const friendRequests = await prisma.friendRequest.findMany({
        where: {
          OR: [
            { fromUserId: userId, status: 'accepted' },
            { toUserId: userId, status: 'accepted' },
          ],
        },
        select: {
          fromUserId: true,
          toUserId: true,
        },
      });

      // Extract friend IDs
      const friendIds = friendRequests.map((req) => {
        if (req.fromUserId === userId) {
          return req.toUserId;
        } else {
          return req.fromUserId;
        }
      });

      // Broadcast to friends
      if (friendIds.length > 0) {
        broadcastToUsers(friendIds, 'point_updated', {
          point: {
            id: updatedPoint.id,
            userId: userId,
            userEmail: updatedPoint.user.email,
            lat: updatedPoint.lat,
            lng: updatedPoint.lng,
            title: updatedPoint.title,
            description: updatedPoint.description,
            photoUrl: updatedPoint.photoUrl,
            category: updatedPoint.category,
            createdAt: updatedPoint.createdAt.toISOString(),
          },
        });
      }
    } catch (broadcastError) {
      // Log but don't fail the request
      console.error('[PATCH POINT] SSE broadcast error:', broadcastError);
    }

    return NextResponse.json({ point: updatedPoint });
  } catch (error) {
    console.error('PATCH /api/points/:id error:', error);

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
