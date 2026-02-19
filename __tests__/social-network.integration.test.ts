import { describe, it, expect } from "vitest";
import { socialNetwork } from "../src/index.ts";
import { socialNetworkClient } from "../src/client.ts";
import { getTestInstance } from "better-auth/test";

describe("Feature", () => {
  it("should work as expected", async () => {
    const { auth, client, signInWithTestUser } = await getTestInstance({
      plugins: [
        socialNetwork({
          allowSelfFriendRequest: true,
        }),
      ],
    }, {
      clientOptions: {
        plugins: [socialNetworkClient()],
      },
    });

    const { runWithUser, user } = await signInWithTestUser();
    await runWithUser(async (headers) => {

      const { friendRequest } = await auth.api.sendFriendRequest({
        body: {
          receiverId: user.id,
        },
        headers,
      });
      
      expect(friendRequest).toBeDefined();
      expect(friendRequest.senderId).toBe(user.id);
      expect(friendRequest.receiverId).toBe(user.id);
      expect(friendRequest.status).toBe('pending');
    });
  });
});