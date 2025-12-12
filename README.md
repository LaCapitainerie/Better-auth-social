# Better Auth Social Network Plugin

Un plugin Better Auth pour les réseaux sociaux qui permet la gestion des amis, des demandes d'amis, des chats privés et des groupes de chat.

## Installation

```bash
npm install better-auth-social
```

## Fonctionnalités

- ✅ **Gestion des amis** : Envoyer, accepter, refuser et supprimer des amis
- ✅ **Demandes d'amis** : Système complet de demandes d'amis avec statuts
- ✅ **Chats privés** : Conversations en tête-à-tête entre amis
- ✅ **Groupes de chat** : Créer et gérer des groupes de discussion avec plusieurs membres
- ✅ **Messages** : Envoyer et recevoir des messages dans les chats et groupes

## Configuration

### Schéma de base de données

Le plugin ajoute automatiquement les tables suivantes à votre schéma Better Auth :

- `friend_request` - Demandes d'amis
- `friend` - Relations d'amitié
- `chat` - Chats privés entre deux utilisateurs
- `group_chat` - Groupes de chat
- `group_chat_member` - Membres des groupes
- `message` - Messages dans les chats et groupes

### Setup

```typescript
import { socialNetwork } from "better-auth-social";
import { betterAuth } from "better-auth";

const auth = betterAuth({
  // ... votre configuration
  plugins: [
    socialNetwork({
      allowSelfFriendRequest: false, // Par défaut: false
    }),
  ],
});
```

## API Routes

### Demandes d'amis

#### Envoyer une demande d'ami
```typescript
POST /api/auth/social/friend-request/send
Body: { receiverId: string }
```

#### Accepter une demande d'ami
```typescript
POST /api/auth/social/friend-request/accept
Body: { requestId: string }
```

#### Refuser une demande d'ami
```typescript
POST /api/auth/social/friend-request/reject
Body: { requestId: string }
```

#### Lister les demandes d'amis
```typescript
GET /api/auth/social/friend-request/list
Response: { sent: FriendRequest[], received: FriendRequest[] }
```

### Amis

#### Lister les amis
```typescript
GET /api/auth/social/friends/list
Response: { friends: Friend[] }
```

#### Supprimer un ami
```typescript
POST /api/auth/social/friends/remove
Body: { friendId: string }
```

### Chats privés

#### Créer un chat
```typescript
POST /api/auth/social/chat/create
Body: { friendId: string }
Response: { chat: Chat }
```

#### Lister les chats
```typescript
GET /api/auth/social/chat/list
Response: { chats: Chat[] }
```

#### Obtenir les messages d'un chat
```typescript
GET /api/auth/social/chat/messages?chatId=xxx
Response: { messages: Message[] }
```

#### Envoyer un message dans un chat
```typescript
POST /api/auth/social/chat/send-message
Body: { chatId: string, content: string }
Response: { message: Message }
```

### Groupes de chat

#### Créer un groupe
```typescript
POST /api/auth/social/group-chat/create
Body: { 
  name: string, 
  description?: string, 
  memberIds?: string[] 
}
Response: { groupChat: GroupChat }
```

#### Lister les groupes
```typescript
GET /api/auth/social/group-chat/list
Response: { groupChats: GroupChat[] }
```

#### Ajouter un membre
```typescript
POST /api/auth/social/group-chat/add-member
Body: { groupChatId: string, userId: string }
```

#### Retirer un membre
```typescript
POST /api/auth/social/group-chat/remove-member
Body: { groupChatId: string, userId: string }
```

#### Obtenir les messages d'un groupe
```typescript
GET /api/auth/social/group-chat/messages?groupChatId=xxx
Response: { messages: Message[] }
```

#### Envoyer un message dans un groupe
```typescript
POST /api/auth/social/group-chat/send-message
Body: { groupChatId: string, content: string }
Response: { message: Message }
```

## Types TypeScript

```typescript
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

export interface Message {
  id: string;
  content: string;
  senderId: string;
  chatId: string | null;
  groupChatId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

## Exemple d'utilisation

```typescript
import { socialNetwork } from "better-auth-social";
import { betterAuth } from "better-auth";

const auth = betterAuth({
  database: {
    // votre adaptateur de base de données
  },
  plugins: [
    socialNetwork({
      allowSelfFriendRequest: false,
    }),
  ],
});

// Utilisation côté client
import { socialNetworkClient } from "better-auth-social/client";
import { createAuthClient } from "better-auth/client";

const client = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [socialNetworkClient()],
});

// Envoyer une demande d'ami
await client.fetch("/social/friend-request/send", {
  method: "POST",
  body: { receiverId: "user-id" },
});

// Accepter une demande
await client.fetch("/social/friend-request/accept", {
  method: "POST",
  body: { requestId: "request-id" },
});

// Créer un chat
const { chat } = await client.fetch("/social/chat/create", {
  method: "POST",
  body: { friendId: "friend-id" },
});

// Envoyer un message
await client.fetch("/social/chat/send-message", {
  method: "POST",
  body: { chatId: chat.id, content: "Hello!" },
});
```

## Licence

MIT
