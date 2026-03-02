import { describe, it, expect } from "vitest";
import { getTestInstance } from "better-auth/test";

import { socialNetwork } from "../../../src/index.ts";
import { socialNetworkClient } from "../../../src/client.ts";
import { SOCIAL_NETWORK_ERROR_CODES } from "../../../src/error.ts";

describe("API - Create Post", async () => {
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
    it("should raise an error if content is empty or undefined", async () => {
      const response = await auth.api.createPost({
        body: {
          content: "",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.code).toBe(SOCIAL_NETWORK_ERROR_CODES.POST_CONTENT_REQUIRED.code);
      expect(body.message).toBe(SOCIAL_NETWORK_ERROR_CODES.POST_CONTENT_REQUIRED.message);
    });

    it("should return a post if success", async () => {
      const response = await auth.api.createPost({
        body: {
          content: "Hello, world!",
        },
        headers,
        asResponse: true,
      });
      const body = await response.json();
      expect(body.post).toBeDefined();
      expect(body.post.content).toBe("Hello, world!");
      expect(body.post.posterId).toBe(user.id);
      expect(body.post.createdAt).toBeDefined();
      expect(body.post.updatedAt).toBeDefined();
    });
  });
});
