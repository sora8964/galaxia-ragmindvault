import type { Express } from "express";
import { registerObjectRoutes } from "./api/objects";
import { registerObjectRelationshipRoutes } from "./api/objects/relationships";
import { registerObjectDownloadRoutes } from "./api/objects/download";
import { registerPdfUploadRoutes } from "./api/objects/pdf-upload";
import { registerWordUploadRoutes } from "./api/objects/word-upload";
import { registerConversationRoutes } from "./api/conversations";
import { registerMessageRoutes } from "./api/messages";
import { registerMentionRoutes } from "./api/mentions";
import { registerAIFunctionCallRoutes } from "./api/ai/function-call";
import { registerChatRoutes } from "./api/chat";
import { registerPdfExtractRoutes } from "./api/pdf/extract";
import { registerWordExtractRoutes } from "./api/word/extract";
import { registerEmbeddingRoutes } from "./api/embeddings";
import { registerSemanticSearchRoutes } from "./api/embeddings/semantic-search";
import { registerRelationshipRoutes } from "./api/relationships";
import { registerSettingsRoutes } from "./api/settings";
import { registerRechunkRoutes } from "./api/rechunk";
import { registerObjectTypeRoutes } from "./api/object-types";
import { registerHealthRoutes } from "./api/health";

export function registerAllRoutes(app: Express) {
  // Register all route modules
  registerObjectRoutes(app);
  registerObjectRelationshipRoutes(app);
  registerObjectDownloadRoutes(app);
  registerPdfUploadRoutes(app);
  registerWordUploadRoutes(app);
  registerConversationRoutes(app);
  registerMessageRoutes(app);
  registerMentionRoutes(app);
  registerAIFunctionCallRoutes(app);
  registerChatRoutes(app);
  registerPdfExtractRoutes(app);
  registerWordExtractRoutes(app);
  registerEmbeddingRoutes(app);
  registerSemanticSearchRoutes(app);
  registerRelationshipRoutes(app);
  registerSettingsRoutes(app);
  registerRechunkRoutes(app);
  registerObjectTypeRoutes(app);
  registerHealthRoutes(app);

  // Temporary aliases for migration compatibility (remove after frontend migration)
  app.get("/api/objects", (req, res, next) => { req.url = "/api/objects"; next(); });
  app.get("/api/objects/:id", (req, res, next) => { req.url = `/api/objects/${req.params.id}`; next(); });
  app.put("/api/objects/:id", (req, res, next) => { req.url = `/api/objects/${req.params.id}`; next(); });
  app.delete("/api/objects/:id", (req, res, next) => { req.url = `/api/objects/${req.params.id}`; next(); });
}
