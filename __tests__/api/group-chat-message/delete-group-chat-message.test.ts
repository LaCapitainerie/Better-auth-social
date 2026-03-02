import { describe, it, expect, beforeAll } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - Delete Group Chat Message", async () => {
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
      const { user: foreignUser, token: tokenForeignUser } =
        await auth.api.signUpEmail({
          body: {
            name: "Foreign User",
            email: "foreign-user@example.com",
            password: "password",
          },
        });
      const { groupChat } = await auth.api.createGroupChat({
        body: {
          name: "Group Chat",
          memberIds: [user.id, foreignUser.id],
        },
        headers,
      });
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);

      const { message } = await auth.api.sendGroupChatMessage({
        body: {
          groupChatId: groupChat.id,
          content: "Hello!",
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser}`,
        },
      });
      expect(message).toBeDefined();
      expect(message.content).toBe("Hello!");
      expect(message.senderId).toBe(foreignUser.id);
      expect(message.groupChatId).toBe(groupChat.id);
    });

    it("should raise an error if group chat not found", async () => {
      const response = await auth.api.deleteGroupChatMessage({
        body: {
          groupChatId: "non-existent-group-chat-id",
          messageId: "non-existent-group-chat-message-id",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.message);
    });

    it("should raise an error if group chat message not found", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);

      const response = await auth.api.deleteGroupChatMessage({
        body: {
          groupChatId: groupChat.id,
          messageId: "non-existent-group-chat-message-id",
        },
        headers,
        asResponse: true,
      });

      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MESSAGE_NOT_FOUND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MESSAGE_NOT_FOUND.message);
    });

    it("should raise an error if user is not group chat message author", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);

      const { messages } = await auth.api.getGroupChatMessages({
        query: {
          groupChatId: groupChat.id,
        },
        headers,
      });
      expect(messages).toBeDefined();
      expect(messages.length).toBe(1);
      const message = messages[0];
      expect(message).toBeDefined();
      expect(message.content).toBe("Hello!");
      expect(message.senderId).not.toBe(user.id); // User is not the message author
      expect(message.groupChatId).toBe(groupChat.id);

      const response = await auth.api.deleteGroupChatMessage({
        body: {
          groupChatId: groupChat.id,
          messageId: message.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MESSAGE_NOT_AUTHOR.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MESSAGE_NOT_AUTHOR.message);
    });

    it("should work if group chat and message are found, and user is message author", async () => {
      const { user: foreignUser, token: tokenForeignUser } =
        await auth.api.signInEmail({
          body: {
            email: "foreign-user@example.com",
            password: "password",
          },
        });
      expect(foreignUser).toBeDefined();
      expect(tokenForeignUser).toBeDefined();

      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);

      const { messages: initialMessages } = await auth.api.getGroupChatMessages(
        {
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        },
      );
      expect(initialMessages).toBeDefined();
      expect(initialMessages.length).toBe(1);
      const message = initialMessages[0];
      expect(message).toBeDefined();
      expect(message.content).toBe("Hello!");
      expect(message.senderId).not.toBe(user.id); // Foreign user is the message author
      expect(message.groupChatId).toBe(groupChat.id);

      const response = await auth.api.deleteGroupChatMessage({
        body: {
          groupChatId: groupChat.id,
          messageId: message.id,
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser}`,
        },
        asResponse: true,
      });
      const body = await response.json();
      expect(body.success).toBe(true);

      const { messages: updatedMessages } = await auth.api.getGroupChatMessages(
        {
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        },
      );

      expect(updatedMessages).toBeDefined();
      expect(updatedMessages.length).toBe(1);
      expect(updatedMessages[0].content).toBe("Message has been deleted");
      expect(updatedMessages[0].deletedAt).toBeDefined();
      expect(updatedMessages[0].deletedAt).toBeInstanceOf(Date);
    });
  });
});
