import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - Send Friend Request", async () => {
  const { auth, signInWithTestUser } = await getTestInstance(
    {
      plugins: [
        socialNetwork({
          allowSelfFriendRequest: true,
        }),
      ],
    },
    {
      clientOptions: {
        plugins: [socialNetworkClient()],
      },
    },
  );

  const { runWithUser, user } = await signInWithTestUser();
  await runWithUser(async (headers) => {
    it("should raise an error if the other user does not exist", async () => {
      const response = await auth.api.sendFriendRequest({
        body: {
          receiverId: "non-existent-user-id",
        },
        headers,
        asResponse: true,
      });

      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.NOT_FOUND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.NOT_FOUND.message);
    });

    it("should work if the user exist and is not friends with the other user", async () => {
      const response = await auth.api.sendFriendRequest({
        body: {
          receiverId: user.id,
        },
        headers,
        asResponse: true,
      });

      const body = await response.json();
      expect(body.friendRequest).toBeDefined();
      expect(body.friendRequest.senderId).toBe(user.id);
      expect(body.friendRequest.receiverId).toBe(user.id);
      expect(body.friendRequest.status).toBe("pending");
    });

    it("should raise an error if the user has already sent a friend request to the other user", async () => {
      const response = await auth.api.sendFriendRequest({
        body: {
          receiverId: user.id,
        },
        headers,
        asResponse: true,
      });

      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_ALREADY_SENT.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_ALREADY_SENT.message);
    });

    it("should raise an error if users are already friends", async () => {
      const receivedRequests = await auth.api.getFriendRequestsReceived({
        query: {
          status: "pending",
        },
        headers,
      });

      expect(receivedRequests.received.length).toBe(1);
      expect(receivedRequests.received[0].senderId).toBe(user.id);
      expect(receivedRequests.received[0].receiverId).toBe(user.id);
      expect(receivedRequests.received[0].status).toBe("pending");

      const acceptedRequest = await auth.api.acceptFriendRequest({
        body: {
          requestId: receivedRequests.received[0].id,
        },
        headers,
      });

      expect(acceptedRequest.success).toBe(true);

      const friendRequests = await auth.api.getFriendRequestsReceived({
        query: {
          status: "pending",
        },
        headers,
      });

      expect(friendRequests.received.length).toBe(0);

      const response = await auth.api.sendFriendRequest({
        body: {
          receiverId: user.id,
        },
        headers,
        asResponse: true,
      });

      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_ALREADY_FRIENDS.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_ALREADY_FRIENDS.message);
    });
  });
});
