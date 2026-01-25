import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { rateLimit, createAuthRateLimitKey } from '@/lib/rateLimit';

const requestSchema = z.object({
  toEmail: z.string().email('Invalid email format'),
});

export async function POST(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;

  // Rate limiting: 10 requests per minute per user
  const rateLimitKey = createAuthRateLimitKey(userId, '/api/friends/request');
  const rateLimitResult = rateLimit({
    key: rateLimitKey,
    limit: 10,
    windowMs: 60 * 1000, // 1 minute
  });

  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { error: 'Too many friend requests. Try again in a minute.' },
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
    const { toEmail } = requestSchema.parse(body);

    // Find target user by email
    const toUser = await prisma.user.findUnique({
      where: { email: toEmail },
    });

    if (!toUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Cannot send request to self
    if (toUser.id === userId) {
      return NextResponse.json(
        { error: 'Cannot send friend request to yourself' },
        { status: 400 }
      );
    }

    // Check if request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: userId, toUserId: toUser.id },
          { fromUserId: toUser.id, toUserId: userId },
        ],
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'Friend request already exists' },
        { status: 400 }
      );
    }

    // Create friend request
    await prisma.friendRequest.create({
      data: {
        fromUserId: userId,
        toUserId: toUser.id,
        status: 'pending',
      },
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
    console.error('POST /api/friends/request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
