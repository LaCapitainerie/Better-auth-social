export enum ERROR_MESSAGES {
  UNAUTHORIZED = 'You must be logged in',
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'Resource not found',
  FORBIDDEN = 'You are not allowed to access this resource',
  INTERNAL_SERVER_ERROR = 'An unexpected error occurred',

  SELF_REQUEST_NOT_ALLOWED = 'You cannot send a friend request to yourself',
  ALREADY_FRIENDS = 'User is already a friend',
  ALREADY_SENT = 'Friend request already sent',
  NOT_PENDING = 'Friend request not pending',

  FAILED_TO_UPDATE = 'Failed to update friend request',

  NOT_FRIEND = 'You are not friends with this user',

  NOT_FRIENDS = 'Users must be friends to create a chat',
  ALREADY_EXISTS = 'Chat already exists',
  TOO_LARGE = 'Group cannot be larger than maximumGroupSize option value',
  MAX_SIZE_REACHED = 'Group has reached maximum size of maximumGroupSize option value',
  ALREADY_MEMBER = 'User is already a member of this group',

  MULTIPLE_GROUP_CHAT_WITH_SAME_PERSON = 'You cannot create multiple group chats with the same person',

  ALREADY_BLOCKED = 'User is already blocked',
  SELF_BLOCK_NOT_ALLOWED = 'You cannot block yourself',

  ALREADY_LIKED = 'Post already liked',
};

export const errorMessageToCode = (message: string) => message.replace(/ /g, '_').toUpperCase();