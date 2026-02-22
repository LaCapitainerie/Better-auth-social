import type { BetterAuthPluginDBSchema } from "better-auth";

export const getSchema = () => {
  return {
    user: {
      fields: {},
    },
    friend_request: {
      fields: {
        senderId: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "user",
            field: "id",
          },
        },
        receiverId: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "user",
            field: "id",
          },
        },
        status: {
          type: "string",
          required: true,
          defaultValue: "pending",
          returned: true,
        },
        createdAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
        updatedAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
      },
    },
    friend: {
      fields: {
        userId: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "user",
            field: "id",
          },
        },
        friendId: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "user",
            field: "id",
          },
        },
        createdAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
      },
    },
    chat: {
      fields: {
        user1Id: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "user",
            field: "id",
          },
        },
        user2Id: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "user",
            field: "id",
          },
        },
        createdAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
        updatedAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
      },
    },
    chat_message: {
      fields: {
        content: {
          type: "string",
          required: true,
          returned: true,
        },
        senderId: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "user",
            field: "id",
          },
        },
        chatId: {
          type: "string",
          required: false,
          defaultValue: null,
          returned: true,
          references: {
            model: "chat",
            field: "id",
          },
        },
        deletedAt: {
          type: "date",
          required: false,
          defaultValue: null,
          returned: true,
        },
        createdAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
        updatedAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
      },
      
    },
    group_chat: {
      fields: {
        name: {
          type: "string",
          required: true,
          returned: true,
        },
        description: {
          type: "string",
          required: false,
          defaultValue: null,
          returned: true,
        },
        createdById: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "user",
            field: "id",
          },
        },
        /* membersIds: {
          type: "string[]",
          required: true,
          returned: true,
          references: {
            model: "user",
            field: "id",
          },
        }, */
        createdAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
        updatedAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
      },
    },
    group_chat_member: {
      fields: {
        groupChatId: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "group_chat",
            field: "id",
          },
        },
        userId: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "user",
            field: "id",
          },
        },
        role: {
          type: "string",
          required: true,
          defaultValue: "member",
          returned: true,
        },
        joinedAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
      },
    },
    group_chat_message: {
      fields: {
        content: {
          type: "string",
          required: true,
          returned: true,
        },
        senderId: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "user",
            field: "id",
          },
        },
        groupChatId: {
          type: "string",
          required: true,
          returned: true,
          references: {
            model: "group_chat",
            field: "id",
          },
        },
        deletedAt: {
          type: "date",
          required: false,
          defaultValue: null,
          returned: true,
        },
        createdAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
        updatedAt: {
          type: "date",
          required: true,
          defaultValue: "now",
          returned: true,
        },
      },
    },
  } satisfies BetterAuthPluginDBSchema;
};
