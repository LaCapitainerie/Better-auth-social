import { describe, it, expect } from "vitest";
import { socialNetwork } from "../../src/index.ts";
import { socialNetworkClient } from "../../src/client.ts";
import { getTestInstance } from "better-auth/test";

describe("Option - automaticBackFriend", async () => {

  describe("when automaticBackFriend is set to false", async () => {
    const { auth, signInWithTestUser } = await getTestInstance({
      plugins: [socialNetwork({
        automaticBackFriend: false,
      })],
    }, {
      clientOptions: {
        plugins: [socialNetworkClient()],
      },
    });

    const { runWithUser, user } = await signInWithTestUser();
    await runWithUser(async (headers) => {

      it("foreign user's friends list should be empty", async () => {
        const { user: foreignUser, token: tokenForeignUser } = await auth.api.signUpEmail({
          body: {
            name: "Foreign User",
            email: "foreign-user@example.com",
            password: "password",
          },
        });
        expect(foreignUser).toBeDefined();
        expect(tokenForeignUser).toBeDefined();

        const { friendRequest } = await auth.api.sendFriendRequest({
          body: {
            receiverId: foreignUser.id,
          },
          headers,
        });
        expect(friendRequest).toBeDefined();
        expect(friendRequest.senderId).toBe(user.id);
        expect(friendRequest.receiverId).toBe(foreignUser.id);
        expect(friendRequest.status).toBe('pending');

        const { success: acceptFriendRequestSuccess } = await auth.api.acceptFriendRequest({
          body: {
            requestId: friendRequest.id,
          },
          headers: {
            Authorization: `Bearer ${tokenForeignUser?.toString()}`,
          },
        });
        expect(acceptFriendRequestSuccess).toBe(true);

        const { friends: foreignUserFriends } = await auth.api.getFriends({
          headers: {
            Authorization: `Bearer ${tokenForeignUser?.toString()}`,
          },
        });
        expect(foreignUserFriends).toBeDefined();
        expect(foreignUserFriends.length).toBe(0);

        const { friends: userFriends } = await auth.api.getFriends({
          headers,
        });
        expect(userFriends).toBeDefined();
        expect(userFriends.length).toBe(1);
        expect(userFriends[0].userId).toBe(user.id);
        expect(userFriends[0].friendId).toBe(foreignUser.id);
      });

    });
  });

  describe("when automaticBackFriend is set to true", async () => {
    const { auth, signInWithTestUser } = await getTestInstance({
      plugins: [socialNetwork({
        automaticBackFriend: true,
      })],
    }, {
      clientOptions: {
        plugins: [socialNetworkClient()],
      },
    });

    const { runWithUser, user } = await signInWithTestUser();
    await runWithUser(async (headers) => {

      it("foreign user's friends list should not be empty", async () => {
        const { user: foreignUser, token: tokenForeignUser } = await auth.api.signUpEmail({
          body: {
            name: "Foreign User",
            email: "foreign-user@example.com",
            password: "password",
          },
        });
        expect(foreignUser).toBeDefined();
        expect(tokenForeignUser).toBeDefined();

        const { friendRequest } = await auth.api.sendFriendRequest({
          body: {
            receiverId: foreignUser.id,
          },
          headers,
        });
        expect(friendRequest).toBeDefined();
        expect(friendRequest.senderId).toBe(user.id);
        expect(friendRequest.receiverId).toBe(foreignUser.id);
        expect(friendRequest.status).toBe('pending');

        const { success: acceptFriendRequestSuccess } = await auth.api.acceptFriendRequest({
          body: {
            requestId: friendRequest.id,
          },
          headers: {
            Authorization: `Bearer ${tokenForeignUser?.toString()}`,
          },
        });
        expect(acceptFriendRequestSuccess).toBe(true);

        const { friends: foreignUserFriends } = await auth.api.getFriends({
          headers: {
            Authorization: `Bearer ${tokenForeignUser?.toString()}`,
          },
        });
        expect(foreignUserFriends).toBeDefined();
        expect(foreignUserFriends.length).toBe(1);
        expect(foreignUserFriends[0].userId).toBe(foreignUser.id);
        expect(foreignUserFriends[0].friendId).toBe(user.id);

        const { friends: userFriends } = await auth.api.getFriends({
          headers,
        });
        expect(userFriends).toBeDefined();
        expect(userFriends.length).toBe(1);
        expect(userFriends[0].userId).toBe(user.id);
        expect(userFriends[0].friendId).toBe(foreignUser.id);
      });

    });
  });
});