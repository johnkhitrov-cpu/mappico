import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { pointCreateSchema } from '@/lib/validators';
import { ZodError } from 'zod';
import { broadcastToUsers } from '@/lib/sseClients';

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

  try {
    const body = await request.json();
    const validatedData = pointCreateSchema.parse(body);

    const point = await prisma.point.create({
      data: {
        userId,
        lat: validatedData.lat,
        lng: validatedData.lng,
        title: validatedData.title,
        description: validatedData.description || null,
        photoUrl: validatedData.photoUrl || null,
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        title: true,
        description: true,
        photoUrl: true,
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
    if (error instanceof ZodError) {
      const message = error.errors && error.errors.length > 0
        ? error.errors[0].message
        : 'Validation error';
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }
    console.error('POST /api/points error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
