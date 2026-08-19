import { Router, type IRouter } from "express";
import {
  analysisReportSchema,
  buildXLayerPublication,
} from "@workspace/api-zod";
import { parseWithValidation } from "../lib/validation";

const router: IRouter = Router();

router.post("/analysis/publish-prep", (req, res) => {
  const parsed = parseWithValidation(
    analysisReportSchema,
    req.body,
    res,
    "Invalid analysis report",
  );

  if (!parsed.success) {
    return;
  }

  const payload = buildXLayerPublication(parsed.data);

  return res.json({
    status: "ready",
    payload,
  });
});

export default router;
