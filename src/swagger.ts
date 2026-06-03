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
    { name: "Approval Submissions" },
    { name: "Webhooks" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
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
      ApprovalSubmission: {
        type: "object",
        properties: {
          id: { type: "integer" },
          category: { type: "string", nullable: true },
          contextType: { type: "string" },
          contextId: { type: "integer" },
          status: { type: "string" },
          requestedBy: { type: "integer" },
          requestedAt: { type: "string" },
          requestNote: { type: "string", nullable: true },
          requestPayload: { type: "string", nullable: true },
          reviewedBy: { type: "integer", nullable: true },
          reviewedAt: { type: "string", nullable: true },
          reviewNote: { type: "string", nullable: true },
        },
      },
      ApprovalSubmissionItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          submissionId: { type: "integer" },
          itemType: { type: "string" },
          itemId: { type: "integer" },
          itemSnapshot: { type: "string", nullable: true },
          status: { type: "string" },
          decidedAt: { type: "string", nullable: true },
          itemNote: { type: "string", nullable: true },
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
    "/approval-submissions": {
      get: {
        summary: "List all approval submissions (Reno only)",
        tags: ["Approval Submissions"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["PENDING", "APPROVED", "REJECTED", "PARTIALLY_APPROVED", "CANCELLED"],
            },
          },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "requested_by", in: "query", schema: { type: "integer" } },
          {
            name: "page",
            in: "query",
            schema: { type: "integer" },
            description: "Optional. Use together with per_page; omit both to return all results.",
          },
          {
            name: "per_page",
            in: "query",
            schema: { type: "integer", maximum: 100 },
            description: "Optional. Use together with page; omit both to return all results.",
          },
        ],
        responses: {
          200: { description: "List with nested items" },
          400: { description: "Invalid query params" },
          403: { description: "Forbidden" },
        },
      },
      post: {
        summary: "Create approval submission",
        tags: ["Approval Submissions"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["contextType", "contextId"],
                properties: {
                  contextType: { type: "string" },
                  contextId: { type: "integer" },
                  category: { type: "string" },
                  requestNote: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["itemType", "itemId"],
                      properties: {
                        itemType: { type: "string" },
                        itemId: { type: "integer" },
                        itemSnapshot: { type: "object" },
                        itemNote: { type: "string" },
                      },
                    },
                  },
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
          403: { description: "Unauthorized" },
        },
      },
    },
    "/approval-submissions/mine": {
      get: {
        summary: "List approval submissions requested by the current user",
        tags: ["Approval Submissions"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["PENDING", "APPROVED", "REJECTED", "PARTIALLY_APPROVED", "CANCELLED"],
            },
          },
          { name: "category", in: "query", schema: { type: "string" } },
          {
            name: "page",
            in: "query",
            schema: { type: "integer" },
            description: "Optional. Use together with per_page; omit both to return all results.",
          },
          {
            name: "per_page",
            in: "query",
            schema: { type: "integer", maximum: 100 },
            description: "Optional. Use together with page; omit both to return all results.",
          },
        ],
        responses: {
          200: { description: "List with nested items" },
          400: { description: "Invalid query params" },
          403: { description: "Unauthorized" },
        },
      },
    },
    "/approval-submissions/{id}/status": {
      patch: {
        summary: "Update approval submission status",
        tags: ["Approval Submissions"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["APPROVED", "PARTIALLY_APPROVED", "REJECTED", "CANCELLED"],
                  },
                  reviewNote: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated" },
          403: { description: "Forbidden" },
          404: { description: "Not found" },
        },
      },
    },
    "/approval-submissions/{id}/approve-all": {
      post: {
        summary: "Approve all items and the submission",
        tags: ["Approval Submissions"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  reviewNote: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "All items and submission approved" },
          403: { description: "Forbidden" },
          404: { description: "Not found" },
        },
      },
    },
    "/approval-submissions/{id}/reject-all": {
      post: {
        summary: "Reject all items and the submission",
        tags: ["Approval Submissions"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  reviewNote: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "All items and submission rejected" },
          403: { description: "Forbidden" },
          404: { description: "Not found" },
        },
      },
    },
    "/approval-submissions/items/{itemId}/status": {
      patch: {
        summary: "Update approval submission item status",
        tags: ["Approval Submissions"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "itemId", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["APPROVED", "REJECTED"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated" },
          403: { description: "Forbidden" },
          404: { description: "Not found" },
        },
      },
    },
    "/approval-submissions/{submissionId}/items": {
      post: {
        summary: "Add item to approval submission",
        tags: ["Approval Submissions"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "submissionId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["itemType", "itemId"],
                properties: {
                  itemType: { type: "string" },
                  itemId: { type: "integer" },
                  itemSnapshot: { type: "object" },
                  itemNote: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Created" },
          403: { description: "Forbidden" },
          404: { description: "Not found" },
        },
      },
    },
    "/webhooks/lean": {
      post: {
        summary: "Lean webhook (HMAC verified)",
        tags: ["Webhooks"],
        parameters: [
          {
            name: "lean-signature",
            in: "header",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/octet-stream": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        responses: {
          200: { description: "OK" },
          401: { description: "Invalid signature" },
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
