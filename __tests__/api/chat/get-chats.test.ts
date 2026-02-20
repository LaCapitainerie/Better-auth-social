import { describe, it, expect } from "vitest";
import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { getTestInstance } from "better-auth/test";

describe("API - Get or Create Chat", async () => {
  const { auth, signInWithTestUser } = await getTestInstance({
    plugins: [socialNetwork({
      allowSelfFriendRequest: true,
    })],
  }, {
    clientOptions: {
      plugins: [socialNetworkClient()],
    },
  });

  const { runWithUser, user } = await signInWithTestUser();
  await runWithUser(async (headers) => {

    it("should return an empty list if user doesn't have any chat", async () => {
      const response = await auth.api.getChats({
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.chats).toBeDefined();
      expect(body.chats.length).toBe(0);
    });

    it("should return Chat list if user does have some Chat", async () => {
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

      const { success: acceptFriendRequestSuccess } = await auth.api.acceptFriendRequest({
        body: {
          requestId: friendRequest.id,
        },
        headers,
      });
      expect(acceptFriendRequestSuccess).toBe(true);

      const { chat } = await auth.api.getOrCreateChat({
        query: {
          friendId: user.id,
        },
        headers,
      });
      expect(chat).toBeDefined();
      expect(chat.user1Id).toBe(user.id);
      expect(chat.user2Id).toBe(user.id);

      const response = await auth.api.getChats({
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.chats).toBeDefined();
      expect(body.chats.length).toBe(1);
      expect(body.chats[0].user1Id).toBe(user.id);
      expect(body.chats[0].user2Id).toBe(user.id);
    });
  });
});