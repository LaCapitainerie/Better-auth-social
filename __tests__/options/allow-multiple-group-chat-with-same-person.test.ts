import { describe, it, expect, beforeAll } from "vitest";
import { socialNetwork } from "../../src/index.ts";
import { socialNetworkClient } from "../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { ERROR_MESSAGES, errorMessageToCode } from "../../src/error.ts";

describe("Options - Allow Multiple Group Chat with Same Person", async () => {

  describe("with allowMultipleGroupChatWithSamePerson set to false", async () => {

    const { auth, signInWithTestUser } = await getTestInstance({
      plugins: [socialNetwork({
        allowMultipleGroupChatWithSamePerson: false,
      })],
    }, {
      clientOptions: {
        plugins: [socialNetworkClient()],
      },
    });
  
    const { runWithUser, user } = await signInWithTestUser();
    await runWithUser(async (headers) => {

      beforeAll(async () => {
        const { user: foreignUser, token: tokenForeignUser1 } = await auth.api.signUpEmail({
          body: {
            name: "Test User",
            email: "test@example.com",
            password: "password",
          },
        });
        expect(foreignUser).toBeDefined();
        expect(tokenForeignUser1).toBeDefined();

        const { friendRequest: friendRequest1 } = await auth.api.sendFriendRequest({
          body: {
            receiverId: foreignUser.id,
          },
          headers,
        });
        expect(friendRequest1).toBeDefined();
        expect(friendRequest1.senderId).toBe(user.id);
        expect(friendRequest1.receiverId).toBe(foreignUser.id);
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
            name: "Test User 2",
            email: "test2@example.com",
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

        const { user: foreignUser3, token: tokenForeignUser3 } = await auth.api.signUpEmail({
          body: {
            name: "Test User 3",
            email: "test3@example.com",
            password: "password",
          },
        });
        expect(foreignUser3).toBeDefined();
        expect(tokenForeignUser3).toBeDefined();

        const { friendRequest: friendRequest3 } = await auth.api.sendFriendRequest({
          body: {
            receiverId: foreignUser3.id,
          },
          headers,
        });
        expect(friendRequest3).toBeDefined();
        expect(friendRequest3.senderId).toBe(user.id);
        expect(friendRequest3.receiverId).toBe(foreignUser3.id);
        expect(friendRequest3.status).toBe('pending');

        const { success: acceptFriendRequestSuccess3 } = await auth.api.acceptFriendRequest({
          body: {
            requestId: friendRequest3.id,
          },
          headers: {
            Authorization: `Bearer ${tokenForeignUser3?.toString()}`,
          },
        });
        expect(acceptFriendRequestSuccess3).toBe(true);

        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends.length).toBe(3);
        expect(friends[0].userId).toBe(user.id);
        expect(friends[0].friendId).toBe(foreignUser.id);
        expect(friends[1].userId).toBe(user.id);
        expect(friends[1].friendId).toBe(foreignUser2.id);

        const { groupChat } = await auth.api.createGroupChat({
          body: {
            name: "Group Chat 1a",
            memberIds: friends.slice(0, 2).map(f => f.friendId),
          },
          headers,
        });
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe("Group Chat 1a");
        expect(groupChat.createdById).toBe(user.id);
      });

      it("should raise an error if the user tries to create a group chat with the same person", async () => {

        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends.length).toBe(3);

        const response = await auth.api.createGroupChat({
          body: {
            name: "Group Chat 2a",
            memberIds: friends.slice(0, 2).map(f => f.friendId),
          },
          headers,
          asResponse: true,
        });
        const body = await response.json();
        expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.MULTIPLE_GROUP_CHAT_WITH_SAME_PERSON));
        expect(body.message).toBe(ERROR_MESSAGES.MULTIPLE_GROUP_CHAT_WITH_SAME_PERSON);
      });

      it("should work if the group chat have 1 less member", async () => {

        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends.length).toBe(3);

        const response = await auth.api.createGroupChat({
          body: {
            name: "Group Chat 3a",
            memberIds: [friends[0].friendId],
          },
          headers,
          asResponse: true,
        });
        const body = await response.json();
        expect(body.groupChat).toBeDefined();
        expect(body.groupChat.name).toBe("Group Chat 3a");
        expect(body.groupChat.createdById).toBe(user.id);
      });

      it("should work if the group chat have 1 more member", async () => {
        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends.length).toBe(3);
        
        const response = await auth.api.createGroupChat({
          body: {
            name: "Group Chat 4a",
            memberIds: [friends[0].friendId, friends[1].friendId, friends[2].friendId],
          },
          headers,
          asResponse: true,
        });
        const body = await response.json();
        expect(body.groupChat).toBeDefined();
        expect(body.groupChat.name).toBe("Group Chat 4a");
        expect(body.groupChat.createdById).toBe(user.id);
      });

    });
  });

  describe("with allowSelfFriendRequest set to true", async () => {

    const { auth, signInWithTestUser } = await getTestInstance({
      plugins: [socialNetwork({
        allowSelfFriendRequest: true,
        allowMultipleGroupChatWithSamePerson: true,
      })],
    }, {
      clientOptions: {
        plugins: [socialNetworkClient()],
      },
    });

    const { runWithUser, user } = await signInWithTestUser();
    await runWithUser(async (headers) => {

      beforeAll(async () => {
        const { user: foreignUser, token: tokenForeignUser1 } = await auth.api.signUpEmail({
          body: {
            name: "Test User",
            email: "test@example.com",
            password: "password",
          },
        });
        expect(foreignUser).toBeDefined();
        expect(tokenForeignUser1).toBeDefined();

        const { friendRequest: friendRequest1 } = await auth.api.sendFriendRequest({
          body: {
            receiverId: foreignUser.id,
          },
          headers,
        });
        expect(friendRequest1).toBeDefined();
        expect(friendRequest1.senderId).toBe(user.id);
        expect(friendRequest1.receiverId).toBe(foreignUser.id);
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
            name: "Test User 2",
            email: "test2@example.com",
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

        const { user: foreignUser3, token: tokenForeignUser3 } = await auth.api.signUpEmail({
          body: {
            name: "Test User 3",
            email: "test3@example.com",
            password: "password",
          },
        });
        expect(foreignUser3).toBeDefined();
        expect(tokenForeignUser3).toBeDefined();

        const { friendRequest: friendRequest3 } = await auth.api.sendFriendRequest({
          body: {
            receiverId: foreignUser3.id,
          },
          headers,
        });
        expect(friendRequest3).toBeDefined();
        expect(friendRequest3.senderId).toBe(user.id);
        expect(friendRequest3.receiverId).toBe(foreignUser3.id);
        expect(friendRequest3.status).toBe('pending');

        const { success: acceptFriendRequestSuccess3 } = await auth.api.acceptFriendRequest({
          body: {
            requestId: friendRequest3.id,
          },
          headers: {
            Authorization: `Bearer ${tokenForeignUser3?.toString()}`,
          },
        });
        expect(acceptFriendRequestSuccess3).toBe(true);

        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends.length).toBe(3);
        expect(friends[0].userId).toBe(user.id);
        expect(friends[0].friendId).toBe(foreignUser.id);
        expect(friends[1].userId).toBe(user.id);
        expect(friends[1].friendId).toBe(foreignUser2.id);

        const { groupChat } = await auth.api.createGroupChat({
          body: {
            name: "Group Chat 1b",
            memberIds: friends.slice(0, 2).map(f => f.friendId),
          },
          headers,
        });
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe("Group Chat 1b");
        expect(groupChat.createdById).toBe(user.id);
      });

      it("should create a second chat when the option is set to true", async () => {

        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends.length).toBe(3);

        const response = await auth.api.createGroupChat({
          body: {
            name: "Group Chat 2b",
            memberIds: friends.slice(0, 2).map(f => f.friendId),
          },
          headers,
          asResponse: true,
        });
        const body = await response.json();
        expect(body.groupChat).toBeDefined();
        expect(body.groupChat.name).toBe("Group Chat 2b");
        expect(body.groupChat.createdById).toBe(user.id);

        const { groupChats } = await auth.api.getGroupChats({
          headers,
        });
        expect(groupChats.length).toBe(2);
        expect(groupChats[0].name).toBeOneOf(["Group Chat 1b", "Group Chat 2b"]);
        expect(groupChats[0].createdById).toBe(user.id);
        expect(groupChats[1].name).toBeOneOf(["Group Chat 1b", "Group Chat 2b"]);
        expect(groupChats[1].createdById).toBe(user.id);
        expect(groupChats[0].id).not.toBe(groupChats[1].id);
      });

      it("should work if the group chat have 1 less member", async () => {

        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends.length).toBe(3);

        const response = await auth.api.createGroupChat({
          body: {
            name: "Group Chat 3b",
            memberIds: [friends[0].friendId],
          },
          headers,
          asResponse: true,
        });
        const body = await response.json();
        expect(body.groupChat).toBeDefined();
        expect(body.groupChat.name).toBe("Group Chat 3b");
        expect(body.groupChat.createdById).toBe(user.id);
      });

      it("should work if the group chat have 1 more member", async () => {
        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends.length).toBe(3);
        
        const response = await auth.api.createGroupChat({
          body: {
            name: "Group Chat 4b",
            memberIds: [friends[0].friendId, friends[1].friendId, friends[2].friendId],
          },
          headers,
          asResponse: true,
        });
        const body = await response.json();
        expect(body.groupChat).toBeDefined();
        expect(body.groupChat.name).toBe("Group Chat 4b");
        expect(body.groupChat.createdById).toBe(user.id);
      });

    });
  });
});