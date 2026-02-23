import { SocialNetworkHooks } from "./hooks.js";
import { GroupChatMessage } from "./types.js";
import { z } from "zod";


export const SocialNetworkOptions = z.object({
  allowSelfFriendRequest: z.boolean().optional().default(false),
  allowMultipleGroupChatWithSamePerson: z.boolean().optional().default(false),
  allowAddingUnknownMembersToGroupChat: z.boolean().optional().default(false),
  messageDeletionRule: z.enum(['CANT_DELETE', 'SENDER_ONLY_VISIBLE', 'VISIBLE']).optional().default('VISIBLE'),
  deletedMessagePlaceholder: z.string().or(z.function()).optional().default('Message has been deleted'),
  automaticBackFriend: z.boolean().optional().default(false),
  maxGroupSize: z.number().positive().int().gte(2).optional().default(10).transform(value => {
    if (value < 2) {
      throw new Error('Max group size must be greater than 2');
    }
    return value;
  }),
}).default({
  allowSelfFriendRequest: false,
  allowMultipleGroupChatWithSamePerson: false,
  allowAddingUnknownMembersToGroupChat: false,
  messageDeletionRule: 'VISIBLE',
  deletedMessagePlaceholder: 'Message has been deleted',
  automaticBackFriend: false,
  maxGroupSize: 10,
});


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
   * Deleted message placeholder
   * Defaults to 'Message has been deleted'
   */
  deletedMessagePlaceholder?: string | ((message: GroupChatMessage) => Promise<string>);

  /**
   * Whether to automatically back a friend request when it is accepted
   * Defaults to false
   */
  automaticBackFriend?: boolean;

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