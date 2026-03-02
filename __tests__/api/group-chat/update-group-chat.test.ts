import { describe, it, expect, beforeAll } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - updateGroupChat", async () => {
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
          memberIds: [user.id, foreignUser.id],
        },
        headers,
      });
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);
    });

    it("should raise an error if group chat is not found", async () => {
      const response = await auth.api.updateGroupChat({
        body: {
          id: "non-existent-group-chat-id",
          name: "Does Not Exist",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND.message);
    });

    it("should raise an error if group chat is found but user is not an admin of it", async () => {
      const { user: foreignUser, token: tokenForeignUser } =
        await auth.api.signInEmail({
          body: {
            email: "foreign-user@example.com",
            password: "password",
          },
        });
      expect(foreignUser).toBeDefined();
      expect(tokenForeignUser).toBeDefined();

      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];

      const response = await auth.api.updateGroupChat({
        body: {
          id: groupChat.id,
          name: "Does Not Exist",
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser.toString()}`,
        },
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_ADMIN.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_ADMIN.message);
    });

    it("should return the updated group chat if group chat is found and user is an admin of it", async () => {
      const { groupChats } = await auth.api.getGroupChats({
        headers,
      });
      expect(groupChats).toBeDefined();
      expect(groupChats.length).toBe(1);
      const groupChat = groupChats[0];
      expect(groupChat).toBeDefined();
      expect(groupChat.name).toBe("Group Chat");
      expect(groupChat.createdById).toBe(user.id);
      expect(groupChat.description).toBe(null);

      const response = await auth.api.updateGroupChat({
        body: {
          id: groupChat.id,
          name: "Updated Group Chat",
          description: "Updated group chat description",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.updatedGroupChat).toBeDefined();
      expect(body.updatedGroupChat.name).toBe("Updated Group Chat");
      expect(body.updatedGroupChat.description).toBe(
        "Updated group chat description",
      );
      expect(body.updatedGroupChat.createdById).toBe(user.id);
    });
  });
});
