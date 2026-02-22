import { mergeSchema } from 'better-auth/db';
import { BetterAuthPlugin, Where } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { z } from 'zod';

import { getSchema } from './schema.js';
import { ERROR_MESSAGES } from './error.js';
import type { SocialNetworkOptions } from './options.js';
import { FriendRequest, Friend, Chat, GroupChat, GroupChatMember, ChatMessage, GroupChatMessage } from './types.js';

export const socialNetwork = (options?: SocialNetworkOptions) => {
  const allowSelfFriendRequest = options?.allowSelfFriendRequest || false;
  const allowMultipleGroupChatWithSamePerson = options?.allowMultipleGroupChatWithSamePerson || false;
  const hooks = options?.hooks || {};

  // Helper function to get max group size
  const getMaxGroupSize = async (): Promise<number | undefined> => {
    if (options?.maxGroupSize === undefined) {
      return undefined;
    }
    if (typeof options.maxGroupSize === 'number') {
      return options.maxGroupSize;
    }
    return await options.maxGroupSize();
  };

  const zResponseSuccess = z.object({
    success: z.boolean(),
  });




  // Source - https://stackoverflow.com/a/64489535
  // Posted by nkitku, modified by community. See post 'Timeline' for change history
  // Retrieved 2026-02-21, License - CC BY-SA 4.0

  const groupBy = <T>(array: T[], predicate: (value: T, index: number, array: T[]) => string) =>
    array.reduce((acc, value, index, array) => {
      (acc[predicate(value, index, array)] ||= []).push(value);
      return acc;
    }, {} as { [key: string]: T[] });


    const setsAreEqual = <T>(set1: Set<T>, set2: Set<T>): boolean => {
      if (set1.size !== set2.size) return false;
      for (const item of set1) {
        if (!set2.has(item)) return false;
      }
      return true;
    }


  return {
    id: 'social-network',
    schema: mergeSchema(getSchema()),
    endpoints: {
      sendFriendRequest: createAuthEndpoint('/social/friend-request/send', {
        method: "POST",
        body: z.object({
          receiverId: z.string(),
        }),
        response: z.object({
          friendRequest: FriendRequest,
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {

        const { receiverId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        if (!allowSelfFriendRequest && userId === receiverId) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.SELF_REQUEST_NOT_ALLOWED });
        }

        const { adapter, internalAdapter } = ctx.context;

        const foreignUser = await internalAdapter.findUserById(receiverId);
        if (!foreignUser) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        // Check if users are already friends
        const existingFriend = await adapter.findOne<Friend>({
          model: 'friend',
          where: [
            { field: 'userId', value: userId },
            { field: 'friendId', value: foreignUser.id }
          ]
        });

        if (existingFriend) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.ALREADY_FRIENDS });
        }

        // Check if there's already a pending request
        const existingRequest = await adapter.findOne<FriendRequest>({
          model: 'friend_request',
          where: [
            { field: 'senderId', value: userId },
            { field: 'receiverId', value: foreignUser.id },
            { field: 'status', value: 'pending' }
          ]
        });

        if (existingRequest) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.ALREADY_SENT });
        }

        const friendRequest = await adapter.create<FriendRequest>({
          model: 'friend_request',
          data: {
            senderId: userId,
            receiverId: foreignUser.id,
            status: 'pending',
          }
        });

        // Call hook
        if (hooks.onFriendRequestSend) {
          await hooks.onFriendRequestSend(friendRequest);
        }

        return ctx.json({
          friendRequest
        })
      }),
      acceptFriendRequest: createAuthEndpoint('/social/friend-request/accept', {
        method: "POST",
        body: z.object({
          requestId: z.string(),
        }),
        response: zResponseSuccess,
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { requestId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        const friendRequest = await adapter.findOne<FriendRequest>({
          model: 'friend_request',
          where: [
            { field: 'id', value: requestId },
            { field: 'receiverId', value: userId }
          ]
        });

        if (!friendRequest) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        if (friendRequest.status !== 'pending') {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.NOT_PENDING });
        }

        const updatedRequest = await adapter.transaction(async (tx) => {
          // Update request status
          const updatedRequest = await tx.update<FriendRequest>({
            model: 'friend_request',
            where: [{ field: 'id', value: requestId }],
            update: {
              status: 'accepted',
            }
          });

          if (!updatedRequest) {
            throw new APIError('INTERNAL_SERVER_ERROR', { message: ERROR_MESSAGES.FAILED_TO_UPDATE });
          }

          // Create friend relationship (both directions)
          await tx.create<Friend>({
            model: 'friend',
            data: {
              userId: friendRequest.senderId,
              friendId: friendRequest.receiverId,
            }
          });

          if (allowSelfFriendRequest && friendRequest.senderId === friendRequest.receiverId) {
            return updatedRequest;
          }

          await tx.create<Friend>({
            model: 'friend',
            data: {
              userId: friendRequest.receiverId,
              friendId: friendRequest.senderId,
            }
          });

          return updatedRequest;
        });

        // Call hook
        if (hooks.onFriendRequestAccept) {
          await hooks.onFriendRequestAccept(updatedRequest);
        }

        return ctx.json({ success: true });
      }),
      rejectFriendRequest: createAuthEndpoint('/social/friend-request/reject', {
        method: "POST",
        body: z.object({
          requestId: z.string(),
        }),
        response: zResponseSuccess,
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { requestId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        const friendRequest = await adapter.findOne<FriendRequest>({
          model: 'friend_request',
          where: [
            { field: 'id', value: requestId },
            { field: 'receiverId', value: userId }
          ]
        });

        if (!friendRequest) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        if (friendRequest.status !== 'pending') {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.NOT_PENDING });
        }

        const updatedRequest = await adapter.transaction(async (tx) => {
          // Update request status
          const updatedRequest = await tx.update<FriendRequest>({
            model: 'friend_request',
            where: [{ field: 'id', value: requestId }],
            update: {
              status: 'rejected',
            }
          });

          if (!updatedRequest) {
            throw new APIError('INTERNAL_SERVER_ERROR', { message: ERROR_MESSAGES.FAILED_TO_UPDATE });
          }

          return updatedRequest;
        });

        // Call hook
        if (hooks.onFriendRequestReject) {
          await hooks.onFriendRequestReject(updatedRequest);
        }

        return ctx.json({ success: true });
      }),
      getFriendRequestsSent: createAuthEndpoint('/social/friend-request/sent/list', {
        method: "GET",
        query: z.object({
          page: z.number().optional().default(1),
          limit: z.number().optional().default(10),
          status: z.enum(['pending', 'accepted', 'rejected']).nullable(),
        }).optional().default({ page: 1, limit: 10, status: null }),
        response: z.object({ sent: z.array(FriendRequest) }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { page, limit, status } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        const where: Where[] = [{ field: 'senderId', value: userId }];
        if (status) {
          where.push({ field: 'status', value: status });
        }

        const sentRequests = await adapter.findMany<FriendRequest>({
          model: 'friend_request',
          where,
          limit: limit,
          offset: (page - 1) * (limit),
        });

        return ctx.json({ sent: sentRequests });
      }),
      getFriendRequestsReceived: createAuthEndpoint('/social/friend-request/received/list', {
        method: "GET",
        query: z.object({
          page: z.number().optional().default(1),
          limit: z.number().optional().default(10),
          status: z.enum(['pending', 'accepted', 'rejected']).nullable(),
        }).optional().default({ page: 1, limit: 10, status: null }),
        response: z.object({ received: z.array(FriendRequest) }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { page, limit, status } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        const where: Where[] = [{ field: 'receiverId', value: userId }];
        if (status) {
          where.push({ field: 'status', value: status });
        }

        const receivedRequests = await adapter.findMany<FriendRequest>({
          model: 'friend_request',
          where,
          limit: limit,
          offset: (page - 1) * (limit),
        });

        return ctx.json({ received: receivedRequests });
      }),
      rejectAllFriendRequests: createAuthEndpoint('/social/friend-request/reject-all', {
        method: "POST",
        response: zResponseSuccess,
        use: [sessionMiddleware],
      }, async (ctx) => {
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        const updatedRequests = await adapter.updateMany({
          model: 'friend_request',
          where: [{ field: 'receiverId', value: userId }, { field: 'status', value: 'pending' }],
          update: {
            status: 'rejected',
          }
        });

        return ctx.json({ success: true });
      }),



      getFriends: createAuthEndpoint('/social/friends/list', {
        method: "GET",
        query: z.object({
          page: z.number().optional().default(1),
          limit: z.number().optional().default(10),
        }).optional().default({ page: 1, limit: 10 }),
        response: z.object({
          friends: z.array(Friend),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { page, limit } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        const friends = await adapter.findMany<Friend>({
          model: 'friend',
          where: [{ field: 'userId', value: userId }],
          limit: limit,
          offset: (page - 1) * (limit),
        });

        return ctx.json({ friends });
      }),
      removeFriend: createAuthEndpoint('/social/friends/remove', {
        method: "POST",
        body: z.object({
          friendId: z.string(),
        }),
        response: z.object({
          success: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { friendId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const { adapter, internalAdapter } = ctx.context;

        const foreignUser = await internalAdapter.findUserById(friendId);
        if (!foreignUser) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.BAD_REQUEST });
        }

        await adapter.transaction(async (tx) => {

          const isFriend = await tx.findOne<Friend>({
            model: 'friend',
            where: [
              { field: 'userId', value: userId },
              { field: 'friendId', value: friendId }
            ]
          });
          if (!isFriend) {
            throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.NOT_FRIEND });
          }

          // Remove both directions
          await tx.delete({
            model: 'friend',
            where: [
              { field: 'userId', value: userId },
              { field: 'friendId', value: friendId }
            ]
          });

          if (allowSelfFriendRequest && userId === friendId) {
            return;
          }

          await tx.delete({
            model: 'friend',
            where: [
              { field: 'userId', value: friendId },
              { field: 'friendId', value: userId }
            ]
          });

        });

        // Call hook
        if (hooks.onFriendRemove) {
          await hooks.onFriendRemove({
            userId: userId,
            friendId: friendId,
          });
        }

        return ctx.json({ success: true });
      }),
      isFriend: createAuthEndpoint('/social/friends/is-friend', {
        method: "GET",
        query: z.object({
          friendId: z.string(),
        }),
        response: z.object({
          isFriend: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { friendId } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        if (!friendId) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.BAD_REQUEST });
        }

        const isFriend = await adapter.findOne<Friend>({
          model: 'friend',
          where: [
            { field: 'userId', value: userId },
            { field: 'friendId', value: friendId }
          ]
        });

        return ctx.json({ isFriend: !!isFriend });
      }),



      getOrCreateChat: createAuthEndpoint('/social/chat/get-or-create', {
        method: "GET",
        query: z.object({
          friendId: z.string(),
        }),
        response: z.object({
          chat: Chat,
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { friendId } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        if (!friendId) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.BAD_REQUEST });
        }

        // Check if users are friends
        const isFriend = await adapter.findOne<Friend>({
          model: 'friend',
          where: [
            { field: 'userId', value: userId },
            { field: 'friendId', value: friendId }
          ]
        });

        if (!isFriend) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.NOT_FRIENDS });
        }

        // Check if chat already exists
        const existingChat = await adapter.findOne<Chat>({
          model: 'chat',
          where: [
            { field: 'user1Id', value: [userId, friendId], operator: 'in' },
          ]
        });

        if (existingChat) {
          return ctx.json({ chat: existingChat });
        }

        const chat = await adapter.create<Chat>({
          model: 'chat',
          data: {
            user1Id: userId,
            user2Id: friendId,
          }
        });

        // Call hook
        if (hooks.onChatCreate) {
          await hooks.onChatCreate(chat);
        }

        return ctx.json({ chat });
      }),
      getChats: createAuthEndpoint('/social/chat/list', {
        method: "GET",
        query: z.object({
          page: z.number().optional().default(1),
          limit: z.number().optional().default(10),
        }).optional().default({ page: 1, limit: 10 }),
        response: z.object({
          chats: z.array(Chat),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { page, limit } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        const chats = await adapter.findMany<Chat>({
          model: 'chat',
          where: [
            { field: 'user1Id', value: userId, connector: 'OR' },
            { field: 'user2Id', value: userId, connector: 'OR' }
          ],
          limit: limit,
          offset: (page - 1) * (limit),
        });

        return ctx.json({ chats });
      }),



      getChatMessages: createAuthEndpoint('/social/chat-messages/list', {
        method: "GET",
        query: z.object({
          chatId: z.string(),
          page: z.number().optional().default(1),
          limit: z.number().optional().default(10),
        }),
        response: z.object({
          messages: z.array(ChatMessage),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { chatId, page, limit } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        // Verify user is part of the chat
        const chat = await adapter.findOne<Chat>({
          model: 'chat',
          where: [{ field: 'id', value: chatId }]
        });

        if (!chat) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        if (chat.user1Id !== userId && chat.user2Id !== userId) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        const messages = await adapter.findMany<ChatMessage>({
          model: 'chat_message',
          where: [
            {
              field: 'chatId',
              value: chatId,
              operator: 'eq',
              connector: 'AND'
            },
          ],
          limit: limit,
          offset: (page - 1) * (limit),
        }).then(messages => messages.filter(message => message.deletedAt === null));
        // TODO: Find a way to filter deleted messages by using the default Adapter filter

        return ctx.json({ messages });
      }),
      sendChatMessage: createAuthEndpoint('/social/chat-messages/send', {
        method: "POST",
        body: z.object({
          chatId: z.string(),
          content: z.string(),
        }),
        response: z.object({
          message: ChatMessage,
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { chatId, content } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        if (!content) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.BAD_REQUEST });
        }

        const adapter = ctx.context.adapter;

        // Verify user is part of the chat
        const chat = await adapter.findOne<Chat>({
          model: 'chat',
          where: [{ field: 'id', value: chatId }]
        });

        if (!chat) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        if (chat.user1Id !== userId && chat.user2Id !== userId) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        const message = await adapter.create<ChatMessage>({
          model: 'chat_message',
          data: {
            content: content,
            senderId: userId,
            chatId: chatId,
            deletedAt: null,
          }
        });

        // Call hook
        if (hooks.onChatMessageSend) {
          await hooks.onChatMessageSend(message);
        }

        return ctx.json({ message });
      }),
      deleteChatMessage: createAuthEndpoint('/social/chat-messages/delete', {
        method: "POST",
        body: z.object({
          chatMessageId: z.string(),
        }),
        response: z.object({
          success: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { chatMessageId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;
        const chatMessage = await adapter.findOne<ChatMessage>({
          model: 'chat_message',
          where: [{ field: 'id', value: chatMessageId, connector: 'AND' }]
        });

        if (!chatMessage || chatMessage.deletedAt !== null) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        if (chatMessage.senderId !== userId) {
          throw new APIError('FORBIDDEN', { message: ERROR_MESSAGES.FORBIDDEN });
        }

        await adapter.update({
          model: 'chat_message',
          where: [{ field: 'id', value: chatMessageId }],
          update: {
            deletedAt: new Date(),
          }
        });

        // Call hook
        if (hooks.onChatMessageDelete) {
          await hooks.onChatMessageDelete(chatMessage);
        }

        return ctx.json({ success: true });
      }),



      createGroupChat: createAuthEndpoint('/social/group-chat/create', {
        method: "POST",
        body: z.object({
          name: z.string(),
          description: z.string().optional(),
          memberIds: z.array(z.string()),
        }),
        response: z.object({
          groupChat: GroupChat,
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { name, description, memberIds } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        if (!name) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.BAD_REQUEST });
        }

        if (memberIds.length === 0) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.BAD_REQUEST });
        }

        const adapter = ctx.context.adapter;

        if (!allowMultipleGroupChatWithSamePerson) {

          // Check if user is already in a group chat with the same members
          const groupChatOfUser = await adapter.findMany<GroupChatMember>({
            model: 'group_chat_member',
            where: [{ field: 'userId', value: userId, connector: 'AND' }]
          });

          const existingGroupChat = await adapter.findMany<GroupChatMember>({
            model: 'group_chat_member',
            where: [{ field: 'groupChatId', value: groupChatOfUser.map(gcm => gcm.groupChatId), operator: 'in' }]
          });

          const existingGroupChats = groupBy(existingGroupChat, (gc) => gc.groupChatId);
          const membersIdsSet = new Set([...memberIds, userId]);

          for (const groupChatMembers of Object.values(existingGroupChats)) {
            const groupChatMembersIdsSet = new Set(groupChatMembers.map(gcm => gcm.userId));

            if (setsAreEqual(groupChatMembersIdsSet, membersIdsSet)) {
              throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.MULTIPLE_GROUP_CHAT_WITH_SAME_PERSON });
            }
          }
        }

        const groupChat = await adapter.transaction(async (tx) => {

          const groupChat = await tx.create<GroupChat>({
            model: 'group_chat',
            data: {
              name: name,
              description: description || null,
              createdById: userId,
            }
          });

          await tx.create<GroupChatMember>({
            model: 'group_chat_member',
            data: {
              groupChatId: groupChat.id,
              userId: userId,
              role: 'admin',
              joinedAt: new Date(),
            }
          });

          await Promise.all(memberIds.map(async (memberId) => {

            if (memberId === userId) {
              return;
            }

            await tx.create<GroupChatMember>({
              model: 'group_chat_member',
              data: {
                groupChatId: groupChat.id,
                userId: memberId,
                role: 'member',
                joinedAt: new Date(),
              }
            }).catch(() => {
              throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.BAD_REQUEST });
            });
          }));

          return groupChat;
        }).catch(() => {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.BAD_REQUEST });
        });

        if (hooks.onGroupChatJoin) {
          await Promise.all(memberIds.map(async () => {
            await hooks.onGroupChatJoin?.(groupChat);
          }));
        }

        // Call hook for group creation
        if (hooks.onGroupChatCreate) {
          await hooks.onGroupChatCreate(groupChat);
        }

        return ctx.json({ groupChat });
      }),
      getGroupChats: createAuthEndpoint('/social/group-chat/list', {
        method: "GET",
        query: z.object({
          page: z.number().optional().default(1),
          limit: z.number().optional().default(10),
        }).optional().default({ page: 1, limit: 10 }),
        response: z.object({
          groupChats: z.array(GroupChat),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { page, limit } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        const memberships = await adapter.findMany<GroupChatMember>({
          model: 'group_chat_member',
          where: [{ field: 'userId', value: userId }]
        });

        const groupChatIds = memberships.map(m => m.groupChatId);

        const groupChats = await adapter.findMany<GroupChat>({
          model: 'group_chat',
          where: [{ field: 'id', value: groupChatIds, operator: 'in' }],
          limit: limit,
          offset: (page - 1) * (limit),
        });

        return ctx.json({ groupChats });
      }),
      leaveGroupChat: createAuthEndpoint('/social/group-chat/leave', {
        method: "POST",
        body: z.object({
          groupChatId: z.string(),
        }),
        response: z.object({
          success: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { groupChatId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        if (groupChatId === undefined) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.BAD_REQUEST });
        }

        const adapter = ctx.context.adapter;

        const membership = await adapter.findOne<GroupChatMember>({
          model: 'group_chat_member',
          where: [
            { field: 'groupChatId', value: groupChatId },
            { field: 'userId', value: userId }
          ]
        });

        if (!membership) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        await adapter.delete({
          model: 'group_chat_member',
          where: [
            { field: 'groupChatId', value: groupChatId },
            { field: 'userId', value: userId }
          ]
        });

        // Call hook
        if (hooks.onGroupChatLeave) {
          await hooks.onGroupChatLeave();
        }

        return ctx.json({ success: true });
      }),


      getGroupChatMembers: createAuthEndpoint('/social/group-chat/members', {
        method: "GET",
        query: z.object({
          groupChatId: z.string(),
        }),
        response: z.object({
          members: z.array(GroupChatMember),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { groupChatId } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;
        
        const isMember = await adapter.findOne<GroupChatMember>({
          model: 'group_chat_member',
          where: [
            { field: 'groupChatId', value: groupChatId },
            { field: 'userId', value: userId }
          ]
        });

        if (!isMember) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        const members = await adapter.findMany<GroupChatMember>({
          model: 'group_chat_member',
          where: [{ field: 'groupChatId', value: groupChatId }]
        });

        return ctx.json({ members });
      }),
      addMemberToGroupChat: createAuthEndpoint('/social/group-chat/add-member', {
        method: "POST",
        body: z.object({
          groupChatId: z.string(),
          userId: z.string(),
        }),
        response: z.object({
          success: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { groupChatId, userId: newMemberId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        const groupChat = await adapter.findOne<GroupChat>({
          model: 'group_chat',
          where: [{ field: 'id', value: groupChatId }]
        });

        if (!groupChat) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }
        // Check if user is admin or member
        const membership = await adapter.findOne<GroupChatMember>({
          model: 'group_chat_member',
          where: [
            { field: 'groupChatId', value: groupChatId },
            { field: 'userId', value: userId }
          ]
        });

        if (!membership) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        if (membership.role !== 'admin') {
          throw new APIError('FORBIDDEN', { message: ERROR_MESSAGES.FORBIDDEN });
        }

        // Check if new member is already in the group
        const existingMember = await adapter.findOne<GroupChatMember>({
          model: 'group_chat_member',
          where: [
            { field: 'groupChatId', value: groupChatId },
            { field: 'userId', value: newMemberId }
          ]
        });

        if (existingMember) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.ALREADY_MEMBER });
        }

        await adapter.create<GroupChatMember>({
          model: 'group_chat_member',
          data: {
            groupChatId: groupChatId,
            userId: newMemberId,
            role: 'member',
            joinedAt: new Date(),
          }
        });

        // Call hook
        if (hooks.onGroupChatJoin) {
          await hooks.onGroupChatJoin(groupChat);
        }

        return ctx.json({ success: true });
      }),
      removeMemberFromGroupChat: createAuthEndpoint('/social/group-chat/remove-member', {
        method: "POST",
        body: z.object({
          groupChatId: z.string(),
          userId: z.string(),
        }),
        response: z.object({
          success: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { groupChatId, userId: memberIdToRemove } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        // Check if user is admin
        const membership = await adapter.findOne<GroupChatMember>({
          model: 'group_chat_member',
          where: [
            { field: 'groupChatId', value: groupChatId },
            { field: 'userId', value: userId }
          ]
        });

        if (!membership) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        if (membership.role !== 'admin') {
          throw new APIError('FORBIDDEN', { message: ERROR_MESSAGES.FORBIDDEN });
        }

        // Don't allow removing the creator
        const groupChat = await adapter.findOne<GroupChat>({
          model: 'group_chat',
          where: [{ field: 'id', value: groupChatId }]
        });

        if (!groupChat) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        if (groupChat.createdById === memberIdToRemove) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.BAD_REQUEST });
        }
        
        await adapter.delete({
          model: 'group_chat_member',
          where: [
            { field: 'groupChatId', value: groupChatId, connector: 'AND' },
            { field: 'id', value: memberIdToRemove, connector: 'AND' }
          ]
        });

        // Call hook
        if (hooks.onGroupChatLeave) {
          await hooks.onGroupChatLeave();
        }

        return ctx.json({ success: true });
      }),



      getGroupChatMessages: createAuthEndpoint('/social/group-chat/messages', {
        method: "GET",
        query: z.object({
          groupChatId: z.string(),
          page: z.number().default(1),
          limit: z.number().default(10),
        }),
        response: z.object({
          messages: z.array(GroupChatMessage),
        }),
      }, async (ctx) => {
        const { groupChatId, page, limit } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        // Verify user is a member of the group
        const membership = await adapter.findOne<GroupChatMember>({
          model: 'group_chat_member',
          where: [
            { field: 'groupChatId', value: groupChatId },
            { field: 'userId', value: userId }
          ]
        });

        if (!membership) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        const messages = await adapter.findMany<GroupChatMessage>({
          model: 'group_chat_message',
          where: [{ field: 'groupChatId', value: groupChatId }],
          limit: limit,
          offset: (page - 1) * (limit),
        });

        return ctx.json({ messages });
      }),
      sendGroupChatMessage: createAuthEndpoint('/social/group-chat/send-message', {
        method: "POST",
        body: z.object({
          groupChatId: z.string(),
          content: z.string(),
        }),
        response: z.object({
          message: GroupChatMessage,
        }),
      }, async (ctx) => {
        const { groupChatId, content } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        // Verify user is a member of the group
        const membership = await adapter.findOne<GroupChatMember>({
          model: 'group_chat_member',
          where: [
            { field: 'groupChatId', value: groupChatId },
            { field: 'userId', value: userId }
          ]
        });

        if (!membership) {
          throw new APIError('NOT_FOUND', { message: ERROR_MESSAGES.NOT_FOUND });
        }

        const message = await adapter.create<GroupChatMessage>({
          model: 'group_chat_message',
          data: {
            content: content,
            senderId: userId,
            groupChatId: groupChatId,
          }
        });

        // Call hook
        if (hooks.onGroupChatMessageSend) {
          await hooks.onGroupChatMessageSend(message);
        }

        return ctx.json({ message });
      }),
    },
  } satisfies BetterAuthPlugin;
};
