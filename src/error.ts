export const ERROR_CODES = {
  UNAUTHORIZED: 'You must be logged in',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'Resource not found',
  FORBIDDEN: 'You are not allowed to access this resource',
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred',

  FRIEND_REQUEST: {
    SELF_REQUEST_NOT_ALLOWED: 'You cannot send a friend request to yourself',
    ALREADY_FRIENDS: 'Users are already friends',
    ALREADY_SENT: 'Friend request already sent',
    NOT_FOUND: 'Friend request not found',
    NOT_PENDING: 'Friend request not pending',

    FAILED_TO_UPDATE: 'Failed to update friend request',
  },

  FRIEND: {
    NOT_FOUND: 'Friend not found',
    NOT_FRIEND: 'Users are not friends',
  },

  CHAT: {
    NOT_FRIENDS: 'Users must be friends to create a chat',
    ALREADY_EXISTS: 'Chat already exists',
  },

  GROUP_CHAT: {
    TOO_LARGE: 'Group cannot be larger than {maxSize} members',
    MAX_SIZE_REACHED: 'Group has reached maximum size of {maxSize} members',
    ALREADY_MEMBER: 'User is already a member of this group',
  }
} as const;