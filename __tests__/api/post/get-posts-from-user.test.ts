import { describe, it, expect } from "vitest";
import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { getTestInstance } from "better-auth/test";

describe("API - getPostsFromUser", async () => {
  const { auth, signInWithTestUser } = await getTestInstance({
    plugins: [socialNetwork()],
  }, {
    clientOptions: {
      plugins: [socialNetworkClient()],
    },
  });

  const { runWithUser, user } = await signInWithTestUser();
  await runWithUser(async (headers) => {
    it("should return an empty list if user is not found", async () => {
      const response = await auth.api.getPostsFromUser({
        query: {
          userId: "non-existent-user-id",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.posts).toBeDefined();
      expect(body.posts.length).toBe(0);
    });

    it("should return an empty list if user is found but has not post", async () => {
      const response = await auth.api.getPostsFromUser({
        query: {
          userId: user.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.posts).toBeDefined();
      expect(body.posts.length).toBe(0);
    });

    it("should return a post list if user is found and has some post", async () => {
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

      const response = await auth.api.getPostsFromUser({
        query: {
          userId: user.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.posts).toBeDefined();
      expect(body.posts.length).toBe(1);
      expect(body.posts[0].content).toBe("Hello, world!");
      expect(body.posts[0].posterId).toBe(user.id);
      expect(body.posts[0].createdAt).toBeDefined();
      expect(body.posts[0].updatedAt).toBeDefined();
    });
  });
});