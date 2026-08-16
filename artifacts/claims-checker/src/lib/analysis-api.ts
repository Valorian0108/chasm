import {
  analyzeClaims,
  analysisReportSchema,
  analysisRequestSchema,
  buildAnalysisProvenance,
  publishReceiptSchema,
  buildPublishStatus,
  buildXLayerPublication,
  type AnalysisReport,
  type PublishReceipt,
  type PublishStatus,
  type XLayerPublication,
} from "@workspace/api-zod";

const API_BASE = "/api";
const STORAGE_KEY = "claims-checker.records";

export type XLayerNetworkConfig = {
  name: "xlayer-testnet" | "xlayer-mainnet";
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
};

export type XLayerSetup = {
  targetNetwork: "xlayer-testnet" | "xlayer-mainnet";
  walletAddress: string;
  contractAddress: string;
  faucetUrl: string;
  networks: Record<"xlayer-testnet" | "xlayer-mainnet", XLayerNetworkConfig>;
};

export type AnalysisRecord = {
  id: number;
  checkedAt: string;
  status: string;
  score: number;
  summary: string;
  findingsCount: number;
  highSeverityCount: number;
  provider: string;
  network: string;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  officialTermsHash: string;
  publicMarketingHash: string;
  reportHash: string;
  publicationPayload: string;
  txHash?: string | null;
  explorerUrl?: string | null;
  publishedAt?: string | null;
  createdAt: string;
};

export function getDefaultSourceMetadata() {
  if (typeof window === "undefined") {
    return {
      sourceLabel: "Browser screening session",
      sourceUrl: "",
    };
  }

  return {
    sourceLabel: `${window.location.hostname || "Browser"} screening session`,
    sourceUrl: window.location.origin,
  };
}

export async function getXLayerSetup(): Promise<XLayerSetup> {
  try {
    const response = await fetch(`${API_BASE}/xlayer/config`);

    if (!response.ok) {
      throw new Error(`X Layer config API returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      status?: string;
      xLayer?: XLayerSetup;
    };

    if (!payload.xLayer) {
      throw new Error("X Layer config payload missing");
    }

    return payload.xLayer;
  } catch (error) {
    console.warn("Falling back to local X Layer setup", error);
    return {
      targetNetwork: "xlayer-testnet",
      walletAddress: "",
      contractAddress: "",
      faucetUrl: "https://www.okx.com/xlayer/faucet",
      networks: {
        "xlayer-testnet": {
          name: "xlayer-testnet",
          chainId: 1952,
          rpcUrl: "https://testrpc.xlayer.tech/terigon",
          explorerUrl: "https://www.okx.com/web3/explorer/xlayer-test",
        },
        "xlayer-mainnet": {
          name: "xlayer-mainnet",
          chainId: 196,
          rpcUrl: "https://rpc.xlayer.tech",
          explorerUrl: "https://www.okx.com/web3/explorer/xlayer",
        },
      },
    };
  }
}

export async function screenClaims(
  officialTerms: string,
  publicMarketing: string,
  options?: {
    sourceLabel?: string;
    sourceUrl?: string;
    targetNetwork?: "local" | "xlayer-testnet" | "xlayer-mainnet";
  },
): Promise<AnalysisReport> {
  const request = analysisRequestSchema.parse({
    officialTerms,
    publicMarketing,
    sourceLabel: options?.sourceLabel ?? getDefaultSourceMetadata().sourceLabel,
    sourceUrl: options?.sourceUrl ?? getDefaultSourceMetadata().sourceUrl,
    targetNetwork: options?.targetNetwork ?? "local",
  });

  try {
    const response = await fetch(`${API_BASE}/analysis/screen`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Analysis API returned ${response.status}`);
    }

    const payload = await response.json();
    return analysisReportSchema.parse(payload);
  } catch (error) {
    console.warn("Falling back to local browser analysis", error);
    const report = analyzeClaims(officialTerms, publicMarketing);
    const provenance = await buildAnalysisProvenance(request, report, {
      provider: "fallback",
    });
    return {
      ...report,
      provenance,
    };
  }
}

export async function preparePublication(
  report: AnalysisReport,
): Promise<XLayerPublication> {
  try {
    const response = await fetch(`${API_BASE}/analysis/publish-prep`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      throw new Error(`Publication API returned ${response.status}`);
    }

    const payload = await response.json();
    return payload.payload as XLayerPublication;
  } catch (error) {
    console.warn("Falling back to local publication prep", error);
    return buildXLayerPublication(report);
  }
}

export async function preparePublishStatus(
  report: AnalysisReport,
): Promise<PublishStatus & { nextAction: string }> {
  try {
    const response = await fetch(`${API_BASE}/analysis/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      throw new Error(`Publish API returned ${response.status}`);
    }

    return response.json() as Promise<PublishStatus & { nextAction: string }>;
  } catch (error) {
    console.warn("Falling back to local publish status", error);
    const published = buildPublishStatus(report, {
      txHash: report.provenance?.chainRecord.txHash,
      explorerUrl: report.provenance?.chainRecord.explorerUrl,
      publishedAt: report.provenance?.chainRecord.publishedAt,
    });

    return {
      ...published,
      nextAction:
        published.status === "published"
          ? "Track the confirmed transaction on the explorer."
          : "Send the payload through the testnet wallet flow to broadcast the transaction.",
    };
  }
}

export async function finalizePublishStatus(
  report: AnalysisReport,
  receipt: PublishReceipt,
): Promise<PublishStatus & { nextAction: string }> {
  const parsedReceipt = publishReceiptSchema.parse(receipt);

  try {
    const response = await fetch(`${API_BASE}/analysis/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        report,
        receipt: parsedReceipt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Publish API returned ${response.status}`);
    }

    return response.json() as Promise<PublishStatus & { nextAction: string }>;
  } catch (error) {
    console.warn("Falling back to local published status", error);
    const status = buildPublishStatus(report, {
      txHash: parsedReceipt.txHash,
      explorerUrl: parsedReceipt.explorerUrl,
      publishedAt: parsedReceipt.publishedAt,
    });

    return {
      ...status,
      status: "published",
      txHash: parsedReceipt.txHash,
      explorerUrl: parsedReceipt.explorerUrl,
      publishedAt: parsedReceipt.publishedAt,
      nextAction: "Track the confirmed transaction on the explorer.",
    };
  }
}

export async function saveReport(report: AnalysisReport) {
  try {
    const response = await fetch(`${API_BASE}/analysis/records`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      throw new Error(`Persistence API returned ${response.status}`);
    }

    return response.json() as Promise<{
      status: "saved";
      record: unknown;
    }>;
  } catch (error) {
    console.warn("Falling back to local record storage", error);
    const localRecord = buildLocalRecord(report);
    const existing = readLocalRecords();
    writeLocalRecords([localRecord, ...existing]);
    return {
      status: "saved",
      record: localRecord,
    };
  }
}

export async function listRecords(): Promise<AnalysisRecord[]> {
  try {
    const response = await fetch(`${API_BASE}/analysis/records`);

    if (!response.ok) {
      throw new Error(`Records API returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      status?: string;
      records?: AnalysisRecord[];
    };

    return payload.records ?? [];
  } catch (error) {
    console.warn("Falling back to local record storage", error);
    return readLocalRecords();
  }
}

function buildLocalRecord(report: AnalysisReport): AnalysisRecord {
  const publication = buildXLayerPublication(report);
  const highSeverityCount = report.findings.filter(
    (finding) => finding.severity === "high",
  ).length;

  return {
    id: Date.now(),
    checkedAt: report.checkedAt,
    status: report.status,
    score: report.score,
    summary: report.summary,
    findingsCount: report.findings.length,
    highSeverityCount,
    provider: report.provenance?.provider ?? "local",
    network: report.provenance?.network ?? publication.network,
    sourceLabel: report.provenance?.sourceLabel,
    sourceUrl: report.provenance?.sourceUrl,
    officialTermsHash: report.provenance?.hashes.officialTerms ?? "",
    publicMarketingHash: report.provenance?.hashes.publicMarketing ?? "",
    reportHash: report.provenance?.hashes.report ?? publication.reportHash,
    publicationPayload: JSON.stringify(publication),
    txHash: report.provenance?.chainRecord.txHash,
    explorerUrl: report.provenance?.chainRecord.explorerUrl,
    publishedAt: report.provenance?.chainRecord.publishedAt,
    createdAt: new Date().toISOString(),
  };
}

function readLocalRecords(): AnalysisRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AnalysisRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Unable to read local records", error);
    return [];
  }
}

function writeLocalRecords(records: AnalysisRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 25)));
  } catch (error) {
    console.warn("Unable to write local records", error);
  }
}
