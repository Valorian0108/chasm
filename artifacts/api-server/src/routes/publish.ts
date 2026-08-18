import { Router, type IRouter } from "express";
import {
  analysisReportSchema,
  publishReceiptSchema,
} from "@workspace/api-zod";
import { xLayerPublisher } from "../services/xlayer-publisher";
import { parseWithValidation } from "../lib/validation";

const router: IRouter = Router();

router.post("/analysis/publish", (req, res) => {
  const parsed = parseWithValidation(
    analysisReportSchema,
    req.body?.report ?? req.body,
    res,
    "Invalid analysis report",
  );

  if (!parsed.success) {
    return;
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
    ? parseWithValidation(
        publishReceiptSchema,
        receiptPayload,
        res,
        "Invalid publish receipt",
      )
    : undefined;

  if (receipt && !receipt.success) {
    return;
  }

  const status = receipt?.success
    ? xLayerPublisher.finalize(parsed.data, { receipt: receipt.data })
    : xLayerPublisher.prepare(parsed.data);

  return res.json({
    ...status,
  });
});

export default router;
