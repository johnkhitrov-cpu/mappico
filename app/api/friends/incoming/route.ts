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
    const requests = await prisma.friendRequest.findMany({
      where: {
        toUserId: userId,
        status: 'pending',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        createdAt: true,
        fromUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('GET /api/friends/incoming error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
