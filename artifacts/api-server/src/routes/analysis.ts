import { Router, type IRouter } from "express";
import {
  analysisRequestSchema,
  buildAnalysisProvenance,
} from "@workspace/api-zod";
import { createAnalysisEngine } from "../services/analysis-engine";
import { parseWithValidation } from "../lib/validation";

const router: IRouter = Router();
const engine = createAnalysisEngine();

router.post("/analysis/screen", async (req, res) => {
  const parsed = parseWithValidation(
    analysisRequestSchema,
    req.body,
    res,
    "Invalid analysis request",
  );

  if (!parsed.success) {
    return;
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
