import { defineErrorCodes } from "@better-auth/core/utils/error-codes";

export const SOCIAL_NETWORK_ERROR_CODES = defineErrorCodes({
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: 'You are not allowed to access this resource',
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred',

  /**
   * @feature NotFound
   */
  NOT_FOUND: 'Resource not found',


  /**
   * @feature FriendRequest
   */
  FRIEND_REQUEST_ID_REQUIRED: 'Friend request id is required',
  FRIEND_REQUEST_NOT_FOUND: 'Friend request not found',
  FRIEND_REQUEST_SENDER_ID_REQUIRED: 'Sender id is required',
  FRIEND_REQUEST_RECEIVER_ID_REQUIRED: 'Receiver id is required',
  FRIEND_REQUEST_ALREADY_SENT: 'Friend request already sent',
  FRIEND_REQUEST_ALREADY_FRIENDS: 'You cannot send a friend request to a friend',
  FRIEND_REQUEST_NOT_PENDING: 'Friend request is not pending',
  FRIEND_REQUEST_FAILED_TO_UPDATE: 'Failed to update this friend request',
  FRIEND_REQUEST_FAILED_TO_SEND: 'Failed to send friend request',

  /**
   * @feature Friend
   */
  NOT_A_FRIEND: 'You are not a friend with this user',
  FRIEND_NOT_FOUND: 'Friend not found',
  FRIEND_ID_REQUIRED: 'Friend id is required',
  FRIEND_FAILED_TO_REMOVE: 'Failed to remove friend',

  /**
   * @feature Chat
   */
  PRIVATE_CHAT_NOT_FOUND: 'Private chat not found',
  CHAT_FAILED_TO_CREATE: 'Failed to create chat',

  /**
   * @feature ChatMessage
   */
  CHAT_MESSAGE_NOT_FOUND: 'Chat message not found',
  CHAT_MESSAGE_CHAT_ID_REQUIRED: 'Chat id is required',
  CHAT_MESSAGE_ID_REQUIRED: 'Chat message id is required',
  CHAT_MESSAGE_CONTENT_REQUIRED: 'Chat message content is required',
  CHAT_MESSAGE_FAILED_TO_UPDATE: 'Failed to update this chat message',
  CHAT_MESSAGE_ALREADY_DELETED: 'Chat message already deleted',
  CHAT_MESSAGE_FAILED_TO_CREATE: 'Failed to create chat message',
  CHAT_MESSAGE_FAILED_TO_DELETE: 'Failed to delete chat message',

  /**
   * @feature GroupChat
   */
  GROUP_CHAT_ID_REQUIRED: 'Group chat id is required',
  GROUP_CHAT_NAME_REQUIRED: 'Group chat name is required',
  GROUP_CHAT_MEMBER_IDS_REQUIRED: 'Group chat member ids are required',
  GROUP_CHAT_NOT_FOUND: 'Group chat not found or you are not a member of this group',
  GROUP_CHAT_ALREADY_EXISTS: 'Group chat already exists',
  GROUP_CHAT_TOO_LARGE: 'Group cannot be larger than maximumGroupSize option value',
  GROUP_CHAT_ALREADY_MEMBER: 'User is already a member of this group',
  GROUP_CHAT_FAILED_TO_ADD_MEMBER: 'Failed to add member to group chat',
  GROUP_CHAT_FAILED_TO_UPDATE: 'Failed to update this group chat',
  GROUP_CHAT_FAILED_TO_REMOVE_MEMBER: 'Failed to remove member from group chat',
  GROUP_CHAT_CREATOR_NOT_ALLOWED_TO_REMOVE: 'Creator is not allowed to remove themselves from the group',
  GROUP_CHAT_NOT_ADMIN: 'You are not an admin of this group',
  GROUP_CHAT_FAILED_TO_LEAVE: 'Failed to leave group chat',

  /**
   * @feature GroupChatMember
   */
  GROUP_CHAT_MEMBER_ID_REQUIRED: 'Group chat member id is required',
  GROUP_CHAT_MEMBER_NOT_FOUND: 'Group chat member not found',
  GROUP_CHAT_MEMBER_NOT_AUTHOR: 'You are not the author of this message',
  GROUP_CHAT_MEMBER_NOT_ADMIN: 'You are not an admin of this group',
  GROUP_CHAT_MEMBER_NOT_MEMBER: 'You are not a member of this group',

  /**
   * @feature GroupChatMessage
   */
  GROUP_CHAT_MESSAGE_ID_REQUIRED: 'Group chat message id is required',
  GROUP_CHAT_MESSAGE_CONTENT_REQUIRED: 'Group chat message content is required',
  GROUP_CHAT_FAILED_TO_SEND_MESSAGE: 'Failed to send message to group chat',
  GROUP_CHAT_MESSAGE_ALREADY_DELETED: 'Group chat message already deleted',
  GROUP_CHAT_FAILED_TO_DELETE_MESSAGE: 'Failed to delete message from group chat',
  GROUP_CHAT_FAILED_TO_UPDATE_MESSAGE: 'Failed to update message in group chat',
  GROUP_CHAT_MESSAGE_NOT_FOUND: 'Group chat message not found',
  GROUP_CHAT_MESSAGE_NOT_AUTHOR: 'You are not the author of this message',

  /**
   * @feature BlockedUser
   */
  BLOCKED_USER_BLOCKED_USER_ID_REQUIRED: 'Blocked user id is required',
  BLOCKED_USER_NOT_FOUND: 'Blocked user not found',
  BLOCKED_USER_ALREADY_BLOCKED: 'User is already blocked',
  BLOCKED_USER_SELF_BLOCK_NOT_ALLOWED: 'You cannot block yourself',
  BLOCKED_USER_FAILED_TO_BLOCK: 'Failed to block user',
  BLOCKED_USER_FAILED_TO_UNBLOCK: 'Failed to unblock user',

  /**
   * @feature Post
   */
  POST_ID_REQUIRED: 'Post id is required',
  POST_TARGET_USER_ID_REQUIRED: 'Target user id is required',
  POST_NOT_FOUND: 'Post not found',
  POST_ALREADY_LIKED: 'Post already liked',
  POST_ALREADY_UNLIKED: 'Post already unliked',
  POST_FAILED_TO_UPDATE: 'Failed to update this post',
  POST_FAILED_TO_CREATE: 'Failed to create post',
  POST_FAILED_TO_DELETE: 'Failed to delete post',
  POST_FAILED_TO_LIKE: 'Failed to like post',
  POST_FAILED_TO_UNLIKE: 'Failed to unlike post',
  POST_CONTENT_REQUIRED: 'Post content is required',

  /**
   * @option allowSelfFriendRequest
   */
  SELF_REQUEST_NOT_ALLOWED: 'You cannot send a friend request to yourself',

 /**
  * @option allowMultipleGroupChatWithSamePerson
  */
  MULTIPLE_GROUP_CHAT_WITH_SAME_PERSON: 'You cannot create multiple group chats with the same person',

  /**
   * @option allowAddingUnknownMembersToGroupChat
   */
  ADDING_UNKNOWN_MEMBERS_TO_GROUP_CHAT: 'You cannot add unknown members to a group chat',

  /**
   * @option messageDeletionRule
   */
  MESSAGE_DELETION_RULE_CANT_DELETE: 'You cannot delete a message',

  /**
   * @option automaticBackFriend
   */
  AUTOMATIC_BACK_FRIEND: 'Failed to automatically back friend request',

  /**
   * @option maxGroupSize
   */
  MAX_GROUP_SIZE: 'Group size exceeds the maximum allowed size',

});

/**
 * @deprecated Use `...` instead.
 */