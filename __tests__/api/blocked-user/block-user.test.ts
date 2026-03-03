import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - blockUser", async () => {
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
    it("should raise an error if user not found", async () => {
      const response = await auth.api.blockUser({
        body: {
          userId: "non-existent-user-id",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_FAILED_TO_BLOCK.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_FAILED_TO_BLOCK.message);
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
      expect(body.code).toBe(
        SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_SELF_BLOCK_NOT_ALLOWED.code,
      );
      expect(body.message).toBe(
        SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_SELF_BLOCK_NOT_ALLOWED.message,
      );
    });

    it("should return success true if user is now blocked", async () => {
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
      const { user: foreignUser, token: tokenForeignUser } =
        await auth.api.signUpEmail({
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
      expect(bodySecondBlock.code).toBe(
        SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_ALREADY_BLOCKED.code,
      );
      expect(bodySecondBlock.message).toBe(
        SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_ALREADY_BLOCKED.message,
      );
    });
  });
});
