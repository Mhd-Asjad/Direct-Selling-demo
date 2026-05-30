import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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

app.use(
  cors({
    origin: [
      "https://direct-selling-demo.vercel.app",
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ],
    credentials: true,
  }),
);
app.use(
  express.json({
    limit: "50mb",
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const sessionSecret = process.env.SESSION_SECRET ?? "mlm-dev-secret-change-in-prod";

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  }),
);

app.use("/api", router);

export default app;
