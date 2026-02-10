import { prisma } from './prisma';

/**
 * Check if two users are confirmed friends
 * @param userId1 First user ID
 * @param userId2 Second user ID
 * @returns true if they are friends (status = 'accepted'), false otherwise
 */
export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  if (userId1 === userId2) {
    return false; // User is not their own friend
  }

  const friendRequest = await prisma.friendRequest.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { fromUserId: userId1, toUserId: userId2 },
        { fromUserId: userId2, toUserId: userId1 },
      ],
    },
  });

  return !!friendRequest;
}
