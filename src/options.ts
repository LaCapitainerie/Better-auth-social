import { SocialNetworkHooks } from "./hooks.js";

export type SocialNetworkOptions = {
  /**
   * Whether to allow users to send friend requests to themselves
   * Defaults to false
   */
  allowSelfFriendRequest?: boolean;

  /**
   * Whether to allow users to create multiple group chats with the same person
   * Defaults to false
   */
  allowMultipleGroupChatWithSamePerson?: boolean;

  /**
   * Whether to allow users to add unknown members to a group chat
   * Defaults to false
   */
  allowAddingUnknownMembersToGroupChat?: boolean;

  /**
   * Message deletion rule
   * - CANT_DELETE: User can't delete their messages.
   * - SENDER_ONLY_VISIBLE: Only the sender will see the deleted message.
   * - VISIBLE: Everyone will see that a message has been deleted.
   * Defaults to VISIBLE
   */
  messageDeletionRule?: 'CANT_DELETE' | 'SENDER_ONLY_VISIBLE' | 'VISIBLE';

  /**
   * Maximum number of members allowed in a group chat.
   * Can be a strict number or an async function that returns a number.
   * Defaults to undefined (no limit)
   */
  maxGroupSize?: number | (() => Promise<number>);

  /**
   * Hooks for various social network events
   */
  hooks?: SocialNetworkHooks;
}