import { mergeSchema, User } from 'better-auth/db';
import { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { z } from 'zod';

import { getSchema } from './schema.js';
import { ERROR_MESSAGES } from './error.js';
import type { SocialNetworkOptions } from './options.js';
import { FriendRequest, Friend, Chat, GroupChat, GroupChatMember, ChatMessage, GroupChatMessage } from './types.js';

export const socialNetwork = (options?: SocialNetworkOptions) => {
  const allowSelfFriendRequest = options?.allowSelfFriendRequest || false;
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
        response: z.object({
          success: z.boolean(),
        }),
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
        response: z.object({
          success: z.boolean(),
        }),
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
              updatedAt: new Date(),
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
      listFriendRequestsSent: createAuthEndpoint('/social/friend-request/sent/list', {
        method: "GET",
        query: z.object({
          page: z.number().optional().default(1),
          limit: z.number().optional().default(10),
          status: z.enum(['pending', 'accepted', 'rejected']).optional().default('pending'),
        }).optional().default({ page: 1, limit: 10, status: 'pending' }),
        response: z.object({
          sent: z.array(FriendRequest),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { page, limit, status } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        const sentRequests = await adapter.findMany<FriendRequest>({
          model: 'friend_request',
          where: [{ field: 'senderId', value: userId }, { field: 'status', value: status }],
          limit: limit,
          offset: (page - 1) * (limit),
        });

        return ctx.json({ sent: sentRequests });
      }),
      listFriendRequestsReceived: createAuthEndpoint('/social/friend-request/received/list', {
        method: "GET",
        query: z.object({
          page: z.number().optional().default(1),
          limit: z.number().optional().default(10),
          status: z.enum(['pending', 'accepted', 'rejected']).optional().default('pending'),
        }).optional().default({ page: 1, limit: 10, status: 'pending' }),
        response: z.object({
          received: z.array(FriendRequest),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { page, limit, status } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

        const receivedRequests = await adapter.findMany<FriendRequest>({
          model: 'friend_request',
          where: [{ field: 'receiverId', value: userId }, { field: 'status', value: status }],
          limit: limit,
          offset: (page - 1) * (limit),
        });

        return ctx.json({ received: receivedRequests });
      }),



      listFriends: createAuthEndpoint('/social/friends/list', {
        method: "GET",
        query: z.object({
          page: z.number().default(1),
          limit: z.number().default(10),
        }),
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

        const adapter = ctx.context.adapter;

        await adapter.transaction(async (tx) => {

          // Remove both directions
          await tx.delete({
            model: 'friend',
            where: [
              { field: 'userId', value: userId },
              { field: 'friendId', value: friendId }
            ]
          });

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

        const isFriend = await adapter.findOne<Friend>({
          model: 'friend',
          where: [
            { field: 'userId', value: userId },
            { field: 'friendId', value: friendId }
          ]
        });

        return ctx.json({ isFriend: !!isFriend });
      }),



      createChat: createAuthEndpoint('/social/chat/create', {
        method: "POST",
        body: z.object({
          friendId: z.string(),
        }),
        response: z.object({
          chat: Chat,
        }),
      }, async (ctx) => {
        const { friendId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const adapter = ctx.context.adapter;

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
            { field: 'user1Id', value: userId },
            { field: 'user2Id', value: friendId }
          ]
        }) || await adapter.findOne<Chat>({
          model: 'chat',
          where: [
            { field: 'user1Id', value: friendId },
            { field: 'user2Id', value: userId }
          ]
        });

        if (existingChat) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.ALREADY_EXISTS });
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
      listChats: createAuthEndpoint('/social/chat/list', {
        method: "GET",
        query: z.object({
          page: z.number().default(1),
          limit: z.number().default(10),
        }),
        response: z.object({
          chats: z.array(Chat),
        }),
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



      getChatMessages: createAuthEndpoint('/social/chat/messages', {
        method: "GET",
        query: z.object({
          chatId: z.string(),
          page: z.number().default(1),
          limit: z.number().default(10),
        }),
        response: z.object({
          messages: z.array(ChatMessage),
        }),
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
          where: [{ field: 'chatId', value: chatId }],
          limit: limit,
          offset: (page - 1) * (limit),
        });

        return ctx.json({ messages });
      }),
      sendChatMessage: createAuthEndpoint('/social/chat/send-message', {
        method: "POST",
        body: z.object({
          chatId: z.string(),
          content: z.string(),
        }),
        response: z.object({
          message: ChatMessage,
        }),
      }, async (ctx) => {
        const { chatId, content } = ctx.body;
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

        const message = await adapter.create<ChatMessage>({
          model: 'chat_message',
          data: {
            content: content,
            senderId: userId,
            chatId: chatId,
          }
        });

        // Update chat updatedAt
        await adapter.update<Chat>({
          model: 'chat',
          where: [{ field: 'id', value: chatId }],
          update: {
            updatedAt: new Date(),
          }
        });

        // Call hook
        if (hooks.onChatMessageSend) {
          await hooks.onChatMessageSend(message);
        }

        return ctx.json({ message });
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
      }, async (ctx) => {
        const { name, description, memberIds } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: ERROR_MESSAGES.UNAUTHORIZED });
        }

        const maxSize = await getMaxGroupSize();

        if (maxSize !== undefined && memberIds.length + 1 > maxSize) {
          throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.TOO_LARGE.replace('{maxSize}', maxSize.toString()) });
        }

        const adapter = ctx.context.adapter;

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
            });
          }));

          return groupChat;

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
      listGroupChats: createAuthEndpoint('/social/group-chat/list', {
        method: "GET",
        query: z.object({
          page: z.number().default(1),
          limit: z.number().default(10),
        }),
        response: z.object({
          groupChats: z.array(GroupChat),
        }),
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



      addGroupChatMember: createAuthEndpoint('/social/group-chat/add-member', {
        method: "POST",
        body: z.object({
          groupChatId: z.string(),
          userId: z.string(),
        }),
        response: z.object({
          success: z.boolean(),
        }),
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

        // Check max group size
        const maxSize = await getMaxGroupSize();
        if (maxSize !== undefined) {
          const currentMembers = await adapter.findMany<GroupChatMember>({
            model: 'group_chat_member',
            where: [{ field: 'groupChatId', value: groupChatId }]
          });

          if (currentMembers.length + 1 > maxSize) {
            throw new APIError('BAD_REQUEST', { message: ERROR_MESSAGES.MAX_SIZE_REACHED.replace('{maxSize}', maxSize.toString()) });
          }
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
      removeGroupChatMember: createAuthEndpoint('/social/group-chat/remove-member', {
        method: "POST",
        body: z.object({
          groupChatId: z.string(),
          userId: z.string(),
        }),
        response: z.object({
          success: z.boolean(),
        }),
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

        if (!membership || membership.role !== 'admin') {
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
            { field: 'groupChatId', value: groupChatId },
            { field: 'userId', value: memberIdToRemove }
          ]
        });

        // Call hook
        if (hooks.onGroupChatLeave) {
          await hooks.onGroupChatLeave(groupChat);
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
