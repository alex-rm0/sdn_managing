import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./lib/session";

const app: Express = express();

// Railway (and most PaaS hosts) terminate TLS at an edge proxy and forward
// plain HTTP to the container, so Express sees every request as insecure
// unless it's told to trust the proxy's X-Forwarded-Proto header. Without
// this, express-session silently drops the Set-Cookie header whenever the
// cookie is configured with `secure: true` (i.e. in production).
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/api/uploads", express.static(uploadsDir));

app.use("/api", router);

// Serve the built frontend (artifacts/sdn-app/dist/public) so a single
// service can host both the API and the web app. Only registered when that
// build actually exists, so local dev (frontend served separately by Vite)
// is unaffected.
const frontendDist = path.resolve(import.meta.dirname, "../../sdn-app/dist/public");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // Express 5's router (path-to-regexp v8) rejects a bare "*" path pattern,
  // so the SPA fallback is plain middleware instead of a routed GET "*".
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) { next(); return; }
    res.sendFile("index.html", { root: frontendDist });
  });
}

export default app;
