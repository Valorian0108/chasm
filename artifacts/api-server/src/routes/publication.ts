import { Router, type IRouter } from "express";
import {
  analysisReportSchema,
  buildXLayerPublication,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/analysis/publish-prep", (req, res) => {
  const parsed = analysisReportSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid analysis report",
      details: parsed.error.flatten(),
    });
  }

  if (!parsed.data.provenance) {
    return res.status(400).json({
      error: "Report provenance is required to build a publication payload",
    });
  }

  const payload = buildXLayerPublication(parsed.data);

  return res.json({
    status: "ready",
    payload,
  });
});

export default router;
