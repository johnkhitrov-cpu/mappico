import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validators';
import { signToken } from '@/lib/auth';
import { rateLimit, getClientIp, createRateLimitKey } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = loginSchema.parse(body);

    // Rate limiting: 10 requests per minute per IP+email
    const clientIp = getClientIp(request);
    const rateLimitKey = createRateLimitKey(clientIp, '/api/auth/login', validatedData.email);
    const rateLimitResult = rateLimit({
      key: rateLimitKey,
      limit: 10,
      windowMs: 60 * 1000, // 1 minute
    });

    if (!rateLimitResult.ok) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again in a minute.' },
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

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(
      validatedData.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });

  } catch (error) {
    // Handle JWT_SECRET missing error
    if (error instanceof Error && error.message.includes('JWT_SECRET')) {
      console.error('Login error:', error);
      return NextResponse.json(
        { error: 'Server misconfigured: JWT_SECRET missing' },
        { status: 500 }
      );
    }

    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
