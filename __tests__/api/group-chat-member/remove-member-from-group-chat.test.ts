import { describe, it, expect, beforeAll } from "vitest";
import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { errorMessageToCode, ERROR_MESSAGES } from "../../../src/error.ts";

describe("API - Add Member to Group Chat", async () => {
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

      const { friendRequest: friendRequest1 } = await auth.api.sendFriendRequest({
        body: {
          receiverId: foreignUser1.id,
        },
        headers,
      });
      
      expect(friendRequest1).toBeDefined();
      expect(friendRequest1.senderId).toBe(user.id);
      expect(friendRequest1.receiverId).toBe(foreignUser1.id);
      expect(friendRequest1.status).toBe('pending');

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

      const { members: initialMembers } = await auth.api.getGroupChatMembers({
        query: {
          groupChatId: groupChat.id,
        },
        headers,
      });
      expect(initialMembers).toBeDefined();
      expect(initialMembers.length).toBe(2);
      expect(initialMembers.find(m => m.userId === foreignUser1.id)?.role).toBe('member');
      expect(initialMembers.find(m => m.userId === user.id)?.role).toBe('admin');
    });

    it("should raise an error if user is not in the group", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];

      const { user: foreignUser2, token: tokenForeignUser2 } = await auth.api.signUpEmail({
        body: {
          name: "Foreign User 2",
          email: "foreign-user2@example.com",
          password: "password",
        },
      });
      expect(foreignUser2).toBeDefined();
      expect(tokenForeignUser2).toBeDefined();

      const response = await auth.api.removeMemberFromGroupChat({
        body: {
          groupChatId: groupChat.id,
          userId: user.id,
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser2?.toString()}`,
        },
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_FOUND));
      expect(body.message).toBe(ERROR_MESSAGES.NOT_FOUND);
    });

    it("should return success true if member was removed from the group", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];

      const { members: initialMembers } = await auth.api.getGroupChatMembers({
        query: {
          groupChatId: groupChat.id,
        },
        headers,
      });
      expect(initialMembers).toBeDefined();
      expect(initialMembers.length).toBe(2);
      const foreignUser1 = initialMembers.find(m => m.userId !== user.id)!;
      expect(foreignUser1).toBeDefined();
      expect(foreignUser1.userId).toBe(foreignUser1.userId);
      expect(foreignUser1.role).toBe('member');

      const response = await auth.api.removeMemberFromGroupChat({
        body: {
          groupChatId: groupChat.id,
          userId: foreignUser1.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.success).toBe(true);

      const { members: updatedMembers } = await auth.api.getGroupChatMembers({
        query: {
          groupChatId: groupChat.id,
        },
        headers,
      });
      
      expect(updatedMembers).toBeDefined();
      expect(updatedMembers.length).toBe(1);
      expect(updatedMembers.find(m => m.userId === user.id)?.role).toBe('admin');
    });

    it("should raise an error if user is not an admin of the group", async () => {
      const { user: foreignUser1, token: tokenForeignUser1 } = await auth.api.signInEmail({
        body: {
          email: "foreign-user1@example.com",
          password: "password",
        },
      });
      expect(foreignUser1).toBeDefined();
      expect(tokenForeignUser1).toBeDefined();
      
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

      const { members: initialMembers } = await auth.api.getGroupChatMembers({
        query: {
          groupChatId: groupChat.id,
        },
        headers,
      });
      expect(initialMembers).toBeDefined();
      expect(initialMembers.length).toBe(2);
      const foreignUser1Group = initialMembers.find(m => m.userId === foreignUser1.id)!;
      expect(foreignUser1Group).toBeDefined();
      expect(foreignUser1Group.userId).toBe(foreignUser1.id);
      expect(foreignUser1Group.role).toBe('member');

      const response = await auth.api.removeMemberFromGroupChat({
        body: {
          groupChatId: groupChat.id,
          userId: user.id,
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser1?.toString()}`,
        },
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.FORBIDDEN));
      expect(body.message).toBe(ERROR_MESSAGES.FORBIDDEN);
    });
  });
});