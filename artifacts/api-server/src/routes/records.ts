import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import {
  analysisReportSchema,
  buildXLayerPublication,
} from "@workspace/api-zod";
import { db, analysisRecordsTable, type InsertAnalysisRecord } from "@workspace/db";
import { rateLimit, requireApiToken } from "../lib/security";

const router: IRouter = Router();
const memoryStore: InsertAnalysisRecord[] = [];

const recordsRateLimit = rateLimit({ windowMs: 60_000, max: 30 });

router.post("/analysis/records", recordsRateLimit, requireApiToken, async (req, res) => {
  const parsed = analysisReportSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid analysis report",
      details: parsed.error.flatten(),
    });
  }

  const report = parsed.data;
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
    const inserted = await db.insert(analysisRecordsTable).values(values).returning();
    return res.status(201).json({ status: "saved", record: inserted[0] });
  }

  const record = { id: memoryStore.length + 1, ...values };
  memoryStore.unshift(record);
  return res.status(201).json({ status: "saved", record });
});

router.get("/analysis/records", recordsRateLimit, requireApiToken, (_req, res) => {
  if (db) {
    return db
      .select()
      .from(analysisRecordsTable)
      .orderBy(desc(analysisRecordsTable.id))
      .limit(25)
      .then((records) => {
        res.json({
          status: "ok",
          records,
        });
      });
  }

  return res.json({
    status: "ok",
    records: memoryStore,
  });
});

export default router;
