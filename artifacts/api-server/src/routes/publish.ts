import { Router, type IRouter } from "express";
import {
  analysisReportSchema,
  publishReceiptSchema,
} from "@workspace/api-zod";
import { xLayerPublisher } from "../services/xlayer-publisher";

const router: IRouter = Router();

router.post("/analysis/publish", (req, res) => {
  const parsed = analysisReportSchema.safeParse(req.body?.report ?? req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid analysis report",
      details: parsed.error.flatten(),
    });
  }

  const receiptSource = req.body?.receipt ?? req.body?.publishReceipt;
  const receiptPayload =
    receiptSource ??
    (req.body?.txHash
      ? {
          txHash: req.body.txHash,
          explorerUrl: req.body.explorerUrl,
          publishedAt: req.body.publishedAt,
        }
      : undefined);

  const receipt = receiptPayload
    ? publishReceiptSchema.safeParse(receiptPayload)
    : undefined;

  if (receipt && !receipt.success) {
    return res.status(400).json({
      error: "Invalid publish receipt",
      details: receipt.error.flatten(),
    });
  }

  const status = receipt?.success
    ? xLayerPublisher.finalize(parsed.data, { receipt: receipt.data })
    : xLayerPublisher.prepare(parsed.data);

  return res.json({
    ...status,
  });
});

export default router;
