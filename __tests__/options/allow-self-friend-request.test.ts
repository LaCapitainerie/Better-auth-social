import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../src/index.ts";
import { socialNetworkClient } from "../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../src/error.ts";

describe("Options - Allow Self Friend Request", async () => {
  describe("with allowSelfFriendRequest set to false", async () => {
    const { auth, signInWithTestUser } = await getTestInstance(
      {
        plugins: [
          socialNetwork({
            allowSelfFriendRequest: false,
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
      it("should raise an error if the user tries to send a friend request to themselves", async () => {
        const response = await auth.api.sendFriendRequest({
          body: {
            receiverId: user.id,
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();
        expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.SELF_REQUEST_NOT_ALLOWED.code);
        expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.SELF_REQUEST_NOT_ALLOWED.message);
      });
    });
  });

  describe("with allowSelfFriendRequest set to true", async () => {
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
      it("should work if the user tries to send a friend request to themselves", async () => {
        const response = await auth.api.sendFriendRequest({
          body: {
            receiverId: user.id,
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();
        expect(body.friendRequest).toBeDefined();
        expect(body.friendRequest.senderId).toBe(user.id);
        expect(body.friendRequest.receiverId).toBe(user.id);
        expect(body.friendRequest.status).toBe("pending");
      });
    });
  });
});
