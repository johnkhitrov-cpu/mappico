import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';

export interface AuthUser {
  userId: string;
  email: string;
}

export function getAuthUser(request: NextRequest): AuthUser | NextResponse {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    return {
      userId: payload.userId,
      email: payload.email,
    };
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
}
