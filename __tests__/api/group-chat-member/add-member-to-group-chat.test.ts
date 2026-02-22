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
      expect(foreignUser1).toBeDefined();
      expect(tokenForeignUser1).toBeDefined();

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




      const { user: foreignUser2, token: tokenForeignUser2 } = await auth.api.signUpEmail({
        body: {
          name: "Foreign User 2",
          email: "foreign-user2@example.com",
          password: "password",
        },
      });
      expect(foreignUser2).toBeDefined();
      expect(tokenForeignUser2).toBeDefined();

      const { friendRequest: friendRequest2 } = await auth.api.sendFriendRequest({
        body: {
          receiverId: foreignUser2.id,
        },
        headers,
      });
      
      expect(friendRequest2).toBeDefined();
      expect(friendRequest2.senderId).toBe(user.id);
      expect(friendRequest2.receiverId).toBe(foreignUser2.id);
      expect(friendRequest2.status).toBe('pending');

      const { success: acceptFriendRequestSuccess2 } = await auth.api.acceptFriendRequest({
        body: {
          requestId: friendRequest2.id,
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser2?.toString()}`,
        },
      });
      expect(acceptFriendRequestSuccess2).toBe(true);



      const { friendRequest: friendRequest3 } = await auth.api.sendFriendRequest({
        body: {
          receiverId: foreignUser2.id,
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser1?.toString()}`,
        },
      });
      expect(friendRequest3).toBeDefined();
      expect(friendRequest3.senderId).toBe(foreignUser1.id);
      expect(friendRequest3.receiverId).toBe(foreignUser2.id);
      expect(friendRequest3.status).toBe('pending');

      const { success: acceptFriendRequestSuccess3 } = await auth.api.acceptFriendRequest({
        body: {
          requestId: friendRequest3.id,
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser2?.toString()}`,
        },
      });
      expect(acceptFriendRequestSuccess3).toBe(true);

      const { isFriend } = await auth.api.isFriend({
        query: {
          friendId: foreignUser2.id,
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser1?.toString()}`,
        },
      });
      expect(isFriend).toBe(true);

      const { groupChat } = await auth.api.createGroupChat({
        body: {
          name: "Group Chat",
          memberIds: [foreignUser1.id],
        },
        headers,
      });
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
    });

    it("should raise an error if user is already in the group", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];

      const { friends } = await auth.api.getFriends({
        headers,
      });
      expect(friends).toBeDefined();
      expect(friends.length).toBe(2);
      const foreignUser1 = friends[0].friendId;

      const response = await auth.api.addMemberToGroupChat({
        body: {
          groupChatId: groupChat.id,
          userId: foreignUser1,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.ALREADY_MEMBER));
      expect(body.message).toBe(ERROR_MESSAGES.ALREADY_MEMBER);
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

      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];

      const { friends } = await auth.api.getFriends({
        headers,
      });
      expect(friends).toBeDefined();
      console.log(friends);
      
      expect(friends.length).toBe(2);
      const foreignUser2 = friends[1].friendId;

      const response = await auth.api.addMemberToGroupChat({
        body: {
          groupChatId: groupChat.id,
          userId: foreignUser2,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.FORBIDDEN));
      expect(body.message).toBe(ERROR_MESSAGES.FORBIDDEN);
    });

    it("should return success true if member was added to the group", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];

      const { friends } = await auth.api.getFriends({
        headers,
      });
      expect(friends).toBeDefined();
      expect(friends.length).toBe(2);
      const foreignUser2 = friends[1].friendId;

      const response = await auth.api.addMemberToGroupChat({
        body: {
          groupChatId: groupChat.id,
          userId: foreignUser2,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });
});