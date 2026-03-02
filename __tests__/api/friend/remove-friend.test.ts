import { describe, expect, it } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - Remove Friend", async () => {
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
    it("should raise an error if user does not exist", async () => {
      const response = await auth.api.removeFriend({
        body: {
          friendId: "id-that-does-not-exist",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();

      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.NOT_A_FRIEND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.NOT_A_FRIEND.message);
    });

    it("should raise an error if user is not a friend", async () => {
      const response = await auth.api.removeFriend({
        body: {
          friendId: user.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.NOT_A_FRIEND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.NOT_A_FRIEND.message);
    });

    it("should return true if user is a friend", async () => {
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

      const response = await auth.api.removeFriend({
        body: {
          friendId: user.id,
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
      expect(friend.isFriend).toBe(false);
    });
  });
});
