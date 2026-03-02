import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";

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
    it("should return an empty list if user does not have group chat", async () => {
      const response = await auth.api.getGroupChats({
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.groupChats).toBeDefined();
      expect(body.groupChats.length).toBe(0);
    });

    it("should return a groupchat list if user belong to one or more group chat", async () => {
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

      const response = await auth.api.getGroupChats({
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.groupChats).toBeDefined();
      expect(body.groupChats.length).toBe(1);
      expect(body.groupChats[0].name).toBe("Group Chat");
      expect(body.groupChats[0].createdById).toBe(user.id);
    });
  });
});
