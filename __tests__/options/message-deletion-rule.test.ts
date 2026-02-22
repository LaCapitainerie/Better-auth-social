import { describe, it, expect, beforeAll } from "vitest";
import { socialNetwork } from "../../src/index.ts";
import { socialNetworkClient } from "../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { ERROR_MESSAGES, errorMessageToCode } from "../../src/error.ts";

describe("Options - Message Deletion Rule", async () => {

  describe("with messageDeletionRule set to CANT_DELETE", async () => {
    const { auth, signInWithTestUser } = await getTestInstance({
      plugins: [socialNetwork({
        allowAddingUnknownMembersToGroupChat: true,
        messageDeletionRule: 'CANT_DELETE',
      })],
    }, {
      clientOptions: {
        plugins: [socialNetworkClient()],
      },
    });

    const { runWithUser, user } = await signInWithTestUser();
    await runWithUser(async (headers) => {
      beforeAll(async () => {

        const { groupChat } = await auth.api.createGroupChat({
          body: {
            name: 'test-group-chat',
            memberIds: [user.id],
          },
          headers,
        });
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe('test-group-chat');
        expect(groupChat.createdById).toBe(user.id);

        const { message } = await auth.api.sendGroupChatMessage({
          body: {
            groupChatId: groupChat.id,
            content: 'test-content',
          },
          headers,
        });
        expect(message).toBeDefined();
        expect(message.content).toBe('test-content');
        expect(message.senderId).toBe(user.id);
        expect(message.groupChatId).toBe(groupChat.id);
      });
      // Sender - CANT_DELETE
      it("should return an error when the sender try to delete a message but the option is set to CANT_DELETE", async () => {
        const { groupChats } = await auth.api.getGroupChats({
          headers,
        });
        expect(groupChats).toBeDefined();
        expect(groupChats.length).toBe(1);
        const groupChat = groupChats[0];
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe('test-group-chat');
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
        expect(message.content).toBe('test-content');
        expect(message.senderId).toBe(user.id);
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
        expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.FORBIDDEN));
        expect(body.message).toBe(ERROR_MESSAGES.FORBIDDEN);

        const { messages: updatedMessages } = await auth.api.getGroupChatMessages({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        });
        expect(updatedMessages).toBeDefined();
        expect(updatedMessages.length).toBe(1);
      });
    });
  });

  describe("with messageDeletionRule set to SENDER_ONLY_VISIBLE", async () => {
    const { auth, signInWithTestUser } = await getTestInstance({
      plugins: [socialNetwork({
        allowAddingUnknownMembersToGroupChat: true,
        messageDeletionRule: 'SENDER_ONLY_VISIBLE',
      })],
    }, {
      clientOptions: {
        plugins: [socialNetworkClient()],
      },
    });

    const { runWithUser, user } = await signInWithTestUser();
    await runWithUser(async (headers) => {
      beforeAll(async () => {

        const { user: foreignUser, token: tokenForeignUser } = await auth.api.signUpEmail({
          body: {
            name: 'foreign-user',
            email: 'foreign-user@example.com',
            password: 'password',
          },
        });
        expect(foreignUser).toBeDefined();
        expect(tokenForeignUser).toBeDefined();

        const { groupChat } = await auth.api.createGroupChat({
          body: {
            name: 'test-group-chat',
            memberIds: [user.id, foreignUser.id],
          },
          headers,
        });
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe('test-group-chat');
        expect(groupChat.createdById).toBe(user.id);

        const { message } = await auth.api.sendGroupChatMessage({
          body: {
            groupChatId: groupChat.id,
            content: 'test-content',
          },
          headers: {
            Authorization: `Bearer ${tokenForeignUser}`,
          },
        });
        expect(message).toBeDefined();
        expect(message.content).toBe('test-content');
        expect(message.senderId).toBe(foreignUser.id);
        expect(message.groupChatId).toBe(groupChat.id);

        const { success: deleteMessageSuccess } = await auth.api.deleteGroupChatMessage({
          body: {
            groupChatId: groupChat.id,
            messageId: message.id,
          },
          headers: {
            Authorization: `Bearer ${tokenForeignUser}`,
          },
        });
        expect(deleteMessageSuccess).toBe(true);
      });

      // Sender - SENDER_ONLY_VISIBLE
      it("should display the template message to the sender when the option is set to SENDER_ONLY_VISIBLE", async () => {
        const { user: foreignUser, token: tokenForeignUser } = await auth.api.signInEmail({
          body: {
            email: 'foreign-user@example.com',
            password: 'password',
          },
        });
        expect(foreignUser).toBeDefined();

        const { groupChats } = await auth.api.getGroupChats({
          headers: {
            Authorization: `Bearer ${tokenForeignUser}`,
          },
        });
        const groupChat = groupChats[0];
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe('test-group-chat');
        expect(groupChat.createdById).toBe(user.id);

        const { messages } = await auth.api.getGroupChatMessages({
          query: {
            groupChatId: groupChat.id,
          },
          headers: {
            Authorization: `Bearer ${tokenForeignUser}`,
          },
        });
        expect(messages).toBeDefined();
        expect(messages.length).toBe(1);
        const message = messages[0];
        expect(message).toBeDefined();
        expect(message.content).toBe('Message has been deleted');
        expect(message.senderId).toBe(foreignUser.id);
        expect(message.groupChatId).toBe(groupChat.id);

      });
      // Receiver - SENDER_ONLY_VISIBLE
      it("should not display any message to the other users when the option is set to SENDER_ONLY_VISIBLE", async () => {
        const { groupChats } = await auth.api.getGroupChats({
          headers,
        });
        const groupChat = groupChats[0];
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe('test-group-chat');
        expect(groupChat.createdById).toBe(user.id);

        const { messages } = await auth.api.getGroupChatMessages({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        });
        expect(messages).toBeDefined();
        expect(messages.length).toBe(0);
      });
    });
  });

  describe("with messageDeletionRule set to VISIBLE", async () => {
    const { auth, signInWithTestUser } = await getTestInstance({
      plugins: [socialNetwork({
        allowAddingUnknownMembersToGroupChat: true,
        messageDeletionRule: 'VISIBLE',
      })],
    }, {
      clientOptions: {
        plugins: [socialNetworkClient()],
      },
    });

    const { runWithUser, user } = await signInWithTestUser();
    await runWithUser(async (headers) => {
      beforeAll(async () => {

        const { user: foreignUser, token: tokenForeignUser } = await auth.api.signUpEmail({
          body: {
            name: 'foreign-user',
            email: 'foreign-user@example.com',
            password: 'password',
          },
        });
        expect(foreignUser).toBeDefined();
        expect(tokenForeignUser).toBeDefined();

        const { groupChat } = await auth.api.createGroupChat({
          body: {
            name: 'test-group-chat',
            memberIds: [user.id, foreignUser.id],
          },
          headers,
        });
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe('test-group-chat');
        expect(groupChat.createdById).toBe(user.id);

        const { message } = await auth.api.sendGroupChatMessage({
          body: {
            groupChatId: groupChat.id,
            content: 'test-content',
          },
          headers: {
            Authorization: `Bearer ${tokenForeignUser}`,
          },
        });
        expect(message).toBeDefined();
        expect(message.content).toBe('test-content');
        expect(message.senderId).toBe(foreignUser.id);
        expect(message.groupChatId).toBe(groupChat.id);

        const { success: deleteMessageSuccess } = await auth.api.deleteGroupChatMessage({
          body: {
            groupChatId: groupChat.id,
            messageId: message.id,
          },
          headers: {
            Authorization: `Bearer ${tokenForeignUser}`,
          },
        });
        expect(deleteMessageSuccess).toBe(true);
      });

      // Sender - VISIBLE
      it("should display the template message to the sender when the option is set to VISIBLE", async () => {
        const { user: foreignUser, token: tokenForeignUser } = await auth.api.signInEmail({
          body: {
            email: 'foreign-user@example.com',
            password: 'password',
          },
        });
        expect(foreignUser).toBeDefined();

        const { groupChats } = await auth.api.getGroupChats({
          headers: {
            Authorization: `Bearer ${tokenForeignUser}`,
          },
        });
        const groupChat = groupChats[0];
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe('test-group-chat');
        expect(groupChat.createdById).toBe(user.id);

        const { messages } = await auth.api.getGroupChatMessages({
          query: {
            groupChatId: groupChat.id,
          },
          headers: {
            Authorization: `Bearer ${tokenForeignUser}`,
          },
        });
        expect(messages).toBeDefined();
        expect(messages.length).toBe(1);
        const message = messages[0];
        expect(message).toBeDefined();
        expect(message.content).toBe('Message has been deleted');
        expect(message.senderId).toBe(foreignUser.id);
        expect(message.groupChatId).toBe(groupChat.id);

      });
      // Receiver - VISIBLE
      it("should display the template message to the other users when the option is set to VISIBLE", async () => {
        const { groupChats } = await auth.api.getGroupChats({
          headers,
        });
        const groupChat = groupChats[0];
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe('test-group-chat');
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
        expect(message.content).toBe('Message has been deleted');
        expect(message.senderId).not.toBe(user.id);
        expect(message.groupChatId).toBe(groupChat.id);
      });
    });
  });
});