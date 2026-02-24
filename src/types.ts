import { z } from "zod";

export const FriendRequest = z.object({
  id: z.string(),
  senderId: z.string(),
  receiverId: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected']),
});

export type FriendRequest = z.infer<typeof FriendRequest>;

export const Friend = z.object({
  id: z.string(),
  userId: z.string(),
  friendId: z.string(),
});

export type Friend = z.infer<typeof Friend>;

export const Chat = z.object({
  id: z.string(),

  user1Id: z.string(),
  user2Id: z.string(),
});

export type Chat = z.infer<typeof Chat>;

export const GroupChat = z.object({
  id: z.string(),

  name: z.string(),
  description: z.string().nullable().optional().default(null),
  createdById: z.string(),
  /* membersIds: z.array(z.string()), */
});

export type GroupChat = z.infer<typeof GroupChat>;

export const GroupChatMember = z.object({
  id: z.string(),

  groupChatId: z.string(),
  userId: z.string(),
  role: z.enum(['admin', 'member']),
  joinedAt: z.date(),
});

export type GroupChatMember = z.infer<typeof GroupChatMember>;

export const ChatMessage = z.object({
  id: z.string(),

  content: z.string(),
  senderId: z.string(),
  chatId: z.string(),
  deletedAt: z.date().nullable().optional().default(null),
});

export type ChatMessage = z.infer<typeof ChatMessage>;

export const GroupChatMessage = z.object({
  id: z.string(),

  content: z.string(),
  senderId: z.string(),
  groupChatId: z.string(),
  deletedAt: z.date().nullable().optional().default(null),
});

export type GroupChatMessage = z.infer<typeof GroupChatMessage>;

export const BlockedUser = z.object({
  id: z.string(),
  userId: z.string(),
  blockedUserId: z.string(),
});

export type BlockedUser = z.infer<typeof BlockedUser>;

export const Post = z.object({
  id: z.string(),
  posterId: z.string(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Post = z.infer<typeof Post>;