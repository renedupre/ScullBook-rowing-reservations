import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import cookieParser from "cookie-parser";

const app: Express = express();
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
app.use(cors({ origin: false }));
app.use(cookieParser());
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin")) {
    try {
      if (new URL(req.get("origin")!).host !== req.get("host")) {
        res.status(403).json({ error: "Requests must come from this application." }); return;
      }
    } catch { res.status(403).json({ error: "Invalid request origin." }); return; }
  }
  next();
});

app.use("/api", router);
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const error = err as { code?: string; cause?: { code?: string }; type?: string };
  const code = error.code ?? error.cause?.code;
  if (code === "23505") { res.status(409).json({ error: "This name, account, or boat/date assignment already exists, or the seat is already booked." }); return; }
  if (code === "23503") { res.status(409).json({ error: "This record is still in use. Remove its scheduled sessions or reservations first." }); return; }
  if (error.type === "entity.parse.failed") { res.status(400).json({ error: "Invalid request data." }); return; }
  req.log.error({ err }, "Request failed");
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
