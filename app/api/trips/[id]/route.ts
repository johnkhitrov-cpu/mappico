import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { tripUpdateSchema } from '@/lib/validators';
import { rateLimit, createAuthRateLimitKey } from '@/lib/rateLimit';

// GET /api/trips/[id]
export async function GET(
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
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        ownerId: true,
        title: true,
        description: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Ownership check
    if (trip.ownerId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only view your own trips' },
        { status: 403 }
      );
    }

    // Remove ownerId before response
    const { ownerId: _ownerId, ...tripWithoutOwner } = trip;
    return NextResponse.json({ trip: tripWithoutOwner });
  } catch (error) {
    console.error('GET /api/trips/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/trips/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;
  const { id: tripId } = await params;

  // Rate limiting
  const rateLimitKey = createAuthRateLimitKey(userId, '/api/trips/[id]');
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
    // Check ownership
    const existingTrip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { ownerId: true },
    });

    if (!existingTrip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    if (existingTrip.ownerId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only update your own trips' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = tripUpdateSchema.parse(body);

    // Build update data (only provided fields)
    const updateData: any = {};
    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }
    if (validatedData.visibility !== undefined) {
      updateData.visibility = validatedData.visibility;
    }

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: updateData,
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ trip });
  } catch (error) {
    console.error('PATCH /api/trips/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/trips/[id]
export async function DELETE(
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
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        ownerId: true,
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
        { error: 'Forbidden: You can only delete your own trips' },
        { status: 403 }
      );
    }

    await prisma.trip.delete({
      where: { id: tripId },
    });

    console.log(`Trip deleted: ${tripId} by user ${userId}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/trips/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
