import { describe, it, expect } from "vitest";
import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { errorMessageToCode, ERROR_MESSAGES } from "../../../src/error.ts";

describe("API - Create Group Chat", async () => {
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

    it("should raise an error if name is empty or undefined", async () => {
      const response = await auth.api.createGroupChat({
        body: {
          name: "",
          memberIds: [user.id],
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.BAD_REQUEST));
      expect(body.message).toBe(ERROR_MESSAGES.BAD_REQUEST);
    });

   it("should raise an error if one or more User doesn't exist", async () => {
    const response = await auth.api.createGroupChat({
      body: {
        name: "Group Chat",
        memberIds: [user.id, "non-existent-user-id"],
      },
      headers,
      asResponse: true,
    });
    const body = await response.json();
    expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.BAD_REQUEST));
    expect(body.message).toBe(ERROR_MESSAGES.BAD_REQUEST);
   });

   it("should return the group chat if the name is defined and every User exist", async () => {
    const { user: foreignUser, token } = await auth.api.signUpEmail({
      body: {
        name: "Foreign User",
        email: "foreign-user@example.com",
        password: "password",
      },
    });

    const { friendRequest } = await auth.api.sendFriendRequest({
      body: {
        receiverId: foreignUser.id,
      },
      headers,
    });
    expect(friendRequest).toBeDefined();
    expect(friendRequest.senderId).toBe(user.id);
    expect(friendRequest.receiverId).toBe(foreignUser.id);
    expect(friendRequest.status).toBe('pending');

    const { success: acceptFriendRequestSuccess } = await auth.api.acceptFriendRequest({
      body: {
        requestId: friendRequest.id,
      },
      headers: {
        Authorization: `Bearer ${token?.toString()}`,
      },
    });
    expect(acceptFriendRequestSuccess).toBe(true);

    const { isFriend } = await auth.api.isFriend({
      query: {
        friendId: foreignUser.id,
      },
      headers,
    });
    expect(isFriend).toBe(true);
    

    const { groupChat } = await auth.api.createGroupChat({
      body: {
        name: "Group Chat",
        memberIds: [foreignUser.id],
      },
      headers,
    });
    
    expect(groupChat).toBeDefined();
    expect(groupChat.name).toBe("Group Chat");
    expect(groupChat.createdById).toBe(user.id);
   });
  });
});