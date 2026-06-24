import { mergeSchema, User } from 'better-auth/db';
import { BetterAuthPlugin, Where } from 'better-auth';
import { createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { APIError } from "@better-auth/core/error";
import { z } from 'zod';

import { getSchema } from './schema.js';
import { SOCIAL_NETWORK_ERROR_CODES } from './error.js';
import { SocialNetworkOptions } from './options.js';
import { FriendRequest, Friend, Chat, GroupChat, GroupChatMember, ChatMessage, GroupChatMessage, BlockedUser, Post, PostLike, PostBookmark } from './types.js';
import { SocialNetworkAdapter } from './adapter.js';

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

export const socialNetwork = (options?: SocialNetworkOptions) => {

  const OPTIONS = SocialNetworkOptions.parse(options);
  const hooks = options?.hooks || {};

  const getDeletedMessagePlaceholder = async (message: GroupChatMessage) => {
    if (typeof options?.deletedMessagePlaceholder === 'string') {
      return options?.deletedMessagePlaceholder;
    }
    if (options?.deletedMessagePlaceholder instanceof Function) {
      return await options?.deletedMessagePlaceholder(message);
    }
    return 'Message has been deleted';
  };

  return {
    id: 'social-network',
    schema: mergeSchema(getSchema()),
    $ERROR_CODES: SOCIAL_NETWORK_ERROR_CODES,
    endpoints: {
      sendFriendRequest: createAuthEndpoint('/social/friend-request/send', {
        method: "POST",
        body: z.object({
          receiverId: z.string()
        }),
        response: z.object({
          friendRequest: FriendRequest,
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {

        const { receiverId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }
        
        if (!receiverId || receiverId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_RECEIVER_ID_REQUIRED);
        }

        if (!OPTIONS.allowSelfFriendRequest && userId === receiverId) {
          throw APIError.from('FORBIDDEN', SOCIAL_NETWORK_ERROR_CODES.SELF_REQUEST_NOT_ALLOWED);
        }

        const { adapter, internalAdapter } = ctx.context;
        const socialNetworkAdapter = new SocialNetworkAdapter(adapter);

        const foreignUser = await internalAdapter.findUserById(receiverId);
        if (!foreignUser) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.NOT_FOUND);
        }

        const isFriend = await socialNetworkAdapter.isFriend(userId, foreignUser.id);
        if (isFriend) {
          throw APIError.from('FORBIDDEN', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_ALREADY_FRIENDS);
        }

        const existingRequest = await socialNetworkAdapter.isFriendRequestExists(userId, foreignUser.id, 'pending');
        if (existingRequest) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_ALREADY_SENT);
        }

        const friendRequest = await socialNetworkAdapter.sendFriendRequest(userId, foreignUser.id);

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!requestId || requestId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_ID_REQUIRED);
        }

        const adapter = ctx.context.adapter;
        const socialNetworkAdapter = new SocialNetworkAdapter(adapter);

        const friendRequest = await socialNetworkAdapter.getFriendRequestById(requestId);

        if (!friendRequest) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_NOT_FOUND);
        }

        if (friendRequest.receiverId !== userId) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_NOT_FOUND);
        }

        if (friendRequest.status !== 'pending') {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_NOT_PENDING);
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
            throw APIError.from('INTERNAL_SERVER_ERROR', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_FAILED_TO_UPDATE);
          }

          // Create friend relationship (both directions)
          await tx.create<Friend>({
            model: 'friend',
            data: {
              userId: friendRequest.senderId,
              friendId: friendRequest.receiverId,
            }
          });

          if (OPTIONS.allowSelfFriendRequest && friendRequest.senderId === friendRequest.receiverId) {
            return updatedRequest;
          }

          if (OPTIONS.automaticBackFriend) {
            await tx.create<Friend>({
              model: 'friend',
              data: {
                userId: friendRequest.receiverId,
                friendId: friendRequest.senderId,
              }
            });
          }

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!requestId || requestId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_ID_REQUIRED);
        }

        const adapter = ctx.context.adapter;
        const socialNetworkAdapter = new SocialNetworkAdapter(adapter);

        const friendRequest = await socialNetworkAdapter.getFriendRequestById(requestId);

        if (!friendRequest) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_NOT_FOUND);
        }

        if (friendRequest.receiverId !== userId) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_NOT_FOUND);
        }

        if (friendRequest.status !== 'pending') {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_NOT_PENDING);
        }
        
        const updatedRequest = await socialNetworkAdapter.updateFriendRequestStatus(requestId, 'rejected');

        if (!updatedRequest) {
          throw APIError.from('INTERNAL_SERVER_ERROR', SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_FAILED_TO_UPDATE);
        }

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);
        const sentRequests = await socialNetworkAdapter.getFriendRequestsSent(userId, limit, page, status);

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const receivedRequests = await socialNetworkAdapter.getFriendRequestsReceived(userId, limit, page, status);

        return ctx.json({ received: receivedRequests });
      }),
      rejectAllFriendRequests: createAuthEndpoint('/social/friend-request/reject-all', {
        method: "POST",
        response: z.object({
          success: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        const adapter = ctx.context.adapter;
        const socialNetworkAdapter = new SocialNetworkAdapter(adapter);

        await socialNetworkAdapter.rejectAllFriendRequests(userId);

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);
        const friends = await socialNetworkAdapter.getFriends(userId, limit, page);

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!friendId || friendId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.FRIEND_ID_REQUIRED);
        }

        const { adapter, internalAdapter } = ctx.context;

        const foreignUser = await internalAdapter.findUserById(friendId);
        if (!foreignUser) {
          throw APIError.from('FORBIDDEN', SOCIAL_NETWORK_ERROR_CODES.NOT_A_FRIEND);
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
            throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.NOT_A_FRIEND);
          }

          // Remove both directions
          await tx.delete({
            model: 'friend',
            where: [
              { field: 'userId', value: userId },
              { field: 'friendId', value: friendId }
            ]
          });

          if (OPTIONS.allowSelfFriendRequest && userId === friendId) {
            return;
          }

          if (OPTIONS.automaticBackFriend) {
            await tx.delete({
              model: 'friend',
              where: [
                { field: 'userId', value: friendId },
                { field: 'friendId', value: userId }
              ]
            });
          }

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!friendId || friendId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.FRIEND_ID_REQUIRED);
        }

        const adapter = ctx.context.adapter;
        const socialNetworkAdapter = new SocialNetworkAdapter(adapter);

        const isFriend = await socialNetworkAdapter.isFriend(userId, friendId);

        return ctx.json({ isFriend });
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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!friendId || friendId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.FRIEND_ID_REQUIRED);
        }

        const adapter = ctx.context.adapter;
        const socialNetworkAdapter = new SocialNetworkAdapter(adapter);

        const isFriend = await socialNetworkAdapter.isFriend(userId, friendId);
        if (!isFriend) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.NOT_A_FRIEND);
        }

        const existingChat = await socialNetworkAdapter.getChatByUsersId(userId, friendId);
        if (existingChat) {
          return ctx.json({ chat: existingChat });
        }

        const chat = await socialNetworkAdapter.createChat(userId, friendId);

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const chats = await socialNetworkAdapter.getChats(userId, limit, page);

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const chat = await socialNetworkAdapter.getChatById(chatId);
        if (!chat) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.PRIVATE_CHAT_NOT_FOUND);
        }
        if (chat.user1Id !== userId && chat.user2Id !== userId) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.PRIVATE_CHAT_NOT_FOUND);
        }

        const messages = await socialNetworkAdapter.getChatMessages(chatId, limit, page);

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!chatId || chatId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.CHAT_MESSAGE_CHAT_ID_REQUIRED);
        }

        if (!content) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.CHAT_MESSAGE_CONTENT_REQUIRED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        // Verify user is part of the chat
        const chat = await socialNetworkAdapter.getChatById(chatId);

        if (!chat) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.PRIVATE_CHAT_NOT_FOUND);
        }

        if (chat.user1Id !== userId && chat.user2Id !== userId) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.PRIVATE_CHAT_NOT_FOUND);
        }

        const message = await socialNetworkAdapter.createChatMessage(chatId, userId, content);

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!chatMessageId || chatMessageId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.CHAT_MESSAGE_ID_REQUIRED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const chatMessage = await socialNetworkAdapter.getChatMessageById(chatMessageId);

        if (!chatMessage) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.CHAT_MESSAGE_NOT_FOUND);
        }

        if (chatMessage.senderId !== userId) {
          throw APIError.from('FORBIDDEN', SOCIAL_NETWORK_ERROR_CODES.FORBIDDEN);
        }

        if (chatMessage.deletedAt !== null) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.CHAT_MESSAGE_ALREADY_DELETED);
        }

        const updatedChatMessage = await socialNetworkAdapter.deleteChatMessage(chatMessageId);

        if (!updatedChatMessage) {
          throw APIError.from('INTERNAL_SERVER_ERROR', SOCIAL_NETWORK_ERROR_CODES.CHAT_MESSAGE_FAILED_TO_UPDATE);
        }

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!name) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NAME_REQUIRED);
        }

        if (memberIds.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MEMBER_IDS_REQUIRED);
        }

        if (memberIds.length +1 > OPTIONS.maxGroupSize) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.MAX_GROUP_SIZE);
        }

        const adapter = ctx.context.adapter;

        if (!OPTIONS.allowMultipleGroupChatWithSamePerson) {

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
              throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.MULTIPLE_GROUP_CHAT_WITH_SAME_PERSON);
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

            if (!OPTIONS.allowAddingUnknownMembersToGroupChat) {
              const friend = await tx.findOne<Friend>({
                model: 'friend',
                where: [{ field: 'userId', value: userId }, { field: 'friendId', value: memberId }]
              });
              if (!friend) {
                throw APIError.from('FORBIDDEN', SOCIAL_NETWORK_ERROR_CODES.ADDING_UNKNOWN_MEMBERS_TO_GROUP_CHAT);
              }
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
              throw APIError.from('INTERNAL_SERVER_ERROR', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_FAILED_TO_ADD_MEMBER);
            });
          }));

          return groupChat;
        });

        if (hooks.onGroupChatJoin) {
          await Promise.all(memberIds.map(async (memberId) => {
            await hooks.onGroupChatJoin?.({ userId: memberId, groupChatId: groupChat.id });
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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);
        const groupChats = await socialNetworkAdapter.getGroupChats(userId, limit, page);
        
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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!groupChatId || groupChatId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_ID_REQUIRED);
        }

        const adapter = ctx.context.adapter;
        const socialNetworkAdapter = new SocialNetworkAdapter(adapter);

        const membership = await socialNetworkAdapter.isInGroupChat(userId, groupChatId);
        if (!membership) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND);
        }

        await socialNetworkAdapter.leaveGroupChat(userId, groupChatId);

        // Call hook
        if (hooks.onGroupChatLeave) {
          await hooks.onGroupChatLeave();
        }

        return ctx.json({ success: true });
      }),
      updateGroupChat: createAuthEndpoint('/social/group-chat/update', {
        method: "POST",
        body: z.object({
          id: GroupChat.shape.id,
          name: GroupChat.shape.name.optional(),
          description: GroupChat.shape.description.optional(),
        }),
        response: z.object({
          groupChat: GroupChat,
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { id, name, description } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!id || id.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_ID_REQUIRED);
        }

        const adapter = ctx.context.adapter;
        const socialNetworkAdapter = new SocialNetworkAdapter(adapter);

        const membership = await socialNetworkAdapter.isInGroupChat(userId, id);
        if (!membership) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND);
        }
        if (membership.role !== 'admin') {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_ADMIN);
        }

        const groupChat = await socialNetworkAdapter.getGroupChatById(id);
        if (!groupChat) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND);
        }

        const updatedGroupChat = await socialNetworkAdapter.updateGroupChat(id, { name, description });
        if (!updatedGroupChat) {
          throw APIError.from('INTERNAL_SERVER_ERROR', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_FAILED_TO_UPDATE);
        }

        return ctx.json({ updatedGroupChat });
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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!groupChatId || groupChatId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_ID_REQUIRED);
        }

        const adapter = ctx.context.adapter;
        const socialNetworkAdapter = new SocialNetworkAdapter(adapter);

        const isMember = await socialNetworkAdapter.isInGroupChat(userId, groupChatId);
        if (!isMember) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND);
        }

        const members = await socialNetworkAdapter.getGroupChatMembers(groupChatId);

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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!groupChatId || groupChatId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_ID_REQUIRED);
        }

        if (!newMemberId || newMemberId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MEMBER_ID_REQUIRED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);
        
        const membership = await socialNetworkAdapter.isInGroupChat(userId, groupChatId);
        if (!membership) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND);
        }
        if (membership.role !== 'admin') {
          throw APIError.from('FORBIDDEN', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_ADMIN);
        }

        if (!OPTIONS.allowAddingUnknownMembersToGroupChat) {
          const friend = await socialNetworkAdapter.isFriend(userId, newMemberId);
          if (!friend) {
            throw APIError.from('FORBIDDEN', SOCIAL_NETWORK_ERROR_CODES.ADDING_UNKNOWN_MEMBERS_TO_GROUP_CHAT);
          }
        }

        const groupChatMembers = await socialNetworkAdapter.getGroupChatMembers(groupChatId);
        if (groupChatMembers.length + 1 > OPTIONS.maxGroupSize) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.MAX_GROUP_SIZE);
        }

        // Check if new member is already in the group
        const existingMember = await socialNetworkAdapter.isInGroupChat(newMemberId, groupChatId);
        if (existingMember) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_ALREADY_MEMBER);
        }

        await socialNetworkAdapter.addMemberToGroupChat(groupChatId, newMemberId);

        // Call hook
        if (hooks.onGroupChatJoin) {
          await hooks.onGroupChatJoin({ userId, groupChatId });
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
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!groupChatId || groupChatId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_ID_REQUIRED);
        }

        if (!memberIdToRemove || memberIdToRemove.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MEMBER_ID_REQUIRED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        // Check if user is admin
        const membership = await socialNetworkAdapter.isInGroupChat(userId, groupChatId);
        if (!membership) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND);
        }
        if (membership.role !== 'admin') {
          throw APIError.from('FORBIDDEN', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_ADMIN);
        }

        // Don't allow removing the creator
        const groupChat = await socialNetworkAdapter.getGroupChatById(groupChatId);
        if (!groupChat) {
          throw APIError.from('FORBIDDEN', SOCIAL_NETWORK_ERROR_CODES.FORBIDDEN);
        }
        if (groupChat.createdById === memberIdToRemove) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_CREATOR_NOT_ALLOWED_TO_REMOVE);
        }

        await socialNetworkAdapter.removeMemberFromGroupChat(groupChatId, memberIdToRemove);

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
          page: z.number().optional().default(1),
          limit: z.number().optional().default(10),
        }),
        response: z.object({
          messages: z.array(GroupChatMessage),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { groupChatId, page, limit } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!groupChatId || groupChatId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_ID_REQUIRED);
        }

        const adapter = ctx.context.adapter;
        const socialNetworkAdapter = new SocialNetworkAdapter(adapter);

        // Verify user is a member of the group
        const membership = await socialNetworkAdapter.isInGroupChat(userId, groupChatId);
        if (!membership) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND);
        }


        const messages = await (
          OPTIONS.messageDeletionRule === 'SENDER_ONLY_VISIBLE' ?
          socialNetworkAdapter.getGroupChatMessagesFromUser(groupChatId, userId, limit, page) :
          socialNetworkAdapter.getGroupChatMessages(groupChatId, limit, page)
        );

        const messagesWithPlaceholder = await Promise.all(messages.map(async message => {
          if (message.deletedAt !== null) {
            if (OPTIONS.messageDeletionRule === 'SENDER_ONLY_VISIBLE') {
              return {
                ...message,
                content: await getDeletedMessagePlaceholder(message),
              };
            }
            if (OPTIONS.messageDeletionRule === 'VISIBLE' ) {
              return {
                ...message,
                content: await getDeletedMessagePlaceholder(message),
              };
            }
          }
          return message;
        }));

        return ctx.json({ messages: messagesWithPlaceholder });
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
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { groupChatId, content } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!content || content.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MESSAGE_CONTENT_REQUIRED);
        }

        if (!groupChatId || groupChatId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_ID_REQUIRED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        // Verify user is a member of the group
        const membership = await socialNetworkAdapter.isInGroupChat(userId, groupChatId);
        if (!membership) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND);
        }

        const message = await socialNetworkAdapter.createGroupChatMessage(groupChatId, userId, content);

        // Call hook
        if (hooks.onGroupChatMessageSend) {
          await hooks.onGroupChatMessageSend(message);
        }

        return ctx.json({ message });
      }),
      deleteGroupChatMessage: createAuthEndpoint('/social/group-chat/delete-message', {
        method: "POST",
        body: z.object({
          groupChatId: z.string(),
          messageId: z.string(),
        }),
        response: z.object({
          success: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {

        if (OPTIONS.messageDeletionRule === 'CANT_DELETE') {
          throw APIError.from('FORBIDDEN', SOCIAL_NETWORK_ERROR_CODES.MESSAGE_DELETION_RULE_CANT_DELETE);
        }

        const { groupChatId, messageId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!groupChatId || groupChatId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_ID_REQUIRED);
        }

        if (!messageId || messageId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MESSAGE_ID_REQUIRED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const membership = await socialNetworkAdapter.isInGroupChat(userId, groupChatId);
        if (!membership) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_NOT_FOUND);
        }

        const message = await socialNetworkAdapter.getGroupChatMessageById(messageId);
        if (!message) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MESSAGE_NOT_FOUND);
        }
        if (message.senderId !== userId) {
          throw APIError.from('FORBIDDEN', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MESSAGE_NOT_AUTHOR);
        }
        if (message.deletedAt !== null) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_MESSAGE_ALREADY_DELETED);
        }

        const updatedMessage = await socialNetworkAdapter.deleteGroupChatMessage(messageId);
        if (!updatedMessage) {
          throw APIError.from('INTERNAL_SERVER_ERROR', SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_FAILED_TO_DELETE_MESSAGE);
        }

        // Call hook
        if (hooks.onGroupChatMessageDelete) {
          await hooks.onGroupChatMessageDelete(updatedMessage);
        }

        return ctx.json({ success: true });
      }),



      getBlockedUsers: createAuthEndpoint('/social/blocked-users/list', {
        method: "GET",
        response: z.object({
          blockedUsers: z.array(BlockedUser),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const blockedUsers = await socialNetworkAdapter.getBlockedUsers(userId);

        return ctx.json({ blockedUsers });
      }),
      blockUser: createAuthEndpoint('/social/blocked-users/block', {
        method: "POST",
        body: z.object({
          userId: z.string(),
        }),
        response: z.object({
          success: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { userId: blockedUserId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!blockedUserId || blockedUserId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_BLOCKED_USER_ID_REQUIRED);
        }

        if (userId === blockedUserId) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_SELF_BLOCK_NOT_ALLOWED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const isBlocked = await socialNetworkAdapter.isBlocked(userId, blockedUserId);
        if (isBlocked) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_ALREADY_BLOCKED);
        }

        const blockedUser = await socialNetworkAdapter.blockUser(userId, blockedUserId);

        return ctx.json({ blockedUser });
      }),
      unblockUser: createAuthEndpoint('/social/blocked-users/unblock', {
        method: "POST",
        body: z.object({
          userId: z.string(),
        }),
        response: z.object({
          success: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { userId: blockedUserId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!blockedUserId || blockedUserId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_BLOCKED_USER_ID_REQUIRED);
        }

        if (userId === blockedUserId) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_SELF_BLOCK_NOT_ALLOWED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const isBlocked = await socialNetworkAdapter.isBlocked(userId, blockedUserId);

        if (!isBlocked) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_NOT_FOUND);
        }

        await socialNetworkAdapter.unblockUser(userId, blockedUserId);

        return ctx.json({ success: true });
      }),
      isBlocked: createAuthEndpoint('/social/blocked-users/is-blocked', {
        method: "GET",
        query: z.object({
          userId: z.string(),
        }),
        response: z.object({
          isBlocked: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { userId: blockedUserId } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!blockedUserId || blockedUserId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_BLOCKED_USER_ID_REQUIRED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const isBlocked = await socialNetworkAdapter.isBlocked(userId, blockedUserId);

        return ctx.json({ isBlocked });
      }),



      getPostsFromUser: createAuthEndpoint('/social/posts/from-user', {
        method: "GET",
        query: z.object({
          page: z.number().optional().default(1),
          limit: z.number().optional().default(10),
          userId: z.string(),
        }),
        response: z.object({
          posts: z.array(Post),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { userId: targetUserId, page, limit } = ctx.query;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!targetUserId || targetUserId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.POST_TARGET_USER_ID_REQUIRED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const posts = await socialNetworkAdapter.getPosts(targetUserId, limit, page);

        return ctx.json({ posts });
      }),
      createPost: createAuthEndpoint('/social/posts/create', {
        method: "POST",
        body: z.object({
          content: z.string(),
        }),
        response: z.object({
          post: Post,
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { content } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!content || content.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.POST_CONTENT_REQUIRED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const post = await socialNetworkAdapter.createPost(userId, content);

        return ctx.json({ post });
        
      }),
      deletePost: createAuthEndpoint('/social/posts/delete', {
        method: "POST",
        body: z.object({
          postId: z.string(),
        }),
        response: z.object({
          success: z.boolean(),
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { postId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }
        
        if (!postId || postId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.POST_ID_REQUIRED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const post = await socialNetworkAdapter.getPostById(postId);
        if (!post) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.POST_NOT_FOUND);
        }
        if (post.posterId !== userId) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.POST_NOT_FOUND);
        }

        await socialNetworkAdapter.deletePost(postId);

        return ctx.json({ success: true });
        
      }),
      likePost: createAuthEndpoint('/social/posts/like', {
        method: "POST",
        body: z.object({
          postId: z.string(),
        }),
        response: z.object({
          post: Post,
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { postId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!postId || postId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.POST_ID_REQUIRED);
        }

        const adapter = ctx.context.adapter;
        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const post = await socialNetworkAdapter.getPostById(postId);
        if (!post) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.POST_NOT_FOUND);
        }
        
        const existingLike = await socialNetworkAdapter.isPostLiked(postId, userId);
        if (existingLike) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.POST_ALREADY_LIKED);
        }

        const updatedPost = await adapter.transaction(async (tx) => {
          await tx.create<PostLike>({
            model: 'post_like',
            data: {
              postId: postId,
              userId: userId,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          const likesCount = await tx.count({
            model: 'post_like',
            where: [{ field: 'postId', value: postId }],
          });

          return await tx.update<Post>({
            model: 'post',
            where: [{ field: 'id', value: postId }],
            update: {
              likesCount,
            },
          });
        }).catch(() => {
          throw APIError.from('INTERNAL_SERVER_ERROR', SOCIAL_NETWORK_ERROR_CODES.POST_FAILED_TO_LIKE);
        });

        if (!updatedPost) {
          throw APIError.from('INTERNAL_SERVER_ERROR', SOCIAL_NETWORK_ERROR_CODES.POST_FAILED_TO_UPDATE);
        }

        return ctx.json({ post: updatedPost });
      }),
      unlikePost: createAuthEndpoint('/social/posts/unlike', {
        method: "POST",
        body: z.object({
          postId: z.string(),
        }),
        response: z.object({
          post: Post,
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { postId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!postId || postId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.POST_ID_REQUIRED);
        }

        const adapter = ctx.context.adapter;
        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const post = await socialNetworkAdapter.getPostById(postId);
        if (!post) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.POST_NOT_FOUND);
        }

        const existingLike = await socialNetworkAdapter.isPostLiked(postId, userId);
        if (!existingLike) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.POST_ALREADY_UNLIKED);
        }

        const updatedPost = await adapter.transaction(async (tx) => {
          await tx.delete({
            model: 'post_like',
            where: [{ field: 'postId', value: postId }, { field: 'userId', value: userId }],
          });

          const likesCount = await tx.count({
            model: 'post_like',
            where: [{ field: 'postId', value: postId }],
          });

          return await tx.update<Post>({
            model: 'post',
            where: [{ field: 'id', value: postId }],
            update: {
              likesCount,
            },
          });
        }).catch(() => {
          throw APIError.from('INTERNAL_SERVER_ERROR', SOCIAL_NETWORK_ERROR_CODES.POST_FAILED_TO_UNLIKE);
        });

        if (!updatedPost) {
          throw APIError.from('INTERNAL_SERVER_ERROR', SOCIAL_NETWORK_ERROR_CODES.POST_FAILED_TO_UPDATE);
        }

        return ctx.json({ post: updatedPost });
      }),
      addPostToBookmarks: createAuthEndpoint('/social/post/bookmark/add', {
        method: "POST",
        body: z.object({
          postId: z.string(),
        }),
        response: z.object({
          postBookmark: PostBookmark,
        }),
        use: [sessionMiddleware],
      }, async (ctx) => {
        const { postId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw APIError.from('UNAUTHORIZED', SOCIAL_NETWORK_ERROR_CODES.UNAUTHORIZED);
        }

        if (!postId || postId.length === 0) {
          throw APIError.from('BAD_REQUEST', SOCIAL_NETWORK_ERROR_CODES.POST_ID_REQUIRED);
        }

        const socialNetworkAdapter = new SocialNetworkAdapter(ctx.context.adapter);

        const post = await socialNetworkAdapter.getPostById(postId);
        if (!post) {
          throw APIError.from('NOT_FOUND', SOCIAL_NETWORK_ERROR_CODES.POST_NOT_FOUND);
        }

        const existingBookmark = await socialNetworkAdapter.isPostBookmarked(postId, userId);
        if (existingBookmark) {
          return ctx.json({ postBookmark: existingBookmark });
        }

        const postBookmark = await socialNetworkAdapter.addPostToBookmarks(userId, postId);

        return ctx.json({ postBookmark });
      }),
    },
  } satisfies BetterAuthPlugin;
};
