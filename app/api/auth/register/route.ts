import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validators';
import { ZodError } from 'zod';
import { rateLimit, getClientIp, createRateLimitKey } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = registerSchema.parse(body);

    // Rate limiting: 5 requests per minute per IP+email
    const clientIp = getClientIp(request);
    const rateLimitKey = createRateLimitKey(clientIp, '/api/auth/register', validatedData.email);
    const rateLimitResult = rateLimit({
      key: rateLimitKey,
      limit: 5,
      windowMs: 60 * 1000, // 1 minute
    });

    if (!rateLimitResult.ok) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Try again in a minute.' },
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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 10);

    // Create user
    await prisma.user.create({
      data: {
        email: validatedData.email,
        passwordHash,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
