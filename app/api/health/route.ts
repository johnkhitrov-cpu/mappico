import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/health - Health check endpoint
export async function GET() {
  try {
    // Simple DB check via Prisma
    await prisma.user.count();

    return NextResponse.json({ ok: true, db: 'up' });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { ok: false, db: 'down' },
      { status: 500 }
    );
  }
}
