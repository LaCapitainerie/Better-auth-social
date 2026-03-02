import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - Get Group Chats", async () => {
  const { auth, signInWithTestUser } = await getTestInstance(
    {
      plugins: [
        socialNetwork({
          allowSelfFriendRequest: true,
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
    it("should raise an error if group chat is not found", async () => {
      const response = await auth.api.leaveGroupChat({
        body: {
          groupChatId: "non-existent-group-chat-id",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.message);
    });

    it("should return success true if group chat is found and user belong to it", async () => {
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

      const response = await auth.api.leaveGroupChat({
        body: {
          groupChatId: groupChat.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    it("should raise an error if user does not belong to group chat", async () => {
      const { user: foreignUser, token } = await auth.api.signUpEmail({
        body: {
          name: "Foreign User",
          email: "foreign-user@example.com",
          password: "password",
        },
      });

      const { groupChat } = await auth.api.createGroupChat({
        body: {
          name: "Group Chat",
          memberIds: [foreignUser.id],
        },
        headers: {
          Authorization: `Bearer ${token?.toString()}`,
        },
      });

      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(foreignUser.id);

      const response = await auth.api.leaveGroupChat({
        body: {
          groupChatId: groupChat.id,
        },
        headers,
        asResponse: true,
      });

      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.message);
    });
  });
});
