import { APIError, BetterAuthOptions, DBAdapter, Where } from "better-auth";
import {
  BlockedUser,
  Chat,
  ChatMessage,
  Friend,
  FriendRequest,
  GroupChat,
  GroupChatMember,
  GroupChatMessage,
  Post,
  PostLike,
} from "./types.js";
import { SOCIAL_NETWORK_ERROR_CODES } from "./error.js";

export class SocialNetworkAdapter {
  constructor(private readonly adapter: DBAdapter<BetterAuthOptions>) {}

  async isFriendRequestExists(
    senderId: string,
    receiverId: string,
    status: FriendRequest["status"],
  ) {
    return this.adapter
      .count({
        model: "friend_request",
        where: [
          { field: "senderId", value: senderId },
          { field: "receiverId", value: receiverId },
          { field: "status", value: status },
        ],
      })
      .then((count) => count !== 0);
  }

  async getFriendRequestById(id: string) {
    return this.adapter.findOne<FriendRequest>({
      model: "friend_request",
      where: [{ field: "id", value: id }],
    });
  }

  async sendFriendRequest(senderId: string, receiverId: string) {
    return this.adapter
      .create<FriendRequest>({
        model: "friend_request",
        data: {
          senderId,
          receiverId,
          status: "pending",
        },
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_FAILED_TO_SEND,
        );
      });
  }

  async updateFriendRequestStatus(id: string, status: FriendRequest["status"]) {
    return this.adapter
      .update<FriendRequest>({
        model: "friend_request",
        where: [{ field: "id", value: id }],
        update: {
          status,
        },
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_FAILED_TO_UPDATE,
        );
      });
  }

  async getFriendRequestsSent(
    userId: string,
    limit: number,
    page: number,
    status: FriendRequest["status"] | null,
  ) {
    const where: Where[] = [{ field: "senderId", value: userId }];
    if (status) {
      where.push({ field: "status", value: status });
    }
    return this.adapter.findMany<FriendRequest>({
      model: "friend_request",
      where,
      limit: limit,
      offset: (page - 1) * limit,
    });
  }

  async getFriendRequestsReceived(
    userId: string,
    limit: number,
    page: number,
    status: FriendRequest["status"] | null,
  ) {
    const where: Where[] = [{ field: "receiverId", value: userId }];
    if (status) {
      where.push({ field: "status", value: status });
    }

    return this.adapter.findMany<FriendRequest>({
      model: "friend_request",
      where,
      limit: limit,
      offset: (page - 1) * limit,
    });
  }

  async isFriend(userId: string, friendId: string) {
    const isFriend = await this.adapter.findOne<Friend>({
      model: "friend",
      where: [
        { field: "userId", value: userId },
        { field: "friendId", value: friendId },
      ],
      select: ["id"],
    });

    return !!isFriend;
  }

  async getFriends(userId: string, limit: number, page: number) {
    return this.adapter.findMany<Friend>({
      model: "friend",
      where: [{ field: "userId", value: userId }],
      limit: limit,
      offset: (page - 1) * limit,
    });
  }

  async removeFriend(userId: string, friendId: string) {
    return this.adapter
      .delete({
        model: "friend",
        where: [
          { field: "userId", value: userId },
          { field: "friendId", value: friendId },
        ],
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.FRIEND_FAILED_TO_REMOVE,
        );
      });
  }

  async getChatByUsersId(userId: string, friendId: string) {
    return this.adapter.findOne<Chat>({
      model: "chat",
      where: [
        { field: "user1Id", value: [userId, friendId], operator: "in" },
        { field: "user2Id", value: [userId, friendId], operator: "in" },
      ],
    });
  }

  async getChatById(id: string) {
    return this.adapter.findOne<Chat>({
      model: "chat",
      where: [{ field: "id", value: id }],
    });
  }

  async createChat(userId: string, friendId: string) {
    return this.adapter
      .create<Chat>({
        model: "chat",
        data: {
          user1Id: userId,
          user2Id: friendId,
        },
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.CHAT_FAILED_TO_CREATE,
        );
      });
  }

  async getChats(userId: string, limit: number, page: number) {
    return this.adapter.findMany<Chat>({
      model: "chat",
      where: [
        { field: "user1Id", value: userId },
        { field: "user2Id", value: userId },
      ],
      limit: limit,
      offset: (page - 1) * limit,
    });
  }

  async getChatMessages(chatId: string, limit: number, page: number) {
    return this.adapter
      .findMany<ChatMessage>({
        model: "chat_message",
        where: [{ field: "chatId", value: chatId }],
        limit: limit,
        offset: (page - 1) * limit,
      })
      .then((messages) =>
        messages.filter((message) => message.deletedAt === null),
      );
  }

  async getChatMessageById(id: string) {
    return this.adapter
      .findOne<ChatMessage>({
        model: "chat_message",
        where: [{ field: "id", value: id }],
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.CHAT_MESSAGE_NOT_FOUND,
        );
      });
  }

  async createChatMessage(chatId: string, senderId: string, content: string) {
    return this.adapter
      .create<ChatMessage>({
        model: "chat_message",
        data: {
          chatId,
          senderId,
          content,
          deletedAt: null,
        },
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.CHAT_MESSAGE_FAILED_TO_CREATE,
        );
      });
  }

  async deleteChatMessage(id: string) {
    return this.adapter
      .update<ChatMessage>({
        model: "chat_message",
        where: [{ field: "id", value: id }],
        update: {
          deletedAt: new Date(),
        },
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.CHAT_MESSAGE_FAILED_TO_DELETE,
        );
      });
  }

  async isInGroupChat(userId: string, groupChatId: string) {
    return this.adapter.findOne<GroupChatMember>({
      model: "group_chat_member",
      where: [
        { field: "userId", value: userId },
        { field: "groupChatId", value: groupChatId },
      ],
    });
  }

  async getGroupChats(userId: string, limit: number, page: number) {
    const memberships = await this.adapter.findMany<GroupChatMember>({
      model: "group_chat_member",
      where: [{ field: "userId", value: userId }],
    });
    const groupChatIds = memberships.map((m) => m.groupChatId);

    return this.adapter.findMany<GroupChat>({
      model: "group_chat",
      where: [{ field: "id", value: groupChatIds, operator: "in" }],
      limit: limit,
      offset: (page - 1) * limit,
    });
  }

  async getGroupChatById(id: string) {
    return this.adapter.findOne<GroupChat>({
      model: "group_chat",
      where: [{ field: "id", value: id }],
    });
  }

  async getGroupChatMembers(groupChatId: string) {
    return this.adapter.findMany<GroupChatMember>({
      model: "group_chat_member",
      where: [{ field: "groupChatId", value: groupChatId }],
    });
  }

  async leaveGroupChat(userId: string, groupChatId: string) {
    return this.adapter
      .delete({
        model: "group_chat_member",
        where: [
          { field: "userId", value: userId },
          { field: "groupChatId", value: groupChatId },
        ],
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_FAILED_TO_LEAVE,
        );
      });
  }

  async updateGroupChat(id: string, data: Partial<GroupChat>) {
    return this.adapter
      .update<GroupChat>({
        model: "group_chat",
        where: [{ field: "id", value: id }],
        update: GroupChat.pick({ name: true, description: true }).parse(data),
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_FAILED_TO_UPDATE,
        );
      });
  }

  async addMemberToGroupChat(groupChatId: string, userId: string) {
    return this.adapter
      .create<GroupChatMember>({
        model: "group_chat_member",
        data: {
          groupChatId,
          userId,
          role: "member",
          joinedAt: new Date(),
        },
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_FAILED_TO_ADD_MEMBER,
        );
      });
  }

  async removeMemberFromGroupChat(groupChatId: string, memberId: string) {
    return this.adapter
      .delete({
        model: "group_chat_member",
        where: [
          { field: "groupChatId", value: groupChatId },
          { field: "id", value: memberId },
        ],
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_FAILED_TO_REMOVE_MEMBER,
        );
      });
  }

  async getGroupChatMessages(groupChatId: string, limit: number, page: number) {
    return this.adapter
      .findMany<GroupChatMessage>({
        model: "group_chat_message",
        where: [{ field: "groupChatId", value: groupChatId }],
        limit: limit,
        offset: (page - 1) * limit,
      });
  }

  async getGroupChatMessagesFromUser(groupChatId: string, userId: string, limit: number, page: number) {
    return this.adapter.findMany<GroupChatMessage>({
      model: "group_chat_message",
      where: [{ field: "groupChatId", value: groupChatId }, { field: "senderId", value: userId }],
      limit: limit,
      offset: (page - 1) * limit,
    });
  }

  async getGroupChatMessageById(id: string) {
    return this.adapter.findOne<GroupChatMessage>({
      model: "group_chat_message",
      where: [{ field: "id", value: id }],
    });
  }
  async createGroupChatMessage(groupChatId: string, senderId: string, content: string) {
    return this.adapter.create<GroupChatMessage>({
      model: "group_chat_message",
      data: {
        groupChatId,
        senderId,
        content,
        deletedAt: null,
      },
    }).catch(() => {
      throw APIError.from(
        "INTERNAL_SERVER_ERROR",
        SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_FAILED_TO_SEND_MESSAGE,
      );
    });
  }

  async deleteGroupChatMessage(id: string) {
    return this.adapter.update<GroupChatMessage>({
      model: "group_chat_message",
      where: [{ field: "id", value: id }],
      update: {
        deletedAt: new Date(),
      },
    }).catch(() => {
      throw APIError.from(
        "INTERNAL_SERVER_ERROR",
        SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_FAILED_TO_DELETE_MESSAGE,
      );
    });
  }

  async updateGroupChatMessage(id: string, data: Partial<GroupChatMessage>) {
    return this.adapter.update<GroupChatMessage>({
      model: "group_chat_message",
      where: [{ field: "id", value: id }],
      update: GroupChatMessage.pick({ content: true, deletedAt: true }).parse(data),
    }).catch(() => {
      throw APIError.from(
        "INTERNAL_SERVER_ERROR",
        SOCIAL_NETWORK_ERROR_CODES.GROUP_CHAT_FAILED_TO_UPDATE_MESSAGE,
      );
    });
  }

  async getBlockedUsers(userId: string) {
    return this.adapter.findMany<BlockedUser>({
      model: "blocked_user",
      where: [{ field: "userId", value: userId }],
    });
  }

  async isBlocked(userId: string, blockedUserId: string) {
    return this.adapter
      .count({
        model: "blocked_user",
        where: [
          { field: "userId", value: userId },
          { field: "blockedUserId", value: blockedUserId },
        ],
      })
      .then((count) => count !== 0);
  }

  async blockUser(userId: string, blockedUserId: string) {
    return this.adapter
      .create<BlockedUser>({
        model: "blocked_user",
        data: {
          userId,
          blockedUserId,
        },
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_FAILED_TO_BLOCK,
        );
      });
  }

  async unblockUser(userId: string, blockedUserId: string) {
    return this.adapter
      .delete({
        model: "blocked_user",
        where: [
          { field: "userId", value: userId },
          { field: "blockedUserId", value: blockedUserId },
        ],
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.BLOCKED_USER_FAILED_TO_UNBLOCK,
        );
      });
  }

  async addFriend(userId: string, friendId: string) {
    return this.adapter.create<Friend>({
      model: "friend",
      data: {
        userId,
        friendId,
      },
    });
  }

  async rejectAllFriendRequests(userId: string) {
    return this.adapter
      .updateMany({
        model: "friend_request",
        where: [
          { field: "receiverId", value: userId },
          { field: "status", value: "pending" },
        ],
        update: {
          status: "rejected",
        },
      })
      .catch(() => {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          SOCIAL_NETWORK_ERROR_CODES.FRIEND_REQUEST_FAILED_TO_UPDATE,
        );
      });
  }

  async getPosts(userId: string, limit: number, page: number) {
    return this.adapter.findMany<Post>({
      model: "post",
      where: [{ field: "posterId", value: userId }],
      limit: limit,
      offset: (page - 1) * limit,
    });
  }

  async getPostById(id: string) {
    return this.adapter.findOne<Post>({
      model: "post",
      where: [{ field: "id", value: id }],
    });
  }

  async createPost(posterId: string, content: string) {
    return this.adapter.create<Post>({
      model: "post",
      data: {
        posterId,
        content,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }).catch(() => {
      throw APIError.from(
        "INTERNAL_SERVER_ERROR",
        SOCIAL_NETWORK_ERROR_CODES.POST_FAILED_TO_CREATE,
      );
    });
  }

  async deletePost(id: string) {
    return this.adapter.delete({
      model: "post",
      where: [{ field: "id", value: id }],
    }).catch(() => {
      throw APIError.from(
        "INTERNAL_SERVER_ERROR",
        SOCIAL_NETWORK_ERROR_CODES.POST_FAILED_TO_DELETE,
      );
    });
  }

  async updatePost(id: string, data: Partial<Post>) {
    return this.adapter.update<Post>({
      model: "post",
      where: [{ field: "id", value: id }],
      update: Post.pick({ content: true, likesCount: true, commentsCount: true, sharesCount: true, updatedAt: true }).parse(data),
    }).catch(() => {
      throw APIError.from(
        "INTERNAL_SERVER_ERROR",
        SOCIAL_NETWORK_ERROR_CODES.POST_FAILED_TO_UPDATE,
      );
    });
  }

  async isPostLiked(postId: string, userId: string) {
    return this.adapter.findOne<PostLike>({
      model: "post_like",
      where: [{ field: "postId", value: postId }, { field: "userId", value: userId }],
    });
  }

  async likePost(postId: string, userId: string) {
    return this.adapter.create<PostLike>({
      model: "post_like",
      data: {
        postId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }).catch(() => {
      throw APIError.from(
        "INTERNAL_SERVER_ERROR",
        SOCIAL_NETWORK_ERROR_CODES.POST_FAILED_TO_LIKE,
      );
    });
  }

  async unlikePost(postId: string, userId: string) {
    return this.adapter.delete({
      model: "post_like",
      where: [{ field: "postId", value: postId }, { field: "userId", value: userId }],
    }).catch(() => {
      throw APIError.from(
        "INTERNAL_SERVER_ERROR",
        SOCIAL_NETWORK_ERROR_CODES.POST_FAILED_TO_UNLIKE,
      );
    });
  }
}
