import { describe, it, expect, beforeAll } from "vitest";
import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { errorMessageToCode, ERROR_MESSAGES } from "../../../src/error.ts";

describe("API - Delete Chat Message", async () => {
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

    it("should raise an error if chat message is not found", async () => {
      const response = await auth.api.deleteChatMessage({
        body: {
          chatMessageId: 'non-existent-chat-message-id',
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_FOUND));
      expect(body.message).toBe(ERROR_MESSAGES.NOT_FOUND);
    });

   it("should return a success if chat message is found and not deleted", async () => {
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
        content: 'Hello!',
      },
      headers,
    });
    expect(message).toBeDefined();
    expect(message.content).toBe('Hello!');
    expect(message.senderId).toBe(user.id);
    expect(message.chatId).toBe(chat.id);

    const response = await auth.api.deleteChatMessage({
      body: {
        chatMessageId: message.id,
      },
      headers,
      asResponse: true,
    });
    const body = await response.json();
    expect(body.success).toBe(true);
   });

   it("should raise an error if chat message is already deleted", async () => {
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
        content: 'Hello!',
      },
      headers,
    });
    expect(message).toBeDefined();
    expect(message.content).toBe('Hello!');
    expect(message.senderId).toBe(user.id);
    expect(message.chatId).toBe(chat.id);

    const firstDeleteResponse = await auth.api.deleteChatMessage({
      body: {
        chatMessageId: message.id,
      },
      headers,
      asResponse: true,
    });
    const firstDeleteResponseBody = await firstDeleteResponse.json();
    expect(firstDeleteResponseBody.success).toBe(true);

    const secondDeleteResponse = await auth.api.deleteChatMessage({
      body: {
        chatMessageId: message.id,
      },
      headers,
      asResponse: true,
    });
    const secondDeleteResponseBody = await secondDeleteResponse.json();
    
    expect(secondDeleteResponseBody.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_FOUND));
    expect(secondDeleteResponseBody.message).toBe(ERROR_MESSAGES.NOT_FOUND);
    
   });
  });
});