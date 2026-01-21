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
        fromUser: {
          select: {
            id: true,
            email: true,
          },
        },
        toUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Normalize to a list of friends (the other user in each request)
    const friends = friendRequests.map((req) => {
      if (req.fromUserId === userId) {
        return req.toUser;
      } else {
        return req.fromUser;
      }
    });

    return NextResponse.json({ friends });
  } catch (error) {
    console.error('GET /api/friends/list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
