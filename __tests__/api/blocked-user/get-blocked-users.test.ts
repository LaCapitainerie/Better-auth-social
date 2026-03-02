import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";

describe("API - getBlockedUsers", async () => {
  const { auth, signInWithTestUser } = await getTestInstance(
    {
      plugins: [socialNetwork()],
    },
    {
      clientOptions: {
        plugins: [socialNetworkClient()],
      },
    },
  );

  const { runWithUser, user } = await signInWithTestUser();
  await runWithUser(async (headers) => {
    it("should return an empty list if no user was blocked", async () => {
      const response = await auth.api.getBlockedUsers({
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.blockedUsers).toBeDefined();
      expect(body.blockedUsers.length).toBe(0);
    });

    it("should return a user list if user has blocked some users", async () => {
      const { user: foreignUser, token: tokenForeignUser } =
        await auth.api.signUpEmail({
          body: {
            name: "Foreign User",
            email: "foreign-user@example.com",
            password: "password",
          },
        });
      expect(foreignUser).toBeDefined();
      expect(tokenForeignUser).toBeDefined();

      const responseFirstBlock = await auth.api.blockUser({
        body: {
          userId: foreignUser.id,
        },
        headers,
        asResponse: true,
      });
      const bodyFirstBlock = await responseFirstBlock.json();
      expect(bodyFirstBlock.blockedUser).toBeDefined();
      expect(bodyFirstBlock.blockedUser.userId).toBe(user.id);
      expect(bodyFirstBlock.blockedUser.blockedUserId).toBe(foreignUser.id);

      const response = await auth.api.getBlockedUsers({
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.blockedUsers).toBeDefined();
      expect(body.blockedUsers.length).toBe(1);
      expect(body.blockedUsers[0].userId).toBe(user.id);
      expect(body.blockedUsers[0].blockedUserId).toBe(foreignUser.id);
    });
  });
});
