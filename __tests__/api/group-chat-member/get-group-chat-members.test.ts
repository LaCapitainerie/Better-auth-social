import { describe, it, expect, beforeAll } from "vitest";
import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { errorMessageToCode, ERROR_MESSAGES } from "../../../src/error.ts";

describe("API - Get Group Chat Members", async () => {
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
      const { user: foreignUser1, token: tokenForeignUser1 } = await auth.api.signUpEmail({
        body: {
          name: "Foreign User 1",
          email: "foreign-user1@example.com",
          password: "password",
        },
      });
      expect(foreignUser1).toBeDefined();
      expect(tokenForeignUser1).toBeDefined();

      const { friendRequest: friendRequest1 } = await auth.api.sendFriendRequest({
        body: {
          receiverId: foreignUser1.id,
        },
        headers,
      });
      const { success: acceptFriendRequestSuccess1 } = await auth.api.acceptFriendRequest({
        body: {
          requestId: friendRequest1.id,
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser1?.toString()}`,
        },
      });
      expect(acceptFriendRequestSuccess1).toBe(true);

      const { groupChat } = await auth.api.createGroupChat({
        body: {
          name: "Group Chat",
          memberIds: [user.id, foreignUser1.id],
        },
        headers,
      });
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);

      const { groupChat: gc2 } = await auth.api.createGroupChat({
        body: {
          name: "Solo Group Chat",
          memberIds: [foreignUser1.id],
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser1?.toString()}`,
        },
      });
      expect(gc2).toBeDefined();
      expect(gc2.name).toBe("Solo Group Chat");
      expect(gc2.createdById).toBe(foreignUser1.id);
    });

    it("should raise an error if group chat not found", async () => {
      const response = await auth.api.getGroupChatMembers({
        query: {
          groupChatId: 'non-existent-group-chat-id',
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_FOUND));
      expect(body.message).toBe(ERROR_MESSAGES.NOT_FOUND);
    });

    it("should raise an error if user does not belong to group chat", async () => {
      const { user: foreignUser1, token: tokenForeignUser1 } = await auth.api.signInEmail({
        body: {
          email: "foreign-user1@example.com",
          password: "password",
        },
      });
      expect(foreignUser1).toBeDefined();
      expect(tokenForeignUser1).toBeDefined();

      const { groupChats } = await auth.api.getGroupChats({
        headers: {
          Authorization: `Bearer ${tokenForeignUser1?.toString()}`,
        },
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(2);
      const groupChat = groupChats.find(gc => gc.createdById === foreignUser1.id)!;
      expect(groupChat).toBeDefined();
      expect(groupChat.createdById).toBe(foreignUser1.id);
      expect(groupChat.name).toBe("Solo Group Chat");

      const response = await auth.api.getGroupChatMembers({
        query: {
          groupChatId: groupChat.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_FOUND));
      expect(body.message).toBe(ERROR_MESSAGES.NOT_FOUND);
    });

    it("should return a list of members if group chat is found as it cannot be empty", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];

      const response = await auth.api.getGroupChatMembers({
        query: {
          groupChatId: groupChat.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.members).toBeDefined();
      expect(body.members.length).toBe(2);
    });
  });
});