import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

// POST /api/trips/[id]/share-token - Generate or retrieve share token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;
  const { id: tripId } = await params;

  try {
    // Check trip ownership and visibility
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        ownerId: true,
        visibility: true,
        shareToken: true,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    if (trip.ownerId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: Only the owner can generate a share link' },
        { status: 403 }
      );
    }

    if (trip.visibility !== 'UNLISTED') {
      return NextResponse.json(
        { error: 'Trip must have UNLISTED visibility to generate a share link' },
        { status: 400 }
      );
    }

    // Build base URL from request origin
    const origin = request.headers.get('origin') ||
                   process.env.NEXT_PUBLIC_BASE_URL ||
                   'http://localhost:3000';

    // If token already exists, return it
    if (trip.shareToken) {
      const shareUrl = `${origin}/share/trips/${trip.shareToken}`;
      return NextResponse.json({ shareUrl, shareToken: trip.shareToken });
    }

    // Generate new token (32 bytes = 64 hex characters)
    const shareToken = randomBytes(32).toString('hex');

    // Update trip with new share token
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        shareToken,
        shareTokenCreatedAt: new Date(),
      },
    });

    const shareUrl = `${origin}/share/trips/${shareToken}`;

    return NextResponse.json({ shareUrl, shareToken });
  } catch (error) {
    // Log full error server-side for debugging
    console.error('POST /api/trips/[id]/share-token error:', error);

    // Return sanitized error to client (no stack traces or module paths)
    return NextResponse.json(
      { error: 'Failed to generate share link' },
      { status: 500 }
    );
  }
}
