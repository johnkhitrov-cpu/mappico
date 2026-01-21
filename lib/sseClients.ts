// Global SSE client management
interface SSEClient {
  userId: string;
  controller: ReadableStreamDefaultController;
}

// In-memory store for connected SSE clients
// Use globalThis to persist across hot reloads in development
const globalForSSE = globalThis as typeof globalThis & {
  sseClients?: SSEClient[];
};

if (!globalForSSE.sseClients) {
  globalForSSE.sseClients = [];
}

const sseClients = globalForSSE.sseClients;

export function addSSEClient(userId: string, controller: ReadableStreamDefaultController) {
  sseClients.push({ userId, controller });
  console.log('[SSE ADD]', userId);
  console.log(`SSE client connected: ${userId} (total: ${sseClients.length})`);
}

export function removeSSEClient(userId: string, controller: ReadableStreamDefaultController) {
  const index = sseClients.findIndex(
    (client) => client.userId === userId && client.controller === controller
  );
  if (index !== -1) {
    sseClients.splice(index, 1);
    console.log(`SSE client disconnected: ${userId} (total: ${sseClients.length})`);
  }
}

export function broadcastToUsers(userIds: string[], event: string, data: any) {
  console.log('[SSE BROADCAST] target userIds =', userIds);
  console.log('[SSE CLIENTS]', sseClients.map(c => c.userId));

  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);

  let sentCount = 0;
  for (const client of sseClients) {
    console.log(`[SSE CHECK] comparing client "${client.userId}" with targets`, userIds);
    if (userIds.includes(client.userId)) {
      console.log(`[SSE MATCH] sending to "${client.userId}"`);
      try {
        client.controller.enqueue(encoded);
        sentCount++;
      } catch (error) {
        console.error(`Failed to send SSE to user ${client.userId}:`, error);
      }
    }
  }

  console.log(`Broadcasted ${event} to ${sentCount}/${userIds.length} users`);
}
