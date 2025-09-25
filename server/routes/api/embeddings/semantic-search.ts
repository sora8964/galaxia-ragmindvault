import type { Express } from "express";

export function registerSemanticSearchRoutes(app: Express) {
  // POST /api/semantic-search - Semantic search endpoint using searchObjects function
  app.post("/api/semantic-search", async (req, res) => {
    try {
      const { query, type, page = 1, pageSize = 20 } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query text is required" });
      }
      
      console.log(`🔍 [DEBUG] Semantic search (UserPrompt compatible) with query: "${query}", type: ${type}, page: ${page}, pageSize: ${pageSize}`);
      
      // Import and call searchObjects function via callFunction
      const { callFunction } = await import('../../../functions');
      const result = await callFunction('searchObjects', {
        query,
        type: type === "all" ? undefined : type,
        page,
        pageSize
      });
      
      // Parse the JSON string result from the function
      const parsedResult = JSON.parse(result);
      console.log(`🔍 [DEBUG] searchObjects returned ${parsedResult.results?.length || 0} results`);
      
      res.json(parsedResult);
    } catch (error) {
      console.error('Semantic search error:', error);
      res.status(500).json({ error: "Failed to perform semantic search" });
    }
  });
}
