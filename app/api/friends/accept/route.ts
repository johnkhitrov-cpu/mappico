import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const acceptSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
});

export async function POST(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;

  try {
    const body = await request.json();
    const { requestId } = acceptSchema.parse(body);

    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest) {
      return NextResponse.json(
        { error: 'Friend request not found' },
        { status: 404 }
      );
    }

    // Only receiver can accept
    if (friendRequest.toUserId !== userId) {
      return NextResponse.json(
        { error: 'You are not authorized to accept this request' },
        { status: 403 }
      );
    }

    // Check if already accepted
    if (friendRequest.status === 'accepted') {
      return NextResponse.json(
        { error: 'Friend request already accepted' },
        { status: 400 }
      );
    }

    // Update status to accepted
    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'accepted' },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors && error.errors.length > 0
        ? error.errors[0].message
        : 'Validation error';
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }
    console.error('POST /api/friends/accept error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
