import { describe, it, expect, beforeAll } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - Send Group Chat Message", async () => {
  const { auth, signInWithTestUser } = await getTestInstance(
    {
      plugins: [
        socialNetwork({
          allowAddingUnknownMembersToGroupChat: true,
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
      const { groupChat } = await auth.api.createGroupChat({
        body: {
          name: "Group Chat",
          memberIds: [user.id],
        },
        headers,
      });
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);
    });

    it("should raise an error if group chat is not found", async () => {
      const response = await auth.api.sendGroupChatMessage({
        body: {
          groupChatId: "non-existent-group-chat-id",
          content: "Hello!",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.message);
    });

    it("should raise an error if content is empty or undefined", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);

      const response = await auth.api.sendGroupChatMessage({
        body: {
          groupChatId: groupChat.id,
          content: "",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MESSAGE_CONTENT_REQUIRED.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MESSAGE_CONTENT_REQUIRED.message);

      const { messages } = await auth.api.getGroupChatMessages({
        query: {
          groupChatId: groupChat.id,
        },
        headers,
      });
      expect(messages).toBeDefined();
      expect(messages.length).toBe(0);
    });

    it("should work if group chat is found and content is not empty", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);

      const response = await auth.api.sendGroupChatMessage({
        body: {
          groupChatId: groupChat.id,
          content: "Hello!",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.message).toBeDefined();
      expect(body.message.content).toBe("Hello!");
      expect(body.message.senderId).toBe(user.id);
      expect(body.message.groupChatId).toBe(groupChat.id);

      const { messages } = await auth.api.getGroupChatMessages({
        query: {
          groupChatId: groupChat.id,
        },
        headers,
      });
      expect(messages).toBeDefined();
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe("Hello!");
      expect(messages[0].senderId).toBe(user.id);
      expect(messages[0].groupChatId).toBe(groupChat.id);
    });
  });
});
