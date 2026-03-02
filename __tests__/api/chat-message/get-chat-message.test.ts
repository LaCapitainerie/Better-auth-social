import { describe, it, expect, beforeAll } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - Get Chat Messages", async () => {
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
    beforeAll(async () => {
      const { friendRequest } = await auth.api.sendFriendRequest({
        body: {
          receiverId: user.id,
        },
        headers,
      });
      await auth.api.acceptFriendRequest({
        body: {
          requestId: friendRequest.id,
        },
        headers,
      });

      const { chat } = await auth.api.getOrCreateChat({
        query: {
          friendId: user.id,
        },
        headers,
      });
      expect(chat).toBeDefined();
      expect(chat.user1Id).toBe(user.id);
      expect(chat.user2Id).toBe(user.id);
    });

    it("should raise an error if chat was not found", async () => {
      const response = await auth.api.getChatMessages({
        query: {
          chatId: "non-existent-chat-id",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.PRIVATE_CHAT_NOT_FOUND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.PRIVATE_CHAT_NOT_FOUND.message);
    });

    it("should return an empty list if chat is empty", async () => {
      const { chat } = await auth.api.getOrCreateChat({
        query: {
          friendId: user.id,
        },
        headers,
      });
      expect(chat).toBeDefined();
      expect(chat.user1Id).toBe(user.id);
      expect(chat.user2Id).toBe(user.id);

      const response = await auth.api.getChatMessages({
        query: {
          chatId: chat.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.messages).toBeDefined();
      expect(body.messages.length).toBe(0);
    });

    it("should return a list of message if chat is not empty", async () => {
      const { chat } = await auth.api.getOrCreateChat({
        query: {
          friendId: user.id,
        },
        headers,
      });
      expect(chat).toBeDefined();
      expect(chat.user1Id).toBe(user.id);
      expect(chat.user2Id).toBe(user.id);

      const { message } = await auth.api.sendChatMessage({
        body: {
          chatId: chat.id,
          content: "Hello!",
        },
        headers,
      });
      expect(message).toBeDefined();
      expect(message.content).toBe("Hello!");
      expect(message.senderId).toBe(user.id);
      expect(message.chatId).toBe(chat.id);

      const response = await auth.api.getChatMessages({
        query: {
          chatId: chat.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.messages).toBeDefined();
      expect(body.messages.length).toBe(1);
      expect(body.messages[0].content).toBe("Hello!");
      expect(body.messages[0].senderId).toBe(user.id);
      expect(body.messages[0].chatId).toBe(chat.id);
    });
  });
});
