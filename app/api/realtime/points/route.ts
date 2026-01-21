import { NextRequest, NextResponse } from 'next/server';
import { addSSEClient, removeSSEClient } from '@/lib/sseClients';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export async function GET(request: NextRequest) {
  // EventSource doesn't support custom headers, so we accept token via query param
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify JWT token
  let userId: string;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
    console.log('[SSE CONNECT] userId =', userId);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Create a new ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Add client to global list
      addSSEClient(userId, controller);

      // Send initial connection message
      const encoder = new TextEncoder();
      const message = encoder.encode(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);
      controller.enqueue(message);

      // Set up cleanup on connection close
      request.signal.addEventListener('abort', () => {
        removeSSEClient(userId, controller);
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      });
    },
  });

  // Return response with SSE headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
