import { describe, it, expect, beforeAll } from "vitest";
import { socialNetwork } from "../src/index.ts";
import { socialNetworkClient } from "../src/client.ts";
import { getTestInstance } from "better-auth/test";

describe("API - Get Friend Requests Sent", async () => {
  const { auth, signInWithTestUser } = await getTestInstance({
    plugins: [socialNetwork()],
  }, {
    clientOptions: {
      plugins: [socialNetworkClient()],
    },
  });

  const { runWithUser, user } = await signInWithTestUser();
  await runWithUser(async (headers) => {

    describe("without any friend request", async () => {

      it("without any filter it should return an empty array", async () => {
        const response = await auth.api.getFriendRequestsSent({
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(0);
      });

      it("filtering request by pending status should return an empty array", async () => {

        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'pending',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(0);
      });

      it("filtering request by accepted status should return an empty array", async () => {
        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'accepted',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(0);
      });

      it("filtering request by rejected status should return an empty array", async () => {
        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'rejected',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(0);
      });

    });

    describe("with a pending friend request", async () => {

      beforeAll(async () => {
        const { friendRequest } = await auth.api.sendFriendRequest({
          body: {
            receiverId: user.id,
          },
          headers,
        });

        expect(friendRequest).toBeDefined();
        expect(friendRequest.senderId).toBe(user.id);
        expect(friendRequest.receiverId).toBe(user.id);
        expect(friendRequest.status).toBe('pending');
      });


      it("without any filter it should return the pending friend request", async () => {
        const response = await auth.api.getFriendRequestsSent({
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(1);
      });

      it("filtering request by pending status should return the pending friend request", async () => {
        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'pending',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(1);
      });

      it("filtering request by accepted status should return an empty array", async () => {
        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'accepted',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(0);
      });

      it("filtering request by rejected status should return an empty array", async () => {
        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'rejected',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(0);
      });

    });

    describe("with a rejected friend request", async () => {
      beforeAll(async () => {
        const { success: rejectAllSuccess } = await auth.api.rejectAllFriendRequests({
          headers,
        });

        expect(rejectAllSuccess).toBe(true);
      });

      it("without any filter it should return the rejected friend request", async () => {
        const response = await auth.api.getFriendRequestsSent({
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(1);
      });

      it("filtering request by pending status should return an empty array", async () => {
        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'pending',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(0);
      });

      it("filtering request by accepted status should return an empty array", async () => {
        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'accepted',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(0);
      });

      it("filtering request by rejected status should return the rejected friend request", async () => {
        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'rejected',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(1);
      });
    });

    describe("with a accepted friend request", async () => {
      beforeAll(async () => {
        const { friendRequest } = await auth.api.sendFriendRequest({
          body: {
            receiverId: user.id,
          },
          headers,
        });

        expect(friendRequest).toBeDefined();
        expect(friendRequest.senderId).toBe(user.id);
        expect(friendRequest.receiverId).toBe(user.id);
        expect(friendRequest.status).toBe('pending');

        const { success: acceptFriendRequestSuccess } = await auth.api.acceptFriendRequest({
          body: {
            requestId: friendRequest.id,
          },
          headers,
        });

        expect(acceptFriendRequestSuccess).toBe(true);
      });

      it("without any filter it should return the accepted friend request", async () => {
        const response = await auth.api.getFriendRequestsSent({
          headers,
          asResponse: true,
        });

        const body = await response.json();

        // Accepted Request + Rejected Request From the Previous Test
        expect(body.sent.length).toBe(2);
      });

      it("filtering request by pending status should return an empty array", async () => {
        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'pending',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(0);
      });

      it("filtering request by accepted status should return the accepted friend request", async () => {
        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'accepted',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        expect(body.sent.length).toBe(1);
      });

      it("filtering request by rejected status should return an empty array", async () => {
        const response = await auth.api.getFriendRequestsSent({
          query: {
            status: 'rejected',
          },
          headers,
          asResponse: true,
        });

        const body = await response.json();

        // Rejected Request From the Previous Test
        expect(body.sent.length).toBe(1);
      });
    });

  });

});