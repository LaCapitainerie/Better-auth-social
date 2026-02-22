import { describe, it, expect, beforeAll } from "vitest";
import { socialNetwork } from "../../src/index.ts";
import { socialNetworkClient } from "../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { ERROR_MESSAGES, errorMessageToCode } from "../../src/error.ts";
import { GroupChatMessage } from "../../src/types.ts";

describe("Options - Deleted Message Placeholder", async () => {
  describe("with deletedMessagePlaceholder set to a string", async () => {

    const deletedMessagePlaceholder = 'This message has been deleted';

    const { auth, signInWithTestUser } = await getTestInstance({
      plugins: [socialNetwork({
        deletedMessagePlaceholder: deletedMessagePlaceholder,
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
            name: "Group Chat",
            memberIds: [user.id],
          },
          headers,
        });
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe("Group Chat");
        expect(groupChat.createdById).toBe(user.id);


        const { message } = await auth.api.sendGroupChatMessage({
          body: {
            groupChatId: groupChat.id,
            content: 'Hello!',
          },
          headers,
        });
        expect(message).toBeDefined();
        expect(message.content).toBe('Hello!');
        expect(message.senderId).toBe(user.id);
        expect(message.groupChatId).toBe(groupChat.id);

        const { success: deleteMessageSuccess } = await auth.api.deleteGroupChatMessage({
          body: {
            groupChatId: groupChat.id,
            messageId: message.id,
          },
          headers,
        });
        expect(deleteMessageSuccess).toBe(true);
      });

      it("should display the placeholder over visible deleted message", async () => {
        const { groupChats } = await auth.api.getGroupChats({
          headers,
        });
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
        expect(message.content).toBe(deletedMessagePlaceholder);
        expect(message.senderId).toBe(user.id);
        expect(message.groupChatId).toBe(groupChat.id);
      });
    });
  });

  describe("with deletedMessagePlaceholder set to a function", async () => {

    const deletedMessagePlaceholder = async (message: GroupChatMessage) => {
      return `This message has been deleted: ${message.content}`;
    };

    const { auth, signInWithTestUser } = await getTestInstance({
      plugins: [socialNetwork({
        deletedMessagePlaceholder: deletedMessagePlaceholder,
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
            name: "Group Chat",
            memberIds: [user.id],
          },
          headers,
        });
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe("Group Chat");
        expect(groupChat.createdById).toBe(user.id);


        const { message } = await auth.api.sendGroupChatMessage({
          body: {
            groupChatId: groupChat.id,
            content: 'Hello!',
          },
          headers,
        });
        expect(message).toBeDefined();
        expect(message.content).toBe('Hello!');
        expect(message.senderId).toBe(user.id);
        expect(message.groupChatId).toBe(groupChat.id);

        const { success: deleteMessageSuccess } = await auth.api.deleteGroupChatMessage({
          body: {
            groupChatId: groupChat.id,
            messageId: message.id,
          },
          headers,
        });
        expect(deleteMessageSuccess).toBe(true);
      });

      it("should display the placeholder over visible deleted message", async () => {
        const { groupChats } = await auth.api.getGroupChats({
          headers,
        });
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
        expect(message.content).toBe(await deletedMessagePlaceholder({
          ...message,
          content: 'Hello!',
        }));
        expect(message.senderId).toBe(user.id);
        expect(message.groupChatId).toBe(groupChat.id);
      });
    });
  });
});