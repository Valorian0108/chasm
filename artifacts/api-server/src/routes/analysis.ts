import { Router, type IRouter } from "express";
import {
  analysisRequestSchema,
  buildAnalysisProvenance,
} from "@workspace/api-zod";
import { createAnalysisEngine } from "../services/analysis-engine";

const router: IRouter = Router();
const engine = createAnalysisEngine();

router.post("/analysis/screen", async (req, res) => {
  const parsed = analysisRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid analysis request",
      details: parsed.error.flatten(),
    });
  }

  const result = await engine.analyze(parsed.data);
  const provenance = await buildAnalysisProvenance(parsed.data, result.report, {
    provider: result.provider,
  });

  const enrichedReport = {
    ...result.report,
    provenance,
  };

  return res.json({
    ...enrichedReport,
    provenance: {
      ...provenance,
      hashes: {
        ...provenance.hashes,
        report: provenance.hashes.report,
      },
      chainRecord: {
        ...provenance.chainRecord,
      },
    },
  });
});

export default router;
