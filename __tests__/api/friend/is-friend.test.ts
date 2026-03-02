import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";

describe("API - Is Friend", async () => {
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
    it("should return false if user does not exist", async () => {
      const response = await auth.api.isFriend({
        query: {
          friendId: "id-that-does-not-exist",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.isFriend).toBe(false);
    });

    it("should return false if the user is not a friend", async () => {
      const response = await auth.api.isFriend({
        query: {
          friendId: user.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.isFriend).toBe(false);
    });

    it("should return true if the user is a friend", async () => {
      const { friendRequest } = await auth.api.sendFriendRequest({
        body: {
          receiverId: user.id,
        },
        headers,
      });

      await auth.api.acceptFriendRequest({
        body: {
          requestId: friendRequest.id,
        },
        headers,
      });

      const response = await auth.api.isFriend({
        query: {
          friendId: friendRequest.receiverId,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.isFriend).toBe(true);
    });
  });
});
