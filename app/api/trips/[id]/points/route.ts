import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { tripPointAddSchema } from '@/lib/validators';

// GET /api/trips/[id]/points - List points in trip
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
        { error: 'Forbidden: You can only view your own trips' },
        { status: 403 }
      );
    }

    // Get trip points with point details
    const tripPoints = await prisma.tripPoint.findMany({
      where: { tripId },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' },
      ],
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

    return NextResponse.json({ tripPoints });
  } catch (error) {
    console.error('GET /api/trips/[id]/points error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/trips/[id]/points - Add point to trip
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
    const body = await request.json();
    const validatedData = tripPointAddSchema.parse(body);

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

    // Check point ownership
    const point = await prisma.point.findUnique({
      where: { id: validatedData.pointId },
      select: { userId: true },
    });

    if (!point) {
      return NextResponse.json(
        { error: 'Point not found' },
        { status: 404 }
      );
    }

    if (point.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only add your own points to trips' },
        { status: 403 }
      );
    }

    // Check if already exists (idempotent)
    const existing = await prisma.tripPoint.findUnique({
      where: {
        tripId_pointId: {
          tripId,
          pointId: validatedData.pointId,
        },
      },
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

    if (existing) {
      return NextResponse.json({ tripPoint: existing }, { status: 200 });
    }

    // Create trip point
    const tripPoint = await prisma.tripPoint.create({
      data: {
        tripId,
        pointId: validatedData.pointId,
        order: validatedData.order ?? 0,
        note: validatedData.note || null,
      },
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

    return NextResponse.json({ tripPoint }, { status: 201 });
  } catch (error) {
    console.error('POST /api/trips/[id]/points error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
