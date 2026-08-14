import { z } from "zod/v4";

export const severitySchema = z.enum(["high", "medium", "low"]);

export const findingSchema = z.object({
  title: z.string(),
  severity: severitySchema,
  marketingQuote: z.string(),
  termsQuote: z.string(),
  explanation: z.string(),
  confidence: z.number().int().min(0).max(100),
});

export const analysisReportSchema = z.object({
  checkedAt: z.string(),
  status: z.enum(["flagged", "clear"]),
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  findings: z.array(findingSchema),
  provenance: z
    .object({
      provider: z.enum(["local", "ai", "fallback"]),
      network: z.enum(["local", "xlayer-testnet", "xlayer-mainnet"]),
      sourceLabel: z.string().min(1).optional(),
      sourceUrl: z.string().url().optional(),
      hashes: z.object({
        officialTerms: z.string(),
        publicMarketing: z.string(),
        report: z.string(),
      }),
      chainRecord: z.object({
        status: z.enum(["not_started", "ready", "published"]),
        txHash: z.string().min(1).optional(),
        explorerUrl: z.string().url().optional(),
        publishedAt: z.string().optional(),
      }),
  })
    .optional(),
});

export const xLayerPublicationSchema = z.object({
  network: z.enum(["xlayer-testnet", "xlayer-mainnet"]),
  sourceLabel: z.string().min(1).optional(),
  sourceUrl: z.string().url().optional(),
  reportHash: z.string().min(1),
  officialTermsHash: z.string().min(1),
  publicMarketingHash: z.string().min(1),
  findingsCount: z.number().int().min(0),
  highSeverityCount: z.number().int().min(0),
  summary: z.string().min(1),
  timestamp: z.string().min(1),
});

export const publicationChecklistItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  complete: z.boolean(),
});

export const publishStatusSchema = z.object({
  status: z.enum(["pending", "ready", "published"]),
  network: z.enum(["xlayer-testnet", "xlayer-mainnet"]),
  payload: xLayerPublicationSchema,
  checklist: publicationChecklistItemSchema.array(),
  txHash: z.string().min(1).optional(),
  explorerUrl: z.string().url().optional(),
  publishedAt: z.string().optional(),
});

export const publishReceiptSchema = z.object({
  txHash: z.string().min(1),
  explorerUrl: z.string().url().optional(),
  publishedAt: z.string().datetime().optional(),
});

export const analysisRequestSchema = z.object({
  officialTerms: z.string().trim().min(1),
  publicMarketing: z.string().trim().min(1),
  sourceLabel: z.string().trim().min(1).optional(),
  sourceUrl: z.string().url().optional(),
  targetNetwork: z.enum(["local", "xlayer-testnet", "xlayer-mainnet"]).optional(),
});

export type Severity = z.infer<typeof severitySchema>;
export type Finding = z.infer<typeof findingSchema>;
export type AnalysisReport = z.infer<typeof analysisReportSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type AnalysisProvenance = NonNullable<AnalysisReport["provenance"]>;
export type XLayerPublication = z.infer<typeof xLayerPublicationSchema>;
export type PublicationChecklistItem = z.infer<
  typeof publicationChecklistItemSchema
>;
export type PublishStatus = z.infer<typeof publishStatusSchema>;
export type PublishReceipt = z.infer<typeof publishReceiptSchema>;

const demoFindings: Finding[] = [
  {
    title: '“Backed 1:1” implies ownership the terms withhold',
    severity: "high",
    marketingQuote: "Backed 1:1 by real shares. Own a piece of the company",
    termsQuote:
      "Contractual economic exposure… does not register the holder as a shareholder. No voting rights or delivery of the underlying share.",
    explanation:
      "The marketing compresses exposure into an ownership promise. The terms describe a contractual economic exposure and explicitly remove shareholder registration, voting rights, and delivery of the underlying share.",
    confidence: 98,
  },
  {
    title: "Exchange-liquidity claim is undercut",
    severity: "high",
    marketingQuote: "Trade with leading public-market liquidity",
    termsQuote:
      "The platform may use its own liquidity arrangements to facilitate trading.",
    explanation:
      "Naming leading stock-market liquidity suggests access to live public-market order books. The disclosure instead points to the platform’s own liquidity arrangements, which is a materially narrower description.",
    confidence: 97,
  },
  {
    title: "“Same upside” leaves important rights unstated",
    severity: "medium",
    marketingQuote: "Access the same upside as holding the underlying stock.",
    termsQuote:
      "The token is not an ownership interest in the referenced asset.",
    explanation:
      "Economic performance may be similar in a narrow sense, but the marketing leaves out the legal and control rights that distinguish a tokenized exposure from holding the stock itself.",
    confidence: 88,
  },
];

export function findSentence(text: string, pattern: RegExp) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .find((sentence) => pattern.test(sentence))
    ?.trim();
}

export function analyzeClaims(
  officialTerms: string,
  publicMarketing: string,
): AnalysisReport {
  const marketing = publicMarketing.toLowerCase();
  const legal = officialTerms.toLowerCase();
  const findings: Finding[] = [];

  const addIf = (condition: boolean, finding: Finding) => {
    if (condition) findings.push(finding);
  };

  addIf(
    /backed .*1:1|own a piece|ownership|shareholder|real shares/.test(
      marketing,
    ) &&
      /economic exposure|not .*ownership|shareholder|voting rights|delivery of the underlying/.test(
        legal,
      ),
    {
      ...demoFindings[0],
      marketingQuote:
        findSentence(
          publicMarketing,
          /backed .*1:1|own a piece|ownership|real shares/i,
        ) || demoFindings[0].marketingQuote,
      termsQuote:
        findSentence(
          officialTerms,
          /economic exposure|not .*ownership|shareholder|voting rights|delivery of the underlying/i,
        ) || demoFindings[0].termsQuote,
    },
  );

  addIf(
    /leading public-market|public-market liquidity|order book|exchange liquidity|market liquidity/.test(
      marketing,
    ) &&
      /own liquidity|liquidity arrangements|in-house/.test(legal),
    {
      ...demoFindings[1],
      marketingQuote:
        findSentence(
          publicMarketing,
          /leading public-market|public-market liquidity|order book|exchange liquidity|market liquidity/i,
        ) || demoFindings[1].marketingQuote,
      termsQuote:
        findSentence(
          officialTerms,
          /own liquidity|liquidity arrangements|in-house/i,
        ) || demoFindings[1].termsQuote,
    },
  );

  addIf(
    /same upside|same performance|equivalent to holding/.test(marketing) &&
      /not .*ownership|contractual economic exposure/.test(legal),
    {
      ...demoFindings[2],
      marketingQuote:
        findSentence(
          publicMarketing,
          /same upside|same performance|equivalent to holding/i,
        ) || demoFindings[2].marketingQuote,
      termsQuote:
        findSentence(
          officialTerms,
          /not .*ownership|contractual economic exposure/i,
        ) || demoFindings[2].termsQuote,
    },
  );

  if (!findings.length && legal && marketing) {
    findings.push({
      title: "No direct contradiction detected",
      severity: "low",
      marketingQuote: publicMarketing.trim().split(/\n+/)[0].slice(0, 160),
      termsQuote: officialTerms.trim().split(/\n+/)[0].slice(0, 160),
      explanation:
        "The local rules did not find a strong mismatch between the language provided. This is a screening result, not a legal opinion; review nuanced or implied claims manually.",
      confidence: 63,
    });
  }

  const score =
    findings[0]?.title === "No direct contradiction detected"
      ? 86
      : Math.max(
          18,
          Math.round(
            100 -
              findings.reduce(
                (total, finding) =>
                  total +
                  (finding.severity === "high"
                    ? 19
                    : finding.severity === "medium"
                      ? 11
                      : 5),
                0,
              ),
          ),
        );

  const highCount = findings.filter(
    (finding) => finding.severity === "high",
  ).length;

  return {
    checkedAt: new Date().toISOString(),
    status:
      highCount > 0
        ? "flagged"
        : findings.some((finding) => finding.severity === "medium")
          ? "flagged"
          : "clear",
    score,
    summary:
      highCount > 0
        ? `${highCount} high-severity promise${highCount === 1 ? "" : "s"} conflict with or exceed the supplied terms.`
        : findings[0]?.title === "No direct contradiction detected"
          ? "No direct contradiction detected by the local screening rules."
          : "Potentially unsupported language was found and should be reviewed.",
    findings,
  };
}

export async function buildAnalysisProvenance(
  request: AnalysisRequest,
  report: AnalysisReport,
  options?: {
    provider?: "local" | "ai" | "fallback";
    network?: "local" | "xlayer-testnet" | "xlayer-mainnet";
    txHash?: string;
    explorerUrl?: string;
    publishedAt?: string;
  },
): Promise<AnalysisProvenance> {
  const provider = options?.provider ?? "local";
  const network = options?.network ?? request.targetNetwork ?? "local";

  const [officialTermsHash, publicMarketingHash, reportHash] =
    await Promise.all([
      fingerprintHex(request.officialTerms),
      fingerprintHex(request.publicMarketing),
      fingerprintHex(JSON.stringify(report)),
    ]);

  return {
    provider,
    network,
    sourceLabel: request.sourceLabel,
    sourceUrl: request.sourceUrl,
    hashes: {
      officialTerms: officialTermsHash,
      publicMarketing: publicMarketingHash,
      report: reportHash,
    },
    chainRecord: {
      status: options?.txHash ? "published" : "not_started",
      txHash: options?.txHash,
      explorerUrl: options?.explorerUrl,
      publishedAt: options?.publishedAt,
    },
  };
}

function fingerprintHex(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, "0");
}

export function buildXLayerPublication(
  report: AnalysisReport,
): XLayerPublication {
  if (!report.provenance) {
    throw new Error("Report provenance is required to build an X Layer publication payload.");
  }

  const highSeverityCount = report.findings.filter(
    (finding) => finding.severity === "high",
  ).length;

  return xLayerPublicationSchema.parse({
    network: report.provenance.network === "xlayer-mainnet"
      ? "xlayer-mainnet"
      : "xlayer-testnet",
    sourceLabel: report.provenance.sourceLabel,
    sourceUrl: report.provenance.sourceUrl,
    reportHash: report.provenance.hashes.report,
    officialTermsHash: report.provenance.hashes.officialTerms,
    publicMarketingHash: report.provenance.hashes.publicMarketing,
    findingsCount: report.findings.length,
    highSeverityCount,
    summary: report.summary,
    timestamp: report.checkedAt,
  });
}

export function buildPublicationChecklist(
  report: AnalysisReport,
  publication?: XLayerPublication | null,
): PublicationChecklistItem[] {
  const hasProvenance = Boolean(report.provenance);
  const hasSourceLabel = Boolean(report.provenance?.sourceLabel);
  const hasSourceUrl = Boolean(report.provenance?.sourceUrl);
  const hasPayload = Boolean(publication);
  const hasPublishedTx = Boolean(report.provenance?.chainRecord.txHash);
  const published = report.provenance?.chainRecord.status === "published";

  return publicationChecklistItemSchema.array().parse([
    {
      key: "source-label",
      label: "Source label",
      detail: hasSourceLabel
        ? `Using ${report.provenance?.sourceLabel}`
        : "Add a source label before publishing.",
      complete: hasSourceLabel,
    },
    {
      key: "source-url",
      label: "Source URL",
      detail: hasSourceUrl
        ? "Source URL is attached to the report."
        : "Add the deployed app or project source URL when available.",
      complete: hasSourceUrl,
    },
    {
      key: "analysis-provenance",
      label: "Analysis provenance",
      detail: hasProvenance
        ? `Provider: ${report.provenance?.provider}, network: ${report.provenance?.network}.`
        : "Run a report to create provenance.",
      complete: hasProvenance,
    },
    {
      key: "publication-payload",
      label: "Publication payload",
      detail: hasPayload
        ? "Compact X Layer payload prepared."
        : "Prepare the payload before testnet publish.",
      complete: hasPayload,
    },
    {
      key: "chain-record",
      label: "Chain record",
      detail: published
        ? "Onchain record marked as published."
        : hasPublishedTx
          ? "Transaction hash exists, but the record is not marked published yet."
          : "Awaiting a testnet broadcast and transaction hash.",
      complete: published || hasPublishedTx,
    },
  ]);
}

export function buildPublishStatus(
  report: AnalysisReport,
  options?: {
    txHash?: string;
    explorerUrl?: string;
    publishedAt?: string;
  },
): PublishStatus {
  const payload = buildXLayerPublication(report);
  const checklist = buildPublicationChecklist(report, payload);
  const hasTx = Boolean(options?.txHash);
  const hasPublishedAt = Boolean(options?.publishedAt);

  return publishStatusSchema.parse({
    status: hasTx && hasPublishedAt ? "published" : "ready",
    network: payload.network,
    payload,
    checklist,
    txHash: options?.txHash,
    explorerUrl: options?.explorerUrl,
    publishedAt: options?.publishedAt,
  });
}
