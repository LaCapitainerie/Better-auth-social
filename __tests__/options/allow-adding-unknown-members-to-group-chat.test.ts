import { describe, it, expect, beforeAll } from "vitest";
import { getTestInstance } from "better-auth/test";
import { errorMessageToCode, ERROR_MESSAGES } from "../../src/error.ts";
import { socialNetworkClient } from "../../src/client.ts";
import { socialNetwork } from "../../src/index.ts";

describe("Options - Allow Adding Unknown Members to Group Chat", async () => {

  describe("option set to true", async () => {

    const { auth, signInWithTestUser } = await getTestInstance({
      plugins: [socialNetwork({
        allowAddingUnknownMembersToGroupChat: true,
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
      });

      it("creating a group chat with an unknown member should work when the foreignUser is not a friend", async () => {
        const { user: unknownUser, token: tokenUnknownUser } = await auth.api.signUpEmail({
          body: {
            name: "Unknown User",
            email: "unknown-user-option-true-create-group-chat@example.com",
            password: "password",
          },
        });
        expect(unknownUser).toBeDefined();
        expect(tokenUnknownUser).toBeDefined();
        
        const { groupChat } = await auth.api.createGroupChat({
          body: {
            name: "Group Chat",
            memberIds: [user.id, unknownUser.id],
          },
          headers,
        });
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe("Group Chat");
        expect(groupChat.createdById).toBe(user.id);
        const { members } = await auth.api.getGroupChatMembers({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        });
        expect(members).toBeDefined();
        expect(members.length).toBe(2);
        expect(members.find(m => m.userId === user.id)?.role).toBe('admin');
        expect(members.find(m => m.userId === unknownUser.id)?.role).toBe('member');
      });
  
      it("creating a group chat with an unknown member should work when the foreignUser is a friend", async () => {
        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends).toBeDefined();
        expect(friends.length).toBe(1);
        const foreignUser = friends[0];
        const { groupChat } = await auth.api.createGroupChat({
          body: {
            name: "Group Chat",
            memberIds: [user.id, foreignUser.friendId],
          },
          headers,
        });
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe("Group Chat");
        expect(groupChat.createdById).toBe(user.id);
        const { members } = await auth.api.getGroupChatMembers({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        });
        expect(members).toBeDefined();
        expect(members.length).toBe(2);
        expect(members.find(m => m.userId === user.id)?.role).toBe('admin');
        expect(members.find(m => m.userId === foreignUser.friendId)?.role).toBe('member');
      });

      it("adding an unknown member to a group chat should work when the foreignUser is not a friend", async () => {
        const { groupChat } = await auth.api.createGroupChat({
          body: {
            name: "Group Chat",
            memberIds: [user.id],
          },
          headers,
        });
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe("Group Chat");

        const { user: unknownUser, token: tokenUnknownUser } = await auth.api.signUpEmail({
          body: {
            name: "Unknown User",
            email: "unknown-user-option-true-add-member-to-group-chat@example.com",
            password: "password",
          },
        });
        expect(unknownUser).toBeDefined();
        expect(tokenUnknownUser).toBeDefined();

        const { success: addMemberToGroupChatSuccess } = await auth.api.addMemberToGroupChat({
          body: {
            groupChatId: groupChat.id,
            userId: unknownUser.id,
          },
          headers,
        });
        expect(addMemberToGroupChatSuccess).toBe(true);
        const { members } = await auth.api.getGroupChatMembers({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        });
        expect(members).toBeDefined();
        expect(members.length).toBe(2);
        expect(members.find(m => m.userId === user.id)?.role).toBe('admin');
        expect(members.find(m => m.userId === unknownUser.id)?.role).toBe('member');
      });

      it("adding an unknown member to a group chat should work when the foreignUser is a friend", async () => {
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
        const { members: initialMembers } = await auth.api.getGroupChatMembers({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        });
        expect(initialMembers).toBeDefined();
        expect(initialMembers.length).toBe(1);
        expect(initialMembers.find(m => m.userId === user.id)?.role).toBe('admin');

        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends).toBeDefined();
        expect(friends.length).toBe(1);
        const foreignUser = friends[0];

        const { success: addMemberToGroupChatSuccess } = await auth.api.addMemberToGroupChat({
          body: {
            groupChatId: groupChat.id,
            userId: foreignUser.friendId,
          },
          headers,
        });
        expect(addMemberToGroupChatSuccess).toBe(true);
        const { members: updatedMembers } = await auth.api.getGroupChatMembers({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        });
        expect(updatedMembers).toBeDefined();
        expect(updatedMembers.length).toBe(2);
        expect(updatedMembers.find(m => m.userId === user.id)?.role).toBe('admin');
        expect(updatedMembers.find(m => m.userId === foreignUser.friendId)?.role).toBe('member');
      });
    });
  });

  describe("option set to false", async () => {

    const { auth, signInWithTestUser } = await getTestInstance({
      plugins: [socialNetwork({
        allowAddingUnknownMembersToGroupChat: false,
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
      });

      it("creating a group chat with an unknown member should raise an error when the foreignUser is not a friend", async () => {
        const { user: unknownUser, token: tokenUnknownUser } = await auth.api.signUpEmail({
          body: {
            name: "Unknown User",
            email: "unknown-user-option-false-create-group-chat@example.com",
            password: "password",
          },
        });
        expect(unknownUser).toBeDefined();
        expect(tokenUnknownUser).toBeDefined();

        const response = await auth.api.createGroupChat({
          body: {
            name: "Group Chat",
            memberIds: [user.id, unknownUser.id],
          },
          headers,
          asResponse: true,
        });
        const body = await response.json();
        expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.BAD_REQUEST));
        expect(body.message).toBe(ERROR_MESSAGES.BAD_REQUEST);
      });

      it("creating a group chat with an unknown member should work when the foreignUser is a friend", async () => {
        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends).toBeDefined();
        expect(friends.length).toBe(1);
        const foreignUser = friends[0];
        const { groupChat } = await auth.api.createGroupChat({
          body: {
            name: "Group Chat",
            memberIds: [user.id, foreignUser.friendId],
          },
          headers,
        });
        expect(groupChat).toBeDefined();
        expect(groupChat.name).toBe("Group Chat");
        expect(groupChat.createdById).toBe(user.id);
        const { members } = await auth.api.getGroupChatMembers({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        });
        expect(members).toBeDefined();
        expect(members.length).toBe(2);
        expect(members.find(m => m.userId === user.id)?.role).toBe('admin');
        expect(members.find(m => m.userId === foreignUser.friendId)?.role).toBe('member');
      });

      it("adding an unknown member to a group chat should raise an error when the foreignUser is not a friend", async () => {
        /* const { groupChats } = await auth.api.getGroupChats({
          headers,
        });
        console.log(groupChats);
        await Promise.all(groupChats.map(async (groupChat) => {
          const { members } = await auth.api.getGroupChatMembers({
            query: {
              groupChatId: groupChat.id,
            },
            headers,
          });
          console.log(groupChat.id, members);
          
        })); */

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

        const { members } = await auth.api.getGroupChatMembers({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        });
        expect(members).toBeDefined();
        expect(members.length).toBe(1);
        expect(members.find(m => m.userId === user.id)?.role).toBe('admin');

        const { user: unknownUser, token: tokenUnknownUser } = await auth.api.signUpEmail({
          body: {
            name: "Unknown User",
            email: "unknown-user-option-false-add-member-to-group-chat@example.com",
            password: "password",
          },
        });
        expect(unknownUser).toBeDefined();
        expect(tokenUnknownUser).toBeDefined();

        const response = await auth.api.addMemberToGroupChat({
          body: {
            groupChatId: groupChat.id,
            userId: unknownUser.id,
          },
          headers,
          asResponse: true,
        });
        const body = await response.json();
        expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_FOUND));
        expect(body.message).toBe(ERROR_MESSAGES.NOT_FOUND);
      });

      it("adding an unknown member to a group chat should work when the foreignUser is a friend", async () => {
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

        const { members } = await auth.api.getGroupChatMembers({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        });
        expect(members).toBeDefined();
        expect(members.length).toBe(1);
        expect(members.find(m => m.userId === user.id)?.role).toBe('admin');

        const { friends } = await auth.api.getFriends({
          headers,
        });
        expect(friends).toBeDefined();
        expect(friends.length).toBe(1);

        const foreignUser = friends[0];
        const { success: addMemberToGroupChatSuccess } = await auth.api.addMemberToGroupChat({
          body: {
            groupChatId: groupChat.id,
            userId: foreignUser.friendId,
          },
          headers,
        });
        expect(addMemberToGroupChatSuccess).toBe(true);
        const { members: updatedMembers } = await auth.api.getGroupChatMembers({
          query: {
            groupChatId: groupChat.id,
          },
          headers,
        });
        expect(updatedMembers).toBeDefined();
        expect(updatedMembers.length).toBe(2);
        expect(updatedMembers.find(m => m.userId === user.id)?.role).toBe('admin');
        expect(updatedMembers.find(m => m.userId === foreignUser.friendId)?.role).toBe('member');
      });
    });

  });

});