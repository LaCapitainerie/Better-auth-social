import type { FriendRequest, Chat, ChatMessage, GroupChat, GroupChatMessage, PostBookmark } from "./types.js";

export type SocialNetworkHooks = {
  /**
   * Called when a friend request is sent
   */
  onFriendRequestSend?: (data: FriendRequest) => Promise<void> | void;

  /**
   * Called when a friend request is accepted
   */
  onFriendRequestAccept?: (data: FriendRequest) => Promise<void> | void;

  /**
   * Called when a friend request is rejected
   */
  onFriendRequestReject?: (data: FriendRequest) => Promise<void> | void;

  /**
   * Called when a friend is removed
   */
  onFriendRemove?: (data: { userId: string; friendId: string }) => Promise<void> | void;

  /**
   * Called when a chat is created
   */
  onChatCreate?: (data: Chat) => Promise<void> | void;

  /**
   * Called when a message is sent in a chat
   */
  onChatMessageSend?: (data: ChatMessage) => Promise<void> | void;

  /**
   * Called when a chat message is deleted
   */
  onChatMessageDelete?: (data: ChatMessage) => Promise<void> | void;

  /**
   * Called when a group chat is created
   */
  onGroupChatCreate?: (data: GroupChat) => Promise<void> | void;

  /**
   * Called when a user joins a group chat
   */
  onGroupChatJoin?: (data: { userId: string; groupChatId: string }) => Promise<void> | void;

  /**
   * Called when a user leaves or is removed from a group chat
   */
  onGroupChatLeave?: () => Promise<void> | void;

  /**
   * Called when a message is sent in a group chat
   */
  onGroupChatMessageSend?: (data: GroupChatMessage) => Promise<void> | void;

  /**
   * Called when a group chat message is deleted
   */
  onGroupChatMessageDelete?: (data: GroupChatMessage) => Promise<void> | void;

  /**
   * Called when a post is added to bookmarks
   */
  onPostAddToBookmarks?: (data: PostBookmark) => Promise<void> | void;
}