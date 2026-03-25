import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Reno Backend API",
    version: "1.0.0",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Conversation" },
    { name: "Messages" },
  ],
  components: {
    schemas: {
      ApiError: {
        type: "object",
        properties: {
          message: { type: "string" },
          details: { type: "object", nullable: true },
        },
      },
      ApiResponse: {
        type: "object",
        properties: {
          error: { oneOf: [{ $ref: "#/components/schemas/ApiError" }, { type: "null" }] },
          data: { nullable: true },
        },
        required: ["error", "data"],
      },
      Conversation: {
        type: "object",
        properties: {
          id: { type: "integer" },
          entityType: { type: "string", nullable: true },
          entityId: { type: "string", nullable: true },
          parentConversationId: { type: "integer", nullable: true },
          members: { type: "array", items: {} },
          createdBy: { type: "string" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: { type: "integer" },
          conversationId: { type: "integer" },
          userId: { type: "string" },
          body: { type: "string" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/conversation/health": {
      get: {
        summary: "Health check",
        tags: ["Conversation"],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiResponse" },
              },
            },
          },
        },
      },
    },
    "/conversation": {
      get: {
        summary: "List conversations",
        tags: ["Conversation"],
        parameters: [
          { name: "entityType", in: "query", schema: { type: "string" } },
          { name: "user_id", in: "query", schema: { type: "string" } },
          { name: "entityId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiResponse" },
              },
            },
          },
        },
      },
      post: {
        summary: "Create conversation",
        tags: ["Conversation"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["createdBy"],
                properties: {
                  entityType: { type: "string", nullable: true },
                  entityId: { type: "string", nullable: true },
                  parentConversationId: { type: "integer", nullable: true },
                  members: { type: "array", items: {} },
                  createdBy: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiResponse" },
              },
            },
          },
        },
      },
    },
    "/conversation/{id}": {
      get: {
        summary: "Get conversation",
        tags: ["Conversation"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "OK" },
          404: { description: "Not found" },
        },
      },
      patch: {
        summary: "Update conversation",
        tags: ["Conversation"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  entityType: { type: "string", nullable: true },
                  entityId: { type: "string", nullable: true },
                  parentConversationId: { type: "integer", nullable: true },
                  members: { type: "array", items: {} },
                  createdBy: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
          404: { description: "Not found" },
        },
      },
      delete: {
        summary: "Delete conversation",
        tags: ["Conversation"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Deleted" },
          404: { description: "Not found" },
        },
      },
    },
    "/conversation/{id}/join": {
      post: {
        summary: "Join conversation",
        tags: ["Conversation"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId"],
                properties: { userId: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
          404: { description: "Not found" },
        },
      },
    },
    "/conversation/{id}/leave": {
      post: {
        summary: "Leave conversation",
        tags: ["Conversation"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId"],
                properties: { userId: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
          404: { description: "Not found" },
        },
      },
    },
    "/conversation/{id}/read": {
      post: {
        summary: "Mark conversation as read",
        tags: ["Conversation"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username"],
                properties: { username: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
          404: { description: "Not found" },
        },
      },
    },
    "/messages": {
      get: {
        summary: "List messages",
        tags: ["Messages"],
        parameters: [
          { name: "conversation", in: "query", schema: { type: "integer" } },
          { name: "user", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: { description: "OK" },
        },
      },
      post: {
        summary: "Create message",
        tags: ["Messages"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["conversationId", "userId", "body"],
                properties: {
                  conversationId: { type: "integer" },
                  userId: { type: "string" },
                  body: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Created" },
        },
      },
    },
  },
};

const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: [],
});

export default swaggerSpec;
