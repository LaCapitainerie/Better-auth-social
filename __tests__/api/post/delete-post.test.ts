import { describe, it, expect } from "vitest";
import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { errorMessageToCode, ERROR_MESSAGES } from "../../../src/error.ts";

describe("API - Delete Post", async () => {
  const { auth, signInWithTestUser } = await getTestInstance({
    plugins: [socialNetwork()],
  }, {
    clientOptions: {
      plugins: [socialNetworkClient()],
    },
  });

  const { runWithUser, user } = await signInWithTestUser();
  await runWithUser(async (headers) => {

    it("should raise an error if post is not found", async () => {
      const response = await auth.api.deletePost({
        body: {
          postId: "non-existent-post-id",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.NOT_FOUND));
      expect(body.message).toBe(ERROR_MESSAGES.NOT_FOUND);
    });

    it("should return success true if post if found and deleted", async () => {
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

      const response = await auth.api.deletePost({
        body: {
          postId: post.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    it("should raise an error if post is found but not owned by the user", async () => {
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
      
      const { user: foreignUser, token: tokenForeignUser } = await auth.api.signUpEmail({
        body: {
          name: "foreign-user",
          email: "foreign-user@example.com",
          password: "password",
        },
      });
      expect(foreignUser).toBeDefined();
      expect(tokenForeignUser).toBeDefined();

      const response = await auth.api.deletePost({
        body: {
          postId: post.id,
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser}`,
        },
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.FORBIDDEN));
      expect(body.message).toBe(ERROR_MESSAGES.FORBIDDEN);
    });

  });
});