import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { pointCreateSchema } from '@/lib/validators';
import { broadcastToUsers } from '@/lib/sseClients';
import { rateLimit, createAuthRateLimitKey } from '@/lib/rateLimit';

// GET /api/points - List my points
export async function GET(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;

  try {
    const points = await prisma.point.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        lat: true,
        lng: true,
        title: true,
        description: true,
        photoUrl: true,
        address: true,
        category: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ points });
  } catch (error) {
    console.error('GET /api/points error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/points - Create point
export async function POST(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;

  // Rate limiting: 20 requests per minute per user
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
    const body = await request.json();
    const validatedData = pointCreateSchema.parse(body);

    // Validate photoUrl if provided (must be from our Cloudinary)
    if (validatedData.photoUrl) {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
      const isValidCloudinaryUrl =
        validatedData.photoUrl.startsWith(`https://res.cloudinary.com/${cloudName}/`) ||
        validatedData.photoUrl.startsWith(`http://res.cloudinary.com/${cloudName}/`);

      if (!isValidCloudinaryUrl) {
        return NextResponse.json(
          { error: 'Invalid image URL. Only Cloudinary URLs from this application are allowed.' },
          { status: 400 }
        );
      }
    }

    const point = await prisma.point.create({
      data: {
        userId,
        lat: validatedData.lat,
        lng: validatedData.lng,
        title: validatedData.title,
        description: validatedData.description || null,
        photoUrl: validatedData.photoUrl || null,
        address: validatedData.address || null,
        category: validatedData.category,
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        title: true,
        description: true,
        photoUrl: true,
        address: true,
        category: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    // Broadcast to friends via SSE
    try {
      console.log('[POINT CREATE] Current userId =', userId);

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

      console.log('[POINT CREATE] Found friend requests:', friendRequests);

      // Extract friend IDs
      const friendIds = friendRequests.map((req) => {
        if (req.fromUserId === userId) {
          return req.toUserId;
        } else {
          return req.fromUserId;
        }
      });

      console.log('[POINT CREATE] Extracted friend IDs:', friendIds);

      // Broadcast to friends (not to self, as frontend handles local update)
      if (friendIds.length > 0) {
        broadcastToUsers(friendIds, 'point_created', {
          point: {
            id: point.id,
            userId: userId,
            userEmail: point.user.email,
            lat: point.lat,
            lng: point.lng,
            title: point.title,
            description: point.description,
            photoUrl: point.photoUrl,
            address: point.address,
            category: point.category,
            createdAt: point.createdAt.toISOString(),
          },
        });
      }
    } catch (broadcastError) {
      // Log but don't fail the request
      console.error('SSE broadcast error:', broadcastError);
    }

    // Return point without user data (client doesn't expect it)
    const { user: _user, ...pointWithoutUser } = point;
    return NextResponse.json({ point: pointWithoutUser }, { status: 201 });
  } catch (error) {
    console.error('POST /api/points error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
