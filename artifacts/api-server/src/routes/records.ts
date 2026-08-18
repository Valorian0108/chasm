import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import {
  analysisReportSchema,
  buildXLayerPublication,
} from "@workspace/api-zod";
import { db, analysisRecordsTable, type InsertAnalysisRecord } from "@workspace/db";
import { HttpError } from "../lib/http-error";

const router: IRouter = Router();
const memoryStore: InsertAnalysisRecord[] = [];

router.post("/analysis/records", async (req, res, next) => {
  const parsed = analysisReportSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid analysis report",
      details: parsed.error.flatten(),
    });
  }

  const report = parsed.data;

  if (!report.provenance) {
    return res.status(400).json({
      error: "Report provenance is required to save an analysis record",
    });
  }

  const publication = buildXLayerPublication(report);
  const values: InsertAnalysisRecord = {
    checkedAt: report.checkedAt,
    status: report.status,
    score: report.score,
    summary: report.summary,
    findingsCount: report.findings.length,
    highSeverityCount: report.findings.filter((finding) => finding.severity === "high").length,
    provider: report.provenance?.provider ?? "local",
    network: report.provenance?.network ?? "local",
    sourceLabel: report.provenance?.sourceLabel,
    sourceUrl: report.provenance?.sourceUrl,
    officialTermsHash: report.provenance?.hashes.officialTerms ?? "",
    publicMarketingHash: report.provenance?.hashes.publicMarketing ?? "",
    reportHash: report.provenance?.hashes.report ?? "",
    publicationPayload: JSON.stringify(publication),
    txHash: report.provenance?.chainRecord.txHash,
    explorerUrl: report.provenance?.chainRecord.explorerUrl,
    publishedAt: report.provenance?.chainRecord.publishedAt,
    createdAt: new Date().toISOString(),
  };

  if (db) {
    try {
      const inserted = await db
        .insert(analysisRecordsTable)
        .values(values)
        .returning();
      const record = inserted[0];

      if (!record) {
        throw new HttpError(500, "Database insert returned no record");
      }

      return res.status(201).json({ status: "saved", record });
    } catch (error) {
      return next(
        error instanceof HttpError
          ? error
          : new HttpError(503, "Unable to save analysis record", {
              cause: error,
            }),
      );
    }
  }

  const record = { id: memoryStore.length + 1, ...values };
  memoryStore.unshift(record);
  return res.status(201).json({ status: "saved", record });
});

router.get("/analysis/records", async (_req, res, next) => {
  if (db) {
    try {
      const records = await db
        .select()
        .from(analysisRecordsTable)
        .orderBy(desc(analysisRecordsTable.id))
        .limit(25);

      return res.json({
        status: "ok",
        records,
      });
    } catch (error) {
      return next(
        new HttpError(503, "Unable to load analysis records", { cause: error }),
      );
    }
  }

  return res.json({
    status: "ok",
    records: memoryStore,
  });
});

export default router;
