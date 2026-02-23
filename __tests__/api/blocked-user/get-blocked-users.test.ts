import { describe, it, expect } from "vitest";
import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { getTestInstance } from "better-auth/test";

describe("API - getBlockedUsers", async () => {
  const { auth, signInWithTestUser } = await getTestInstance({
    plugins: [socialNetwork()],
  }, {
    clientOptions: {
      plugins: [socialNetworkClient()],
    },
  });

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
      const response = await auth.api.getBlockedUsers({
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.blockedUsers).toBeDefined();
      expect(body.blockedUsers.length).toBe(0);
    });
  });
});