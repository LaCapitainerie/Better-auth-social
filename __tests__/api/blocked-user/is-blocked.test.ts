import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";

describe("API - isBlocked", async () => {
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
    it("should return false if user is not found", async () => {
      const response = await auth.api.isBlocked({
        query: {
          userId: "non-existent-user-id",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.isBlocked).toBe(false);
    });

    it("should return false if user is not blocked", async () => {
      const response = await auth.api.isBlocked({
        query: {
          userId: user.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.isBlocked).toBe(false);
    });

    it("should return true if user is blocked", async () => {
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

      const responseBlock = await auth.api.blockUser({
        body: {
          userId: foreignUser.id,
        },
        headers,
        asResponse: true,
      });
      const bodyBlock = await responseBlock.json();
      expect(bodyBlock.blockedUser).toBeDefined();
      expect(bodyBlock.blockedUser.userId).toBe(user.id);
      expect(bodyBlock.blockedUser.blockedUserId).toBe(foreignUser.id);

      const response = await auth.api.isBlocked({
        query: {
          userId: foreignUser.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.isBlocked).toBe(true);
    });
  });
});
