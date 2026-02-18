import type { FriendRequest, Chat, ChatMessage, GroupChat, GroupChatMessage } from "./types.js";

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
   * Called when a group chat is created
   */
  onGroupChatCreate?: (data: GroupChat) => Promise<void> | void;

  /**
   * Called when a user joins a group chat
   */
  onGroupChatJoin?: (data: GroupChat) => Promise<void> | void;

  /**
   * Called when a user leaves or is removed from a group chat
   */
  onGroupChatLeave?: (data: GroupChat) => Promise<void> | void;

  /**
   * Called when a message is sent in a group chat
   */
  onGroupChatMessageSend?: (data: GroupChatMessage) => Promise<void> | void;
}