import type { Express } from "express";

export function registerHealthRoutes(app: Express) {
  // GET /api/health - Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
}
