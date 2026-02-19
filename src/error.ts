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

  NOT_FRIEND = 'Users are not friends',

  NOT_FRIENDS = 'Users must be friends to create a chat',
  ALREADY_EXISTS = 'Chat already exists',
  TOO_LARGE = 'Group cannot be larger than {maxSize} members',
  MAX_SIZE_REACHED = 'Group has reached maximum size of {maxSize} members',
  ALREADY_MEMBER = 'User is already a member of this group',
};

export const errorMessageToCode = (message: string) => message.replace(/ /g, '_').toUpperCase();