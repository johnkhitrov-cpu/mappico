import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { tripCreateSchema } from '@/lib/validators';
import { rateLimit, createAuthRateLimitKey } from '@/lib/rateLimit';

// GET /api/trips - List user's trips or shared trips
// Query params: ?shared=true to get trips shared with user by friends
export async function GET(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;
  const { searchParams } = new URL(request.url);
  const shared = searchParams.get('shared') === 'true';

  try {
    if (shared) {
      // Get trips shared with user by friends
      // 1. Find all confirmed friends
      const friendRequests = await prisma.friendRequest.findMany({
        where: {
          status: 'accepted',
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
        },
        select: {
          fromUserId: true,
          toUserId: true,
        },
      });

      // Extract friend IDs
      const friendIds = friendRequests.map((req) =>
        req.fromUserId === userId ? req.toUserId : req.fromUserId
      );

      if (friendIds.length === 0) {
        // No friends, no shared trips
        return NextResponse.json({ trips: [] });
      }

      // 2. Find trips owned by friends with visibility = FRIENDS
      const trips = await prisma.trip.findMany({
        where: {
          ownerId: { in: friendIds },
          visibility: 'FRIENDS',
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          visibility: true,
          createdAt: true,
          updatedAt: true,
          owner: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json({ trips });
    } else {
      // Get user's own trips
      const trips = await prisma.trip.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          visibility: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({ trips });
    }
  } catch (error) {
    console.error('GET /api/trips error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/trips - Create trip
export async function POST(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;

  // Rate limiting: 20 requests per minute
  const rateLimitKey = createAuthRateLimitKey(userId, '/api/trips');
  const rateLimitResult = rateLimit({
    key: rateLimitKey,
    limit: 20,
    windowMs: 60 * 1000,
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
    const validatedData = tripCreateSchema.parse(body);

    const trip = await prisma.trip.create({
      data: {
        ownerId: userId,
        title: validatedData.title,
        description: validatedData.description || null,
        visibility: validatedData.visibility,
      },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ trip }, { status: 201 });
  } catch (error) {
    console.error('POST /api/trips error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
