import { describe, it, expect, beforeAll } from "vitest";
import { socialNetwork } from "../../src/index.ts";
import { socialNetworkClient } from "../../src/client.ts";
import { getTestInstance } from "better-auth/test";
import { ZodError } from "zod";
import { errorMessageToCode, ERROR_MESSAGES } from "../../src/error.ts";

describe("Options - Maximum Group Size", () => {
  describe("set to less than 2", async () => {
    it("should return an error if value is less than 2", async () => {
      expect(() => getTestInstance({
        plugins: [socialNetwork({
          maxGroupSize: 1,
        })],
      })).toThrow(ZodError);
    });
  });

  describe("set to greater than 2", () => {
    it("should work if value is greater than 2", async () => {
      expect(() => getTestInstance({
        plugins: [socialNetwork({
          maxGroupSize: 3,
        })],
      })).not.toThrow(ZodError);
    });

    describe("with maxGroupSize set to 3", async () => {
      const { auth, signInWithTestUser } = await getTestInstance({
        plugins: [socialNetwork({
          maxGroupSize: 3,
        })],
      });
      const { runWithUser, user } = await signInWithTestUser();
      await runWithUser(async (headers) => {

        beforeAll(async () => {

          await Promise.all(Array.from({ length: 3 }).map(async (_, index) => {
            return auth.api.signUpEmail({
              body: {
                name: `Foreign User ${index + 1}`,
                email: `foreign-user${index + 1}@example.com`,
                password: "password",
              },
            })
              .then(async ({ user: foreignUser, token: tokenForeignUser }) => await auth.api.sendFriendRequest({
                body: {
                  receiverId: foreignUser.id,
                },
                headers,
              })
                .then(async ({ friendRequest }) => await auth.api.acceptFriendRequest({
                  body: {
                    requestId: friendRequest.id,
                  },
                  headers: {
                    Authorization: `Bearer ${tokenForeignUser?.toString()}`,
                  },
                })
                  .then(async ({ success: acceptFriendRequestSuccess }) =>
                    expect(acceptFriendRequestSuccess).toBe(true)
                  )
                )
              );
          }));

          const { friends } = await auth.api.getFriends({
            headers,
          });
          expect(friends.length).toBe(3);
          
        });

        it("should raise an error if trying to create a group chat with more than the maximum size", async () => {
          const { friends } = await auth.api.getFriends({
            headers,
          });
          expect(friends.length).toBe(3);

          const response = await auth.api.createGroupChat({
            body: {
              name: "Group Chat",
              memberIds: friends.map(f => f.friendId),
            },
            headers,
            asResponse: true,
          });
          const body = await response.json();
          expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.TOO_LARGE));
          expect(body.message).toBe(ERROR_MESSAGES.TOO_LARGE);
        });

        it("should raise an error if the user tries to add a member to a group chat that is already at the maximum size", async () => {
          const { friends } = await auth.api.getFriends({
            headers,
          });
          expect(friends.length).toBe(3);

          const { groupChat } = await auth.api.createGroupChat({
            body: {
              name: "Group Chat",
              memberIds: friends.slice(0, 2).map(f => f.friendId),
            },
            headers,
          });
          expect(groupChat).toBeDefined();
          expect(groupChat.name).toBe("Group Chat");

          const response = await auth.api.addMemberToGroupChat({
            body: {
              groupChatId: groupChat.id,
              userId: friends[2].friendId,
            },
            headers,
            asResponse: true,
          });
          const body = await response.json();
          expect(body.code).toBe(errorMessageToCode(ERROR_MESSAGES.MAX_SIZE_REACHED));
          expect(body.message).toBe(ERROR_MESSAGES.MAX_SIZE_REACHED);
        });


      });
    });
  });
});