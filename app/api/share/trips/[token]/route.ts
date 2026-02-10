import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/share/trips/[token] - Public endpoint to view shared trip
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // Find trip by share token
    const trip = await prisma.trip.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: 'Shared trip not found' },
        { status: 404 }
      );
    }

    // Only UNLISTED trips can be accessed via share link
    if (trip.visibility !== 'UNLISTED') {
      return NextResponse.json(
        { error: 'Shared trip not found' },
        { status: 404 }
      );
    }

    // Get trip points
    const tripPoints = await prisma.tripPoint.findMany({
      where: { tripId: trip.id },
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

    return NextResponse.json({
      trip,
      tripPoints,
    });
  } catch (error) {
    console.error('GET /api/share/trips/[token] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
