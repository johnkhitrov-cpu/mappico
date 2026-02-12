import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;

  try {
    // Find all accepted friend requests where user is either sender or receiver
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

    // Extract friend IDs (the other user in each request)
    const friendIds = friendRequests.map((req) => {
      if (req.fromUserId === userId) {
        return req.toUserId;
      } else {
        return req.fromUserId;
      }
    });

    // If no friends, return empty array
    if (friendIds.length === 0) {
      return NextResponse.json({ points: [] });
    }

    // Fetch all points from friends
    const friendPoints = await prisma.point.findMany({
      where: {
        userId: {
          in: friendIds,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        userId: true,
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

    // Transform to include userEmail at top level
    const points = friendPoints.map((point) => ({
      id: point.id,
      userId: point.userId,
      userEmail: point.user.email,
      lat: point.lat,
      lng: point.lng,
      title: point.title,
      description: point.description,
      photoUrl: point.photoUrl,
      address: point.address,
      category: point.category,
      createdAt: point.createdAt.toISOString(),
    }));

    return NextResponse.json({ points });
  } catch (error) {
    console.error('GET /api/points/friends error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
