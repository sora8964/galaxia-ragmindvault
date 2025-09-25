import type { Express } from "express";

export function registerAIFunctionCallRoutes(app: Express) {
  // POST /api/ai/function-call/:functionName - Direct Function Calling endpoint for testing
  app.post("/api/ai/function-call/:functionName", async (req, res) => {
    try {
      const { functionName } = req.params;
      const args = req.body;

      // Validate function name
      const validFunctions = [
        'searchObjects', // Now includes semantic search with pagination
        'getObjectDetails', 
        'createObject',
        'updateObject',
        'findSimilarObjects',
        'parseMentions',
        'findRelevantExcerpts'
      ];

      if (!validFunctions.includes(functionName)) {
        return res.status(400).json({ 
          error: `Invalid function name. Available functions: ${validFunctions.join(', ')}` 
        });
      }

      // Import callFunction dynamically
      const { callFunction } = await import('../../../functions');

      // Call the function directly
      const result = await callFunction(functionName, args);
      
      // Return the result as plain text
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(result);
    } catch (error) {
      console.error(`Function call error (${req.params.functionName}):`, error);
      
      // Make sure we send a proper error response
      if (!res.headersSent) {
        res.status(500).json({ 
          error: `Function call failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      }
    }
  });
}
