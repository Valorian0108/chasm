import type { CorsOptions } from "cors";
import type { RequestHandler } from "express";
import { loadEnvFiles } from "./load-env";
import { logger } from "./logger";

loadEnvFiles();

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
];

const isProduction = process.env.NODE_ENV === "production";

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const allowedOrigins: string[] = (() => {
  const configured = parseList(process.env["CORS_ALLOWED_ORIGINS"]);

  if (configured.length > 0) {
    return configured;
  }

  if (isProduction) {
    return [];
  }

  return DEFAULT_DEV_ORIGINS;
})();

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Same-origin and non-browser clients send no Origin header.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: false,
  methods: ["GET", "POST", "OPTIONS"],
  maxAge: 600,
};

const apiAuthToken = process.env["API_AUTH_TOKEN"]?.trim();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

/**
 * Guards state-changing endpoints with a bearer token. Fails closed in
 * production when no token is configured.
 */
export const requireApiToken: RequestHandler = (req, res, next) => {
  if (!apiAuthToken) {
    if (isProduction) {
      logger.error(
        "API_AUTH_TOKEN is not set; refusing write requests in production",
      );
      return res.status(503).json({ error: "Write endpoints are not configured" });
    }

    return next();
  }

  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token || !timingSafeEqual(token, apiAuthToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
};

export type RateLimitOptions = {
  windowMs: number;
  max: number;
};

/** Minimal in-memory fixed-window limiter, keyed by client IP. */
export function rateLimit({ windowMs, max }: RateLimitOptions): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else if (entry.count >= max) {
      res.setHeader("retry-after", Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: "Too many requests" });
    } else {
      entry.count += 1;
    }

    if (hits.size > 10_000) {
      for (const [candidate, value] of hits) {
        if (value.resetAt <= now) {
          hits.delete(candidate);
        }
      }
    }

    return next();
  };
}
