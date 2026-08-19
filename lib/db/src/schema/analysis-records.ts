import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysisRecordsTable = pgTable("analysis_records", {
  id: serial("id").primaryKey(),
  checkedAt: text("checked_at").notNull(),
  status: text("status").notNull(),
  score: integer("score").notNull(),
  summary: text("summary").notNull(),
  findingsCount: integer("findings_count").notNull(),
  highSeverityCount: integer("high_severity_count").notNull(),
  provider: text("provider").notNull(),
  network: text("network").notNull(),
  sourceLabel: text("source_label"),
  sourceUrl: text("source_url"),
  officialTermsHash: text("official_terms_hash").notNull(),
  publicMarketingHash: text("public_marketing_hash").notNull(),
  reportHash: text("report_hash").notNull(),
  publicationPayload: text("publication_payload").notNull(),
  txHash: text("tx_hash"),
  explorerUrl: text("explorer_url"),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull(),
});

export const insertAnalysisRecordSchema = createInsertSchema(
  analysisRecordsTable,
).omit({ id: true });

export type InsertAnalysisRecord = z.infer<typeof insertAnalysisRecordSchema>;
export type AnalysisRecord = typeof analysisRecordsTable.$inferSelect;
