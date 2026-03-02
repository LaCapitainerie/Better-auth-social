import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - Get or Create Chat", async () => {
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
    it("should raise an error if foreignUser is not a friend", async () => {
      const response = await auth.api.getOrCreateChat({
        query: {
          friendId: "foreign-user-id",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.NOT_A_FRIEND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.NOT_A_FRIEND.message);
    });

    it("should return Chat ref if foreignUser is a friend and no chat exist with him", async () => {
      const { friendRequest } = await auth.api.sendFriendRequest({
        body: {
          receiverId: user.id,
        },
        headers,
      });
      expect(friendRequest).toBeDefined();
      expect(friendRequest.senderId).toBe(user.id);
      expect(friendRequest.receiverId).toBe(user.id);
      expect(friendRequest.status).toBe("pending");

      const { success: acceptFriendRequestSuccess } =
        await auth.api.acceptFriendRequest({
          body: {
            requestId: friendRequest.id,
          },
          headers,
        });
      expect(acceptFriendRequestSuccess).toBe(true);

      const response = await auth.api.getOrCreateChat({
        query: {
          friendId: user.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.chat).toBeDefined();
      expect(body.chat.user1Id).toBe(user.id);
      expect(body.chat.user2Id).toBe(user.id);
    });

    it("should return Chat ref if foreignUser is a friend and a chat already exist with him", async () => {
      const response = await auth.api.getOrCreateChat({
        query: {
          friendId: user.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.chat).toBeDefined();
      expect(body.chat.user1Id).toBe(user.id);
      expect(body.chat.user2Id).toBe(user.id);
    });
  });
});
