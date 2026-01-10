import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
// Increase limits for large multi-slice CT uploads (600+ MB ZIP files with 1000+ DICOM slices)
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: false, limit: '1gb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log("[startup] Initializing server...");
  console.log(`[startup] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`[startup] OPENAI_API_KEY configured: ${!!process.env.OPENAI_API_KEY}`);
  console.log(`[startup] DATABASE_URL configured: ${!!process.env.DATABASE_URL}`);
  
  // Health check endpoint for Cloud Run - must be registered BEFORE all other routes
  app.get('/health', (_req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      hasApiKey: !!process.env.OPENAI_API_KEY,
      hasDatabase: !!process.env.DATABASE_URL
    });
  });
  
  const server = await registerRoutes(app);
  console.log("[startup] Routes registered successfully");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error("[error] Request error:", { status, message, stack: err.stack });
    res.status(status).json({ message });
  });

  // Setup Vite in development or serve static files in production
  // Use NODE_ENV directly instead of app.get("env") for Cloud Run compatibility
  const isDevelopment = process.env.NODE_ENV === "development";
  
  try {
    if (isDevelopment) {
      console.log("[startup] Setting up Vite in development mode...");
      await setupVite(app, server);
      console.log("[startup] Vite setup completed");
    } else {
      console.log("[startup] Serving static files in production mode...");
      serveStatic(app);
      console.log("[startup] Static file serving setup completed");
    }
  } catch (viteError) {
    console.error("[startup] Vite/static setup error:", viteError);
    // Continue with server startup - don't crash
    console.log("[startup] Continuing with server startup...");
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Cloud Run auto-configures PORT. Default to 5000 for local development.
  const port = parseInt(process.env.PORT || '5000', 10);
  console.log(`[startup] Environment variables:`, {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    REPLIT_DEPLOYMENT: process.env.REPLIT_DEPLOYMENT,
    parsedPort: port
  });
  
  console.log(`[startup] Attempting to start server on port ${port}...`);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, (err?: Error) => {
    if (err) {
      console.error(`[startup] ❌ Failed to start server on port ${port}:`, err);
      console.error(`[startup] Error details:`, {
        message: err.message,
        code: (err as any).code,
        stack: err.stack
      });
      // Don't exit - let Cloud Run handle retries
      return;
    }
    console.log(`[startup] ✅ Server successfully started and listening on port ${port}`);
    console.log(`[startup] Server bound to 0.0.0.0:${port} - ready to accept connections`);
    log(`serving on port ${port}`);
  });

  // Timeout for large CT scan uploads - 10 minutes (Cloud Run compatible)
  server.timeout = 600000; // 10 minutes
  server.keepAliveTimeout = 610000; // 10 minutes + 10s
  server.headersTimeout = 620000; // 10 minutes + 20s

  // Log server errors but don't exit - let Cloud Run handle retries
  server.on('error', (error: any) => {
    console.error("[startup] Server error:", error);
    if (error.code === 'EADDRINUSE') {
      console.error(`[startup] Port ${port} is already in use - Cloud Run will retry`);
    }
    // Don't call process.exit(1) - let Cloud Run manage the lifecycle
  });
})();
