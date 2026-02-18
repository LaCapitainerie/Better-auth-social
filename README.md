# Better Auth Social Network Plugin

Better-auth Plugin to add social network to your app, this include **friends, friends request, group chat, and private account**.

**75% Done.**
- [X] Friends
- [X] Friends Request
- [X] Chat
- [X] Group Chat
- [X] Private Account
- [X] Feed
- [ ] Post
- [ ] Commentary

## Installation

```bash
npm install better-auth-social
```

## Functionnalities

- ✅ **Friends** : List, Filter and Delete
- ✅ **Friend Requests** : Send, List (sent), List (received), Accept or Deny
- ✅ **Private Chat** : 1 to 1 Conversation with a Friend
- ✅ **GroupChat** : Create, Invite and Join
- ✅ **Messages** : Send Message in Chat or GroupChat, Delete, Quote

## Configuration

### Database Schema

Plugins automatically add thoses tables to your Database

- `friend_request` - Friends Request
- `friend` - Friends
- `chat` - Private Chat between 2 Friends / User (depends on config)
- `group_chat` - Group Chat
- `group_chat_member` - Group Chat Member
- `message` - Messages in Group Chat and Private Chat

### Setup

```typescript
import { socialNetwork } from "better-auth-social";
import { betterAuth } from "better-auth";

const auth = betterAuth({
  // ...config
  plugins: [
    socialNetwork({
      allowSelfFriendRequest: false, // Default: false
      maxGroupSize: 50, // (optionnal)
      // or an async function
      maxGroupSize: async () => {
        // Dynamically return the maximum size
        return 100;
      },
      hooks: {
        onFriendRequestSend: async (data) => {
          console.log("Friend request sent:", data);
        },
        onFriendRequestAccept: async (data) => {
          console.log("Friend request accepted:", data);
        },
        onGroupChatJoin: async (data) => {
          console.log("User joined group:", data);
        },
        // ... others hooks
      },
    }),
  ],
});
```

### Options

#### `allowSelfFriendRequest`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Allow Users to send friend request to themselves (usefull for testing)

#### `maxGroupSize`
- **Type**: `number | (() => Promise<number>)`
- **Default**: `10`
- **Description**: Maximum size of group chat, can be dynamically retrieved.

#### `allowMultipleChatWithSameFriend`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Allow creation of chat with the same friend.

#### `allowMultipleGroupChatWithSameFriends`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Allow creation of group chat with same friends.

#### `messageDeletionStatus`
- **Type**: `enum: CANT_DELETE, SENDER_ONLY_VISIBLE, VISIBLE`
- **Default**: `VISIBLE`
- **Description**: State the rule of message deleting.
  - **CANT_DELETE**: User can't delete their messages.
  - **SENDER_ONLY_VISIBLE**: Only the sender will see the deleted message.
  - **VISIBLE**: Everyone will see that a message has been deleted.
 
#### `deletedMessagePlaceholder`
- **Type**: `string | (() => Promise<string>)`
- **Default**: `Message has been deleted`
- **Description**: Placeholder shown over deleted messages.

#### `hooks`
- **Type**: `SocialNetworkHooks`
- **Description**: Social Network Event Hooks.

### Hooks Lists

Every Hooks are optionnal and can be called with async function :

- **`onFriendRequestSend`** : Called whenever a friend request is **sent**
  ```typescript
  onFriendRequestSend?: (data: { senderId: string; receiverId: string; requestId: string }) => Promise<void> | void;
  ```

- **`onFriendRequestAccept`** : Called whenever a friend request is **accepted**
  ```typescript
  onFriendRequestAccept?: (data: { senderId: string; receiverId: string; requestId: string }) => Promise<void> | void;
  ```

- **`onFriendRequestReject`** : Called whenever a friend request is **refused**
  ```typescript
  onFriendRequestReject?: (data: { senderId: string; receiverId: string; requestId: string }) => Promise<void> | void;
  ```

- **`onFriendRemove`** : Called whenever a friend is **remove**
  ```typescript
  onFriendRemove?: (data: { userId: string; friendId: string }) => Promise<void> | void;
  ```

- **`onChatCreate`** : Called whenever a chat is **created**
  ```typescript
  onChatCreate?: (data: { chatId: string; user1Id: string; user2Id: string }) => Promise<void> | void;
  ```

- **`onChatMessageSend`** : Called whenever a chat message is **sent**
  ```typescript
  onChatMessageSend?: (data: { messageId: string; chatId: string; senderId: string; content: string }) => Promise<void> | void;
  ```

- **`onGroupChatCreate`** : Called whenever a group chat is **created**
  ```typescript
  onGroupChatCreate?: (data: { groupChatId: string; createdById: string; name: string }) => Promise<void> | void;
  ```

- **`onGroupChatJoin`** : Called whenever a user **join** a group chat
  ```typescript
  onGroupChatJoin?: (data: { groupChatId: string; userId: string; addedBy?: string }) => Promise<void> | void;
  ```

- **`onGroupChatLeave`** : Called whenever a user **leave** a group chat
  ```typescript
  onGroupChatLeave?: (data: { groupChatId: string; userId: string; removedBy?: string }) => Promise<void> | void;
  ```

- **`onGroupChatMessageSend`** : Called whenever a message is **sent** in a group chat
  ```typescript
  onGroupChatMessageSend?: (data: { messageId: string; groupChatId: string; senderId: string; content: string }) => Promise<void> | void;
  ```

## API Routes

### Friends Requests

#### Send a Friend Request
```typescript
POST /api/auth/social/friend-request/send
Body: { receiverId: string }
```

#### Accept a Friend Request
```typescript
POST /api/auth/social/friend-request/accept
Body: { requestId: string }
```

#### Reject a Friend Request
```typescript
POST /api/auth/social/friend-request/reject
Body: { requestId: string }
```

#### List all Friend Request sent
```typescript
GET /api/auth/social/friend-request/sent/list
Response: { sent: FriendRequest[] }
```

#### List all Friend Request Received
```typescript
GET /api/auth/social/friend-request/received/list
Response: { received: FriendRequest[] }
```

### Friends

#### List Friends
```typescript
GET /api/auth/social/friends/list
Response: { friends: Friend[] }
```

#### Remove a Friend
```typescript
POST /api/auth/social/friends/remove
Body: { friendId: string }
```

#### Is user a Friend
```typescript
GET /api/auth/social/friends/isfriend
Response: { isFriend: boolean }
```

### Chat

#### Create a chat
```typescript
POST /api/auth/social/chat/create
Body: { friendId: string }
Response: { chat: Chat }
```

#### List all chats
```typescript
GET /api/auth/social/chat/list
Response: { chats: Chat[] }
```

#### Get Messages From a Chat
```typescript
GET /api/auth/social/chat/messages?chatId=xxx
Params {
  chatId: string
  page: number
  limit: number
}
Response: { messages: Message[] }
```

#### Send Message in a Chat
```typescript
POST /api/auth/social/chat/send-message
Body: { chatId: string, content: string }
Response: { message: Message }
```

### Group Chat

#### Create a Group Chat
```typescript
POST /api/auth/social/group-chat/create
Body: { 
  name: string, 
  description?: string, 
  memberIds?: string[] 
}
Response: { groupChat: GroupChat }
```

#### List all Group Chat
```typescript
GET /api/auth/social/group-chat/list
Response: { groupChats: GroupChat[] }
```

#### Add Member to Group Chat
```typescript
POST /api/auth/social/group-chat/add-member
Body: { groupChatId: string, userId: string }
```

#### Remove Member from a Group Chat
```typescript
POST /api/auth/social/group-chat/remove-member
Body: { groupChatId: string, userId: string }
```

#### Get Messages From a Group Chat
```typescript
GET /api/auth/social/group-chat/messages?groupChatId=xxx
Response: { messages: Message[] }
```

#### Send a Message in a Group Chat
```typescript
POST /api/auth/social/group-chat/send-message
Body: { groupChatId: string, content: string }
Response: { message: Message }
```

## Types TypeScript

```typescript
export type FriendRequest = {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export type Friend = {
  id: string;
  userId: string;
  friendId: string;
  createdAt: Date;
}

export type Chat = {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type GroupChat = {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Message = {
  id: string;
  content: string;
  senderId: string;
  chatId: string | null;
  groupChatId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

## Exemple

```typescript
// auth.ts
import { socialNetwork } from "better-auth-social";
import { betterAuth } from "better-auth";

const auth = betterAuth({
  database: {
    // your adapter
  },
  plugins: [
    socialNetwork({
      allowSelfFriendRequest: false,
    }),
  ],
});

// auth-client.ts
import { socialNetworkClient } from "better-auth-social/client";
import { createAuthClient } from "better-auth/client";

const client = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [socialNetworkClient()],
});



// Send a Friend Request
await client.fetch("/social/friend-request/send", {
  method: "POST",
  body: { receiverId: "user-id" },
});

// Accept it
await client.fetch("/social/friend-request/accept", {
  method: "POST",
  body: { requestId: "request-id" },
});

// Make a Chat with the new Friend
const { chat } = await client.fetch("/social/chat/create", {
  method: "POST",
  body: { friendId: "friend-id" },
});

// Send a Message in the Chat
await client.fetch("/social/chat/send-message", {
  method: "POST",
  body: { chatId: chat.id, content: "Hello!" },
});
```
