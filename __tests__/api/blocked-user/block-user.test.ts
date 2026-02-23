import { describe, it, expect } from "vitest";
import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { errorMessageToCode, ERROR_MESSAGES } from "../../../src/error.ts";

describe("API - blockUser", async () => {
  const { auth, signInWithTestUser } = await getTestInstance({
    plugins: [socialNetwork()],
  }, {
    clientOptions: {
      plugins: [socialNetworkClient()],
    },
  });

  const { runWithUser, user } = await signInWithTestUser();
  await runWithUser(async (headers) => {

    it("should raise an error if user not found", async () => {
      const response = await auth.api.blockUser({
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

    it("should raise an error if user is self", async () => {
      const response = await auth.api.blockUser({
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

    it("should return success true if user is now blocked", async () => {
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
    });

    it("should raise an error if user is found but already blocked", async () => {
      const { user: foreignUser, token: tokenForeignUser } = await auth.api.signUpEmail({
        body: {
          name: "Foreign User",
          email: "foreign-user2@example.com",
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

      const responseSecondBlock = await auth.api.blockUser({
        body: {
          userId: foreignUser.id,
        },
        headers,
        asResponse: true,
      });
      const bodySecondBlock = await responseSecondBlock.json();
      expect(bodySecondBlock.code).toBe(errorMessageToCode(ERROR_MESSAGES.ALREADY_BLOCKED));
      expect(bodySecondBlock.message).toBe(ERROR_MESSAGES.ALREADY_BLOCKED);
    });
  });
});