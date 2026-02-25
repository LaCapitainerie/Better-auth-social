import { describe, it, expect } from "vitest";
import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { errorMessageToCode, ERROR_MESSAGES } from "../../../src/error.ts";

describe("API - likePost", async () => {
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
      const response = await auth.api.likePost({
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

    it("should return success true if post is found and like counter updated", async () => {
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

      const response = await auth.api.likePost({
        body: {
          postId: post.id,
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.post).toBeDefined();
      expect(body.post.likesCount).toBe(1);
    });

    it("should raise an error if post is found but already liked by the user", async () => {
      const { post } = await auth.api.createPost({
        body: {
          content: "Hello, world!",
        },
        headers,
      });

      const responseFirstLike = await auth.api.likePost({
        body: {
          postId: post.id,
        },
        headers,
        asResponse: true,
      });
      const bodyFirstLike = await responseFirstLike.json();
      expect(bodyFirstLike.post).toBeDefined();
      expect(bodyFirstLike.post.likesCount).toBe(1);

      const responseSecondLike = await auth.api.likePost({
        body: {
          postId: post.id,
        },
        headers,
        asResponse: true,
      });
      const bodySecondLike = await responseSecondLike.json();
      expect(bodySecondLike.code).toBe(errorMessageToCode(ERROR_MESSAGES.ALREADY_LIKED));
      expect(bodySecondLike.message).toBe(ERROR_MESSAGES.ALREADY_LIKED);
    });

    it("should return an updated likes count if post is liked by a foreign user", async () => {
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
      expect(post.likesCount).toBe(0);

      const { user: foreignUser, token: tokenForeignUser } = await auth.api.signUpEmail({
        body: {
          name: "Foreign User",
          email: "foreign-user@example.com",
          password: "password",
        },
      });

      expect(foreignUser).toBeDefined();
      expect(tokenForeignUser).toBeDefined();

      const response = await auth.api.likePost({
        body: {
          postId: post.id,
        },
        headers: {
          Authorization: `Bearer ${tokenForeignUser}`,
        },
        asResponse: true,
      });
      const body = await response.json();
      expect(body.post).toBeDefined();
      expect(body.post.likesCount).toBe(1);

      expect(body.post).toBeDefined();
      expect(body.post.likesCount).toBe(1);
      expect(body.post.posterId).toBe(user.id);
      expect(body.post.createdAt).toBeDefined();
      expect(body.post.updatedAt).toBeDefined();
      expect(body.post.likesCount).toBe(1);

      const responseSecondLike = await auth.api.likePost({
        body: {
          postId: post.id,
        },
        headers,
        asResponse: true,
      });
      const bodySecondLike = await responseSecondLike.json();
      expect(bodySecondLike.post).toBeDefined();
      expect(bodySecondLike.post.likesCount).toBe(2);
    });
  });
});