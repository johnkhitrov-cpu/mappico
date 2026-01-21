import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { pointCreateSchema } from '@/lib/validators';
import { ZodError } from 'zod';

// GET /api/points - List my points
export async function GET(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;

  try {
    const points = await prisma.point.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        lat: true,
        lng: true,
        title: true,
        description: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ points });
  } catch (error) {
    console.error('GET /api/points error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/points - Create point
export async function POST(request: NextRequest) {
  const authResult = getAuthUser(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { userId } = authResult;

  try {
    const body = await request.json();
    const validatedData = pointCreateSchema.parse(body);

    const point = await prisma.point.create({
      data: {
        userId,
        lat: validatedData.lat,
        lng: validatedData.lng,
        title: validatedData.title,
        description: validatedData.description || null,
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        title: true,
        description: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ point }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.errors && error.errors.length > 0
        ? error.errors[0].message
        : 'Validation error';
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }
    console.error('POST /api/points error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
