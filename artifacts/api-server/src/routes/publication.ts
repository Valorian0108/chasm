import { Router, type IRouter } from "express";
import {
  analysisReportSchema,
  buildXLayerPublication,
} from "@workspace/api-zod";
import { rateLimit } from "../lib/security";

const router: IRouter = Router();

router.post("/analysis/publish-prep", rateLimit({ windowMs: 60_000, max: 30 }), (req, res) => {
  const parsed = analysisReportSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid analysis report",
      details: parsed.error.flatten(),
    });
  }

  const payload = buildXLayerPublication(parsed.data);

  return res.json({
    status: "ready",
    payload,
  });
});

export default router;
