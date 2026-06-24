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
      const response = await auth.api.removePostFromBookmarks({
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

    it("should work if the post exist and is not bookmarked by the user", async () => {
      const response = await auth.api.removePostFromBookmarks({
        body: {
          postId: post.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.success).toBe(true);

      const { posts } = await auth.api.getBookmarkedPosts({
        query: {
          page: 1,
          limit: 10,
        },
        headers,
      });
      expect(posts).toBeDefined();
      expect(posts.length).toBe(0);
    });

    it("should work if the post exist and is bookmarked by the user", async () => {
      const { postBookmark } = await auth.api.addPostToBookmarks({
        body: {
          postId: post.id,
        },
        headers,
      });
      expect(postBookmark).toBeDefined();
      expect(postBookmark.postId).toBe(post.id);
      expect(postBookmark.userId).toBe(user.id);
      expect(postBookmark.createdAt).toBeDefined();
      expect(postBookmark.updatedAt).toBeDefined();

      const { posts: initialPosts } = await auth.api.getBookmarkedPosts({
        query: {
          page: 1,
          limit: 10,
        },
        headers,
      });
      expect(initialPosts).toBeDefined();
      expect(initialPosts.length).toBe(1);

      const response = await auth.api.removePostFromBookmarks({
        body: {
          postId: post.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.success).toBe(true);

      const { posts } = await auth.api.getBookmarkedPosts({
        query: {
          page: 1,
          limit: 10,
        },
        headers,
      });
      expect(posts).toBeDefined();
      expect(posts.length).toBe(0);
    });
  });
});
