import { describe, it, expect } from "vitest";
import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { errorMessageToCode, ERROR_MESSAGES } from "../../../src/error.ts";

describe("API - unblockUser", async () => {
  const { auth, signInWithTestUser } = await getTestInstance({
    plugins: [socialNetwork()],
  }, {
    clientOptions: {
      plugins: [socialNetworkClient()],
    },
  });

  const { runWithUser, user } = await signInWithTestUser();
  await runWithUser(async (headers) => {

    it("should raise an error if blocked user not found", async () => {
      const response = await auth.api.unblockUser({
        body: {
          userId: "non-existent-user-id",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_FOUND));
      expect(body.message).toBe(ERROR_MESSAGES.NOT_FOUND);
    });

    it("should raise an error if blocked user is self", async () => {
      const response = await auth.api.unblockUser({
        body: {
          userId: user.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.SELF_BLOCK_NOT_ALLOWED));
      expect(body.message).toBe(ERROR_MESSAGES.SELF_BLOCK_NOT_ALLOWED);
    });

    it("should return success true if blocked user is now unblocked", async () => {
      const { user: foreignUser, token: tokenForeignUser } = await auth.api.signUpEmail({
        body: {
          name: "Foreign User",
          email: "foreign-user@example.com",
          password: "password",
        },
      });
      expect(foreignUser).toBeDefined();
      expect(tokenForeignUser).toBeDefined();

      const response = await auth.api.blockUser({
        body: {
          userId: foreignUser.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.blockedUser).toBeDefined();
      expect(body.blockedUser.userId).toBe(user.id);
      expect(body.blockedUser.blockedUserId).toBe(foreignUser.id);

      const responseGetBlockedUsersBefore = await auth.api.getBlockedUsers({
        headers,
        asResponse: true,
      });
      const bodyGetBlockedUsersBefore = await responseGetBlockedUsersBefore.json();
      expect(bodyGetBlockedUsersBefore.blockedUsers).toBeDefined();
      expect(bodyGetBlockedUsersBefore.blockedUsers.length).toBe(1);
      expect(bodyGetBlockedUsersBefore.blockedUsers[0].userId).toBe(user.id);
      expect(bodyGetBlockedUsersBefore.blockedUsers[0].blockedUserId).toBe(foreignUser.id);

      const responseUnblock = await auth.api.unblockUser({
        body: {
          userId: foreignUser.id,
        },
        headers,
        asResponse: true,
      });
      const bodyUnblock = await responseUnblock.json();
      expect(bodyUnblock.success).toBe(true);

      const responseGetBlockedUsersAfter = await auth.api.getBlockedUsers({
        headers,
        asResponse: true,
      });
      const bodyGetBlockedUsersAfter = await responseGetBlockedUsersAfter.json();
      expect(bodyGetBlockedUsersAfter.blockedUsers).toBeDefined();
      expect(bodyGetBlockedUsersAfter.blockedUsers.length).toBe(0);
    });

    it("should raise an error if user is found but not blocked", async () => {
      const { user: foreignUser, token: tokenForeignUser } = await auth.api.signUpEmail({
        body: {
          name: "Foreign User",
          email: "foreign-user2@example.com",
          password: "password",
        },
      });
      expect(foreignUser).toBeDefined();
      expect(tokenForeignUser).toBeDefined();

      const response = await auth.api.unblockUser({
        body: {
          userId: foreignUser.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_FOUND));
      expect(body.message).toBe(ERROR_MESSAGES.NOT_FOUND);
    });
  });
});