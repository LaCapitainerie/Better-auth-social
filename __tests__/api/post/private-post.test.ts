import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";

describe("API - Private Post", async () => {
  const { auth, signInWithTestUser } = await getTestInstance(
    {
      plugins: [socialNetwork()],
    },
    {
      clientOptions: {
        plugins: [socialNetworkClient()],
      },
    },
  );

  const { runWithUser, user } = await signInWithTestUser();
  await runWithUser(async (headers) => {

    const { user: otherUser, token: otherToken } = await auth.api.signUpEmail({
      body: {
        name: "Other User",
        email: "other@example.com",
        password: "password",
      },
    });
    expect(otherUser).toBeDefined();
    expect(otherToken).toBeDefined();

    const { post: publicPost } = await auth.api.createPost({
      body: {
        content: "Hello, world!",
        private: false,
      },
      headers: {
        Authorization: `Bearer ${otherToken}`,
      },
    });
    expect(publicPost).toBeDefined();
    expect(publicPost.private).toBe(false);

    const { post: privatePost } = await auth.api.createPost({
      body: {
        content: "Hello, world!",
        private: true,
      },
      headers: {
        Authorization: `Bearer ${otherToken}`,
      },
    });
    expect(privatePost).toBeDefined();
    expect(privatePost.private).toBe(true);

    it("should return only public posts if the user fetching is unknown", async () => {

      const { posts } = await auth.api.getPostsFromUser({
        query: {
          userId: otherUser.id,
        },
        headers,
      });

      expect(posts).toBeDefined();
      expect(posts.length).toBe(1);
    });

    it("should return public and private posts if the user fetching is a contact", async () => {

      const { friendRequest } = await auth.api.sendFriendRequest({
        body: {
          receiverId: otherUser.id,
        },
        headers,
      });
      expect(friendRequest).toBeDefined();
      expect(friendRequest.senderId).toBe(user.id);
      expect(friendRequest.receiverId).toBe(otherUser.id);
      expect(friendRequest.status).toBe("pending");

      const { success: acceptFriendRequestSuccess } = await auth.api.acceptFriendRequest({
        body: {
          requestId: friendRequest.id,
        },
        headers: {
          Authorization: `Bearer ${otherToken}`,
        },
      });
      expect(acceptFriendRequestSuccess).toBe(true);

      const { posts } = await auth.api.getPostsFromUser({
        query: {
          userId: otherUser.id,
        },
        headers,
      });

      expect(posts).toBeDefined();
      expect(posts.length).toBe(2);
    });
  });
});
