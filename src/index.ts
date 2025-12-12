import { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { mergeSchema } from 'better-auth/db';
import { getSchema } from './schema.js';

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  createdAt: Date;
}

export interface Chat {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupChat {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupChatMember {
  id: string;
  groupChatId: string;
  userId: string;
  role: 'admin' | 'member';
  joinedAt: Date;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  chatId: string | null;
  groupChatId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialNetworkOptions {
  /**
   * Whether to allow users to send friend requests to themselves
   * Defaults to false
   */
  allowSelfFriendRequest?: boolean;
}

export const socialNetwork = (options?: SocialNetworkOptions): BetterAuthPlugin => {
  const allowSelfFriendRequest = options?.allowSelfFriendRequest || false;

  return {
    id: 'social-network',
    schema: mergeSchema(getSchema()),
    endpoints: {
      sendFriendRequest: createAuthEndpoint('/social/friend-request/send', {
        method: "POST",
      }, async(ctx) => {

        const { receiverId } = ctx.body;
          const userId = ctx.context.session?.user.id;

          if (!userId) {
            throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
          }

          if (!receiverId || typeof receiverId !== 'string') {
            throw new APIError('BAD_REQUEST', { message: 'receiverId is required' });
          }

          if (!allowSelfFriendRequest && receiverId === userId) {
            throw new APIError('BAD_REQUEST', { message: 'You cannot send a friend request to yourself' });
          }

          const adapter = ctx.context.adapter;

          // Check if users are already friends
          const existingFriend = await adapter.findOne<Friend>({
            model: 'friend',
            where: [
              { field: 'userId', value: userId },
              { field: 'friendId', value: receiverId }
            ]
          }) || await adapter.findOne<Friend>({
            model: 'friend',
            where: [
              { field: 'userId', value: receiverId },
              { field: 'friendId', value: userId }
            ]
          });

          if (existingFriend) {
            throw new APIError('BAD_REQUEST', { message: 'Users are already friends' });
          }

          // Check if there's already a pending request
          const existingRequest = await adapter.findOne<FriendRequest>({
            model: 'friend_request',
            where: [
              { field: 'senderId', value: userId },
              { field: 'receiverId', value: receiverId },
              { field: 'status', value: 'pending' }
            ]
          });

          if (existingRequest) {
            throw new APIError('BAD_REQUEST', { message: 'Friend request already sent' });
          }

          const friendRequest = await adapter.create<FriendRequest>({
            model: 'friend_request',
            data: {
              senderId: userId,
              receiverId: receiverId,
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          });
          return ctx.json({
            friendRequest
          })
      }),
      acceptFriendRequest: createAuthEndpoint('/social/friend-request/accept', {
        method: "POST",
      }, async(ctx) => {
        const { requestId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        if (!requestId || typeof requestId !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'requestId is required' });
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
          throw new APIError('NOT_FOUND', { message: 'Friend request not found' });
        }

        if (friendRequest.status !== 'pending') {
          throw new APIError('BAD_REQUEST', { message: 'Friend request already processed' });
        }

        // Update request status
        await adapter.update<FriendRequest>({
          model: 'friend_request',
          where: [{ field: 'id', value: requestId }],
          update: {
            status: 'accepted',
            updatedAt: new Date(),
          }
        });

        // Create friend relationship (both directions)
        await adapter.create<Friend>({
          model: 'friend',
          data: {
            userId: friendRequest.senderId,
            friendId: friendRequest.receiverId,
            createdAt: new Date(),
          }
        });

        await adapter.create<Friend>({
          model: 'friend',
          data: {
            userId: friendRequest.receiverId,
            friendId: friendRequest.senderId,
            createdAt: new Date(),
          }
        });

        return ctx.json({ success: true });
      }),
      rejectFriendRequest: createAuthEndpoint('/social/friend-request/reject', {
        method: "POST",
      }, async(ctx) => {
        const { requestId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        if (!requestId || typeof requestId !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'requestId is required' });
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
          throw new APIError('NOT_FOUND', { message: 'Friend request not found' });
        }

        if (friendRequest.status !== 'pending') {
          throw new APIError('BAD_REQUEST', { message: 'Friend request already processed' });
        }

        await adapter.update<FriendRequest>({
          model: 'friend_request',
          where: [{ field: 'id', value: requestId }],
          update: {
            status: 'rejected',
            updatedAt: new Date(),
          }
        });

        return ctx.json({ success: true });
      }),
      listFriendRequests: createAuthEndpoint('/social/friend-request/list', {
        method: "GET",
      }, async(ctx) => {
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        const adapter = ctx.context.adapter;

        const sentRequests = await adapter.findMany<FriendRequest>({
          model: 'friend_request',
          where: [{ field: 'senderId', value: userId }]
        });

        const receivedRequests = await adapter.findMany<FriendRequest>({
          model: 'friend_request',
          where: [{ field: 'receiverId', value: userId }]
        });

        return ctx.json({
          sent: sentRequests,
          received: receivedRequests,
        });
      }),
      listFriends: createAuthEndpoint('/social/friends/list', {
        method: "GET",
      }, async(ctx) => {
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        const adapter = ctx.context.adapter;

        const friends = await adapter.findMany<Friend>({
          model: 'friend',
          where: [{ field: 'userId', value: userId }]
        });

        return ctx.json({
          friends: friends,
        });
      }),
      removeFriend: createAuthEndpoint('/social/friends/remove', {
        method: "POST",
      }, async(ctx) => {
        const { friendId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        if (!friendId || typeof friendId !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'friendId is required' });
        }

        const adapter = ctx.context.adapter;

        // Remove both directions
        await adapter.delete({
          model: 'friend',
          where: [
            { field: 'userId', value: userId },
            { field: 'friendId', value: friendId }
          ]
        });

        await adapter.delete({
          model: 'friend',
          where: [
            { field: 'userId', value: friendId },
            { field: 'friendId', value: userId }
          ]
        });

        return ctx.json({ success: true });
      }),
      createChat: createAuthEndpoint('/social/chat/create', {
        method: "POST",
      }, async(ctx) => {
        const { friendId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        if (!friendId || typeof friendId !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'friendId is required' });
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
          throw new APIError('BAD_REQUEST', { message: 'Users must be friends to create a chat' });
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
          return ctx.json({ chat: existingChat });
        }

        const chat = await adapter.create<Chat>({
          model: 'chat',
          data: {
            user1Id: userId,
            user2Id: friendId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        });

        return ctx.json({ chat });
      }),
      listChats: createAuthEndpoint('/social/chat/list', {
        method: "GET",
      }, async(ctx) => {
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        const adapter = ctx.context.adapter;

        const chats = await adapter.findMany<Chat>({
          model: 'chat',
          where: [
            { field: 'user1Id', value: userId }
          ]
        });

        const chats2 = await adapter.findMany<Chat>({
          model: 'chat',
          where: [
            { field: 'user2Id', value: userId }
          ]
        });

        return ctx.json({
          chats: [...chats, ...chats2],
        });
      }),
      getChatMessages: createAuthEndpoint('/social/chat/messages', {
        method: "GET",
      }, async(ctx) => {
        const chatId = ctx.query?.chatId;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        if (!chatId || typeof chatId !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'chatId is required' });
        }

        const adapter = ctx.context.adapter;

        // Verify user is part of the chat
        const chat = await adapter.findOne<Chat>({
          model: 'chat',
          where: [{ field: 'id', value: chatId }]
        });

        if (!chat) {
          throw new APIError('NOT_FOUND', { message: 'Chat not found' });
        }

        if (chat.user1Id !== userId && chat.user2Id !== userId) {
          throw new APIError('FORBIDDEN', { message: 'You are not part of this chat' });
        }

        const messages = await adapter.findMany<Message>({
          model: 'message',
          where: [{ field: 'chatId', value: chatId }]
        });

        return ctx.json({
          messages: messages,
        });
      }),
      sendChatMessage: createAuthEndpoint('/social/chat/send-message', {
        method: "POST",
      }, async(ctx) => {
        const { chatId, content } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        if (!chatId || typeof chatId !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'chatId is required' });
        }

        if (!content || typeof content !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'content is required' });
        }

        const adapter = ctx.context.adapter;

        // Verify user is part of the chat
        const chat = await adapter.findOne<Chat>({
          model: 'chat',
          where: [{ field: 'id', value: chatId }]
        });

        if (!chat) {
          throw new APIError('NOT_FOUND', { message: 'Chat not found' });
        }

        if (chat.user1Id !== userId && chat.user2Id !== userId) {
          throw new APIError('FORBIDDEN', { message: 'You are not part of this chat' });
        }

        const message = await adapter.create<Message>({
          model: 'message',
          data: {
            content: content,
            senderId: userId,
            chatId: chatId,
            groupChatId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
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

        return ctx.json({ message });
      }),
      createGroupChat: createAuthEndpoint('/social/group-chat/create', {
        method: "POST",
      }, async(ctx) => {
        const { name, description, memberIds } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        if (!name || typeof name !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'name is required' });
        }

        const adapter = ctx.context.adapter;

        const groupChat = await adapter.create<GroupChat>({
          model: 'group_chat',
          data: {
            name: name,
            description: description || null,
            createdById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        });

        // Add creator as admin
        await adapter.create<GroupChatMember>({
          model: 'group_chat_member',
          data: {
            groupChatId: groupChat.id,
            userId: userId,
            role: 'admin',
            joinedAt: new Date(),
          }
        });

        // Add other members if provided
        if (Array.isArray(memberIds)) {
          for (const memberId of memberIds) {
            if (memberId !== userId) {
              await adapter.create<GroupChatMember>({
                model: 'group_chat_member',
                data: {
                  groupChatId: groupChat.id,
                  userId: memberId,
                  role: 'member',
                  joinedAt: new Date(),
                }
              });
            }
          }
        }

        return ctx.json({ groupChat });
      }),
      listGroupChats: createAuthEndpoint('/social/group-chat/list', {
        method: "GET",
      }, async(ctx) => {
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        const adapter = ctx.context.adapter;

        const memberships = await adapter.findMany<GroupChatMember>({
          model: 'group_chat_member',
          where: [{ field: 'userId', value: userId }]
        });

        const groupChatIds = memberships.map(m => m.groupChatId);
        const groupChats = await Promise.all(
          groupChatIds.map(id =>
            adapter.findOne<GroupChat>({
              model: 'group_chat',
              where: [{ field: 'id', value: id }]
            })
          )
        );

        return ctx.json({
          groupChats: groupChats.filter(gc => gc !== null),
        });
      }),
      addGroupChatMember: createAuthEndpoint('/social/group-chat/add-member', {
        method: "POST",
      }, async(ctx) => {
        const { groupChatId, userId: newMemberId } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        if (!groupChatId || typeof groupChatId !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'groupChatId is required' });
        }

        if (!newMemberId || typeof newMemberId !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'userId is required' });
        }

        const adapter = ctx.context.adapter;

        // Check if user is admin or member
        const membership = await adapter.findOne<GroupChatMember>({
          model: 'group_chat_member',
          where: [
            { field: 'groupChatId', value: groupChatId },
            { field: 'userId', value: userId }
          ]
        });

        if (!membership) {
          throw new APIError('FORBIDDEN', { message: 'You are not a member of this group' });
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
          throw new APIError('BAD_REQUEST', { message: 'User is already a member of this group' });
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

        return ctx.json({ success: true });
      }),
      removeGroupChatMember: createAuthEndpoint('/social/group-chat/remove-member', {
        method: "POST",
      }, async(ctx) => {
        const { groupChatId, userId: memberIdToRemove } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        if (!groupChatId || typeof groupChatId !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'groupChatId is required' });
        }

        if (!memberIdToRemove || typeof memberIdToRemove !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'userId is required' });
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
          throw new APIError('FORBIDDEN', { message: 'Only admins can remove members' });
        }

        // Don't allow removing the creator
        const groupChat = await adapter.findOne<GroupChat>({
          model: 'group_chat',
          where: [{ field: 'id', value: groupChatId }]
        });

        if (groupChat?.createdById === memberIdToRemove) {
          throw new APIError('BAD_REQUEST', { message: 'Cannot remove the group creator' });
        }

        await adapter.delete({
          model: 'group_chat_member',
          where: [
            { field: 'groupChatId', value: groupChatId },
            { field: 'userId', value: memberIdToRemove }
          ]
        });

        return ctx.json({ success: true });
      }),
      getGroupChatMessages: createAuthEndpoint('/social/group-chat/messages', {
        method: "GET",
      }, async(ctx) => {
        const groupChatId = ctx.query?.groupChatId;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        if (!groupChatId || typeof groupChatId !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'groupChatId is required' });
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
          throw new APIError('FORBIDDEN', { message: 'You are not a member of this group' });
        }

        const messages = await adapter.findMany<Message>({
          model: 'message',
          where: [{ field: 'groupChatId', value: groupChatId }]
        });

        return ctx.json({
          messages: messages,
        });
      }),
      sendGroupChatMessage: createAuthEndpoint('/social/group-chat/send-message', {
        method: "POST",
      }, async(ctx) => {
        const { groupChatId, content } = ctx.body;
        const userId = ctx.context.session?.user.id;

        if (!userId) {
          throw new APIError('UNAUTHORIZED', { message: 'You must be logged in' });
        }

        if (!groupChatId || typeof groupChatId !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'groupChatId is required' });
        }

        if (!content || typeof content !== 'string') {
          throw new APIError('BAD_REQUEST', { message: 'content is required' });
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
          throw new APIError('FORBIDDEN', { message: 'You are not a member of this group' });
        }

        const message = await adapter.create<Message>({
          model: 'message',
          data: {
            content: content,
            senderId: userId,
            chatId: null,
            groupChatId: groupChatId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        });

        // Update group chat updatedAt
        await adapter.update<GroupChat>({
          model: 'group_chat',
          where: [{ field: 'id', value: groupChatId }],
          update: {
            updatedAt: new Date(),
          }
        });

        return ctx.json({ message });
      }),
    },
  };
};
