import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { HttpError, toHttpError } from "./lib/http-error";

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
});

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  const httpError = toHttpError(error);
  const log = req.log ?? logger;

  log.error(
    { err: error instanceof HttpError ? (error.cause ?? error) : error },
    httpError.message,
  );

  if (res.headersSent) {
    return next(error);
  }

  return res.status(httpError.status).json({
    error: httpError.message,
  });
});

export default app;
