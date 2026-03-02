import { describe, it, expect, beforeAll } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - Get Group Chat Messages", async () => {
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
      const responseOfInexistantGroupChat = await auth.api.getGroupChatMessages(
        {
          query: {
            groupChatId: "non-existent-group-chat-id",
          },
          headers,
          asResponse: true,
        },
      );
      const bodyOfInexistantGroupChat =
        await responseOfInexistantGroupChat.json();
      expect(bodyOfInexistantGroupChat.code).toBe(
        SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.code,
      );
      expect(bodyOfInexistantGroupChat.message).toBe(
        SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.message,
      );
    });

    it("should raise an error if user is not a member of the group chat", async () => {
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

      const { groupChat } = await auth.api.createGroupChat({
        body: {
          name: "Group Chat",
          memberIds: [foreignUser.id],
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser?.toString()}`,
        },
      });
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(foreignUser.id);

      const responseOfGroupChatMessagesImNotIn =
        await auth.api.getGroupChatMessages({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
          asResponse: true,
        });
      const bodyOfGroupChatMessagesImNotIn =
        await responseOfGroupChatMessagesImNotIn.json();
      expect(bodyOfGroupChatMessagesImNotIn.code).toBe(
        SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.code,
      );
      expect(bodyOfGroupChatMessagesImNotIn.message).toBe(
        SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.message,
      );
    });

    it("should return an empty list if no message was send", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);

      const responseOfGroupChatMessages = await auth.api.getGroupChatMessages({
        query: {
          groupChatId: groupChat.id,
        },
        headers,
        asResponse: true,
      });
      const bodyOfGroupChatMessages = await responseOfGroupChatMessages.json();
      expect(bodyOfGroupChatMessages.messages).toBeDefined();
      expect(bodyOfGroupChatMessages.messages.length).toBe(0);
    });

    it("should return a message list if messages were sent", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);

      const { message } = await auth.api.sendGroupChatMessage({
        body: {
          groupChatId: groupChat.id,
          content: "Hello!",
        },
        headers,
      });
      expect(message).toBeDefined();
      expect(message.content).toBe("Hello!");
      expect(message.senderId).toBe(user.id);
      expect(message.groupChatId).toBe(groupChat.id);

      const responseOfGroupChatMessages = await auth.api.getGroupChatMessages({
        query: {
          groupChatId: groupChat.id,
        },
        headers,
        asResponse: true,
      });
      const bodyOfGroupChatMessages = await responseOfGroupChatMessages.json();
      expect(bodyOfGroupChatMessages.messages).toBeDefined();
      expect(bodyOfGroupChatMessages.messages.length).toBe(1);
      expect(bodyOfGroupChatMessages.messages[0].content).toBe("Hello!");
      expect(bodyOfGroupChatMessages.messages[0].senderId).toBe(user.id);
      expect(bodyOfGroupChatMessages.messages[0].groupChatId).toBe(
        groupChat.id,
      );
    });
  });
});
