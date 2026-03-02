import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";

describe("API - Get Friends", async () => {
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
    it("should return an empty array if the user has no friends", async () => {
      const { friends } = await auth.api.getFriends({
        headers,
      });
      expect(friends.length).toBe(0);
    });

    it("should return the friends of the user", async () => {
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

      const { friends } = await auth.api.getFriends({
        headers,
      });
      expect(friends.length).toBe(1);
      expect(friends[0].userId).toBe(user.id);
      expect(friends[0].friendId).toBe(user.id);
    });
  });
});
