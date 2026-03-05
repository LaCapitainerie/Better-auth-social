# Better Auth Social Network Plugin

Better-Auth plugin to add social features to your app: friends, friend requests, private chat, group chats, blocking, and a feed (posts).

[![Frontend CI](https://github.com/LaCapitainerie/Better-auth-social/actions/workflows/vitest.yml/badge.svg)](https://github.com/LaCapitainerie/Better-auth-social/actions/workflows/vitest.yml)
[![Node.js Package](https://github.com/LaCapitainerie/Better-auth-social/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/LaCapitainerie/Better-auth-social/actions/workflows/npm-publish.yml)
[![Npm download](https://img.shields.io/npm/dm/better-auth-social.svg)](https://www.npmjs.com/package/better-auth-social)
[![Npm version](https://img.shields.io/npm/v/better-auth-social.svg)](https://www.npmjs.com/package/better-auth-social)
<!--[![Github stars](https://img.shields.io/github/stars/LaCapitainerie/better-auth-social)](https://www.npmjs.com/package/better-auth-social)-->


## Installation

```bash
pnpm add better-auth-social
# or
npm install better-auth-social
```

## Configuration

```typescript
import { socialNetwork } from "better-auth-social";
import { betterAuth } from "better-auth";

const auth = betterAuth({
  database: { /* your adapter */ },
  plugins: [
    socialNetwork({
      maxGroupSize: 20,
      hooks: {
        onFriendRequestAccept: async (data) => console.log("Request accepted", data),
      },
    }),
  ],
});
```

---

## Main features

### Friends & friend requests

Manage relationships: send a request, accept or reject, list friends and sent/received requests.

#### Example

```typescript
// Send a friend request
await auth.api.sendFriendRequest({
  body: { receiverId: "user-123" },
  headers,
});

// Accept
await auth.api.acceptFriendRequest({
  body: { requestId: "request-456" },
  headers,
});
```

| Method | Route | Body / Query |
|--------|--------|---------------|
| POST | `/social/friend-request/send` | `{ receiverId: string }` |
| POST | `/social/friend-request/accept` | `{ requestId: string }` |
| POST | `/social/friend-request/reject` | `{ requestId: string }` |
| GET | `/social/friend-request/sent/list` | — |
| GET | `/social/friend-request/received/list` | — |
| GET | `/social/friends/list` | `?page, limit` (optional) |
| POST | `/social/friends/remove` | `{ friendId: string }` |
| GET | `/social/friends/is-friend` | `?userId: string` |

---

### Private chat

1-to-1 conversations between friends: get or create a chat, list chats, send and delete messages.

#### Example

```typescript
// Get or create a chat with a friend
const { chat } = await auth.api.getOrCreateChat({
  query: { friendId: "friend-id" },
  headers,
});

// Send a message
await auth.api.sendChatMessage({
  body: { chatId: chat.id, content: "Hello!" },
  headers,
});
```

| Method | Route | Body / Query |
|--------|--------|---------------|
| GET | `/social/chat/get-or-create` | `?friendId: string` |
| GET | `/social/chat/list` | `?page, limit` (optional) |
| GET | `/social/chat-messages/list` | `?chatId, page, limit` |
| POST | `/social/chat-messages/send` | `{ chatId: string, content: string }` |
| POST | `/social/chat-messages/delete` | `{ messageId: string }` |

---

### Group chat

Create groups, manage members, send group messages.

#### Example

```typescript
// Create a group
const { groupChat } = await auth.api.createGroupChat({
  body: {
    name: "Team",
    description: "Project X",
    memberIds: ["user-1", "user-2"],
  },
  headers,
});

// Send a message in the group
await auth.api.sendGroupChatMessage({
  body: { groupChatId: groupChat.id, content: "Hi everyone" },
  headers,
});
```

| Method | Route | Body / Query |
|--------|--------|---------------|
| POST | `/social/group-chat/create` | `{ name: string, description?: string, memberIds: string[] }` |
| GET | `/social/group-chat/list` | `?page, limit` (optional) |
| GET | `/social/group-chat/members` | `?groupChatId: string` |
| POST | `/social/group-chat/add-member` | `{ groupChatId: string, userId: string }` |
| POST | `/social/group-chat/remove-member` | `{ groupChatId: string, userId: string }` |
| POST | `/social/group-chat/leave` | `{ groupChatId: string }` |
| POST | `/social/group-chat/update` | `{ groupChatId: string, name?: string, description?: string }` |
| GET | `/social/group-chat/messages` | `?groupChatId, page, limit` |
| POST | `/social/group-chat/send-message` | `{ groupChatId: string, content: string }` |
| POST | `/social/group-chat/delete-message` | `{ messageId: string }` |

---

### Blocked users

Block or unblock users and check if a user is blocked.

#### Example

```typescript
await auth.api.blockUser({
  body: { userId: "user-to-block" },
  headers,
});
```

| Method | Route | Body / Query |
|--------|--------|---------------|
| GET | `/social/blocked-users/list` | — |
| POST | `/social/blocked-users/block` | `{ userId: string }` |
| POST | `/social/blocked-users/unblock` | `{ userId: string }` |
| GET | `/social/blocked-users/is-blocked` | `{ userId: string }` |

---

### Feed (posts)

Create posts, like/unlike them, list a user’s posts.

#### Example

```typescript
const { post } = await auth.api.createPost({
  body: { content: "My first post" },
  headers,
});

const { post } = await auth.api.likePost({
  body: {
    postId: post.id,
  },
  headers,
});
```

| Method | Route | Body / Query |
|--------|--------|---------------|
| GET | `/social/posts/from-user` | `?userId, page, limit` |
| POST | `/social/posts/create` | `{ content: string }` (1–1000 characters) |
| POST | `/social/posts/delete` | `{ postId: string }` |
| POST | `/social/posts/like` | `{ postId: string }` |
| POST | `/social/posts/unlike` | `{ postId: string }` |

---

## Hooks

A few hooks to react to events (all optional, async supported):

| Hook | Triggered when |
|------|------------------|
| `onFriendRequestSend` | A friend request is sent. Receives the created `FriendRequest`. |
| `onFriendRequestAccept` | A friend request is accepted. Receives the updated `FriendRequest`. |
| `onGroupChatCreate` | A group is created. Receives the `GroupChat`. |
| `onChatMessageSend` | A message is sent in a private chat. Receives the `ChatMessage`. |

Other hooks exist (`onFriendRemove`, `onChatCreate`, `onGroupChatJoin`, `onGroupChatLeave`, etc.) — see the `SocialNetworkHooks` types in the code.

#### Example

```typescript
socialNetwork({
  hooks: {
    onFriendRequestAccept: async (request) => {
      await sendNotification(request.receiverId, "New friend!");
    },
    onGroupChatCreate: async (groupChat) => {
      console.log("Group created:", groupChat.name);
    },
  },
});
```

---

## Options

All plugin options:

| Option | Type | Default | Description |
|--------|------|--------|-------------|
| `allowSelfFriendRequest` | `boolean` | `false` | Allow users to send a friend request to themselves (useful for dev). |
| `allowMultipleGroupChatWithSamePerson` | `boolean` | `false` | Allow multiple groups with the exact same members. |
| `allowAddingUnknownMembersToGroupChat` | `boolean` | `false` | Allow adding users to a group who are not friends. |
| `messageDeletionRule` | `'CANT_DELETE' \| 'SENDER_ONLY_VISIBLE' \| 'VISIBLE'` | `'VISIBLE'` | Who can delete a message and who sees the deleted message. |
| `deletedMessagePlaceholder` | `string \| (message) => Promise<string>` | `'Message has been deleted'` | Text (or function) shown for a deleted message. |
| `automaticBackFriend` | `boolean` | `false` | Automatically create the reverse relationship when a request is accepted (if not already symmetric). |
| `maxGroupSize` | `number \| (() => Promise<number>)` | `10` | Maximum number of members in a group (creator + members). |
| `hooks` | `SocialNetworkHooks` | `{}` | Hooks called on events (see above). |

---

## Client

The package exposes a client plugin for Better Auth:

```typescript
import { socialNetworkClient } from "better-auth-social/client";
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [socialNetworkClient()],
});
```

Routes are then called via `authClient.fetch("/social/...", { method, body, query })` as in the examples above.

---

## Database schema

The plugin registers the tables: `friend_request`, `friend`, `chat`, `chat_message`, `group_chat`, `group_chat_member`, `group_chat_message`, `blocked_user`, `post`, `post_like`.

---

## License

MIT.
