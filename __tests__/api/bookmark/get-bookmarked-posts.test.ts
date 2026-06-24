import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";

describe("API - Get Bookmarked Posts", async () => {
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

    it("return an empty list if no post were bookmarked by the user", async () => {
      const response = await auth.api.getBookmarkedPosts({
        query: {
          page: 1,
          limit: 10,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.posts).toBeDefined();
      expect(body.posts.length).toBe(0);
    });

    it("return a list of bookmarked posts by the user", async () => {

      const responseAddBookmark = await auth.api.addPostToBookmarks({
        headers,
        body: {
          postId: post.id,
        },
        asResponse: true,
      });
      const bodyAddBookmark = await responseAddBookmark.json();
      expect(bodyAddBookmark.postBookmark).toBeDefined();
      expect(bodyAddBookmark.postBookmark.postId).toBe(post.id);
      expect(bodyAddBookmark.postBookmark.userId).toBe(user.id);
      expect(bodyAddBookmark.postBookmark.createdAt).toBeDefined();
      expect(bodyAddBookmark.postBookmark.updatedAt).toBeDefined();

      const responseGetBookmarkedPosts = await auth.api.getBookmarkedPosts({
        query: {
          page: 1,
          limit: 10,
        },
        headers,
        asResponse: true,
      });
      const bodyGetBookmarkedPosts = await responseGetBookmarkedPosts.json();
      expect(bodyGetBookmarkedPosts.posts).toBeDefined();
      expect(bodyGetBookmarkedPosts.posts.length).toBe(1);
      expect(bodyGetBookmarkedPosts.posts[0].postId).toBe(post.id);
      expect(bodyGetBookmarkedPosts.posts[0].userId).toBe(user.id);
      expect(bodyGetBookmarkedPosts.posts[0].createdAt).toBeDefined();
      expect(bodyGetBookmarkedPosts.posts[0].updatedAt).toBeDefined();
    });
  });
});
