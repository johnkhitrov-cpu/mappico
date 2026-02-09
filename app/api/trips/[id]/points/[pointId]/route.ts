import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { tripPointUpdateSchema } from '@/lib/validators';

// PATCH /api/trips/[id]/points/[pointId] - Update trip point
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;
  const { id: tripId, pointId } = await params;

  try {
    const body = await request.json();
    const validatedData = tripPointUpdateSchema.parse(body);

    // Check trip ownership
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { ownerId: true },
    });

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    if (trip.ownerId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only modify your own trips' },
        { status: 403 }
      );
    }

    // Check if trip point exists
    const existingTripPoint = await prisma.tripPoint.findUnique({
      where: {
        tripId_pointId: {
          tripId,
          pointId,
        },
      },
    });

    if (!existingTripPoint) {
      return NextResponse.json(
        { error: 'Point not found in this trip' },
        { status: 404 }
      );
    }

    // Build update data (only provided fields)
    const updateData: any = {};
    if (validatedData.order !== undefined) {
      updateData.order = validatedData.order;
    }
    if (validatedData.note !== undefined) {
      updateData.note = validatedData.note;
    }

    // Update trip point
    const tripPoint = await prisma.tripPoint.update({
      where: {
        tripId_pointId: {
          tripId,
          pointId,
        },
      },
      data: updateData,
      include: {
        point: {
          select: {
            id: true,
            lat: true,
            lng: true,
            title: true,
            description: true,
            photoUrl: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({ tripPoint });
  } catch (error) {
    console.error('PATCH /api/trips/[id]/points/[pointId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/trips/[id]/points/[pointId] - Remove point from trip
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;
  const { id: tripId, pointId } = await params;

  try {
    // Check trip ownership
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { ownerId: true },
    });

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    if (trip.ownerId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only modify your own trips' },
        { status: 403 }
      );
    }

    // Check if trip point exists
    const existingTripPoint = await prisma.tripPoint.findUnique({
      where: {
        tripId_pointId: {
          tripId,
          pointId,
        },
      },
    });

    if (!existingTripPoint) {
      return NextResponse.json(
        { error: 'Point not found in this trip' },
        { status: 404 }
      );
    }

    // Delete trip point
    await prisma.tripPoint.delete({
      where: {
        tripId_pointId: {
          tripId,
          pointId,
        },
      },
    });

    console.log(`Point ${pointId} removed from trip ${tripId} by user ${userId}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/trips/[id]/points/[pointId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
