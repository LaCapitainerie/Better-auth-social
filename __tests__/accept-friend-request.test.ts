import { describe, it, expect } from "vitest";
import { socialNetwork } from "../src/index.ts";
import { socialNetworkClient } from "../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { ERROR_MESSAGES, errorMessageToCode } from "../src/error.ts";

describe("API - Accept Friend Request", async () => {
  const { auth, signInWithTestUser } = await getTestInstance({
    plugins: [socialNetwork()],
  }, {
    clientOptions: {
      plugins: [socialNetworkClient()],
    },
  });

  const { runWithUser, user } = await signInWithTestUser();
  await runWithUser(async (headers) => {

    it("should raise an error if the friend request does not exist", async () => {
      const response = await auth.api.acceptFriendRequest({
        body: {
          requestId: "non-existent-request-id",
        },
        headers,
        asResponse: true,
      });

      const body = await response.json();
			expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_FOUND));
			expect(body.message).toBe(ERROR_MESSAGES.NOT_FOUND);
    });

    it("should work if the friend request exists and is pending", async () => {
      const { friendRequest } = await auth.api.sendFriendRequest({
        body: {
          receiverId: user.id,
        },
        headers,
      });

      expect(friendRequest).toBeDefined();
      expect(friendRequest.senderId).toBe(user.id);
      expect(friendRequest.receiverId).toBe(user.id);
      expect(friendRequest.status).toBe('pending');

      const response = await auth.api.acceptFriendRequest({
        body: {
          requestId: friendRequest.id,
        },
        headers,
        asResponse: true,
      });

      const body = await response.json();
      expect(body.success).toBe(true);

      const friend = await auth.api.isFriend({
        query: {
          friendId: user.id,
        },
        headers,
      });
      expect(friend.isFriend).toBe(true);
    });

    it("should raise an error if the friend request is already accepted", async () => {

      const { received } = await auth.api.listFriendRequestsReceived({
        query: {
          status: 'accepted',
        },
        headers,
      });

      expect(received.length).toBe(1);

      const response = await auth.api.acceptFriendRequest({
        body: {
          requestId: received[0].id,
        },
        headers,
        asResponse: true,
      });

      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_PENDING));
      expect(body.message).toBe(ERROR_MESSAGES.NOT_PENDING);
    });

    it("should raise an error if the friend request is already rejected", async () => {
      
      const { success: removeFriendSuccess } = await auth.api.removeFriend({
        body: {
          friendId: user.id,
        },
        headers,
      });
      
      expect(removeFriendSuccess).toBe(true);

      const { friendRequest } = await auth.api.sendFriendRequest({
        body: {
          receiverId: user.id,
        },
        headers,
      });
      
      expect(friendRequest).toBeDefined();
      expect(friendRequest.senderId).toBe(user.id);
      expect(friendRequest.receiverId).toBe(user.id);
      expect(friendRequest.status).toBe('pending');

      const { success: rejectFriendRequestSuccess } = await auth.api.rejectFriendRequest({
        body: {
          requestId: friendRequest.id,
        },
        headers,
      });

      expect(rejectFriendRequestSuccess).toBe(true);

      const friend = await auth.api.isFriend({
        query: {
          friendId: user.id,
        },
        headers,
      });
      expect(friend.isFriend).toBe(false);

      const response = await auth.api.acceptFriendRequest({
        body: {
          requestId: friendRequest.id,
        },
        headers,
        asResponse: true,
      });

      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_PENDING));
      expect(body.message).toBe(ERROR_MESSAGES.NOT_PENDING);
    });
  });

});