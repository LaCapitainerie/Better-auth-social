import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - Add Post to Bookmark", async () => {
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

    const { post } = await auth.api.createPost({
      body: {
        content: "Hello, world!",
      },
      headers,
    });
    expect(post).toBeDefined();
    expect(post.content).toBe("Hello, world!");
    expect(post.posterId).toBe(user.id);
    expect(post.createdAt).toBeDefined();
    expect(post.updatedAt).toBeDefined();

    it("should raise an error if the post doesn't exist", async () => {
      const response = await auth.api.addPostToBookmarks({
        body: {
          postId: "non-existent-post-id",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.POST_NOT_FOUND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.POST_NOT_FOUND.message);
    });

    it("should raise an error if the post exist but is not visible from the user", async () => {

      const { user: otherUser, token: otherToken } = await auth.api.signUpEmail({
        body: {
          name: "Other User",
          email: "other@example.com",
          password: "password",
        },
      });
      expect(otherUser).toBeDefined();
      expect(otherToken).toBeDefined();

      const { post: otherPost } = await auth.api.createPost({
        body: {
          content: "Hello, world! from other user",
          private: true,
        },
        headers: {
          Authorization: `Bearer ${otherToken}`,
        },
      });
      expect(otherPost).toBeDefined();
      expect(otherPost.content).toBe("Hello, world! from other user");
      expect(otherPost.posterId).toBe(otherUser.id);
      expect(otherPost.createdAt).toBeDefined();
      expect(otherPost.updatedAt).toBeDefined();

      const response = await auth.api.addPostToBookmarks({
        headers,
        body: {
          postId: otherPost.id,
        },
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.POST_NOT_FOUND.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.POST_NOT_FOUND.message);
    });

    it("should bookmark the post if the post exist and is visible from the user", async () => {
      const response = await auth.api.addPostToBookmarks({
        headers,
        body: {
          postId: post.id,
        },
        asResponse: true,
      });
      const body = await response.json();
      expect(body.postBookmark).toBeDefined();
      expect(body.postBookmark.postId).toBe(post.id);
      expect(body.postBookmark.userId).toBe(user.id);
      expect(body.postBookmark.createdAt).toBeDefined();
      expect(body.postBookmark.updatedAt).toBeDefined();
    });

    it("should return the existing bookmark if the post is already bookmarked", async () => {
      const response = await auth.api.addPostToBookmarks({
        headers,
        body: {
          postId: post.id,
        },
        asResponse: true,
      });
      const body = await response.json();
      expect(body.postBookmark).toBeDefined();
      expect(body.postBookmark.postId).toBe(post.id);
      expect(body.postBookmark.userId).toBe(user.id);
      expect(body.postBookmark.createdAt).toBeDefined();
      expect(body.postBookmark.updatedAt).toBeDefined();
    });
  });
});
