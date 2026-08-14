import { Router, type IRouter } from "express";
import {
  analysisReportSchema,
  buildPublishStatus,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/analysis/publish", (req, res) => {
  const parsed = analysisReportSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid analysis report",
      details: parsed.error.flatten(),
    });
  }

  const status = buildPublishStatus(parsed.data, {
    txHash: parsed.data.provenance?.chainRecord.txHash,
    explorerUrl: parsed.data.provenance?.chainRecord.explorerUrl,
    publishedAt: parsed.data.provenance?.chainRecord.publishedAt,
  });

  return res.json({
    ...status,
    nextAction:
      status.status === "published"
        ? "Track the confirmed transaction on the explorer."
        : "Send the payload through the testnet wallet flow to broadcast the transaction.",
  });
});

export default router;
