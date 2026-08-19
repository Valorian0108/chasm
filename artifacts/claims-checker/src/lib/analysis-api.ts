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
const FALLBACK_WALLET_ADDRESS =
  import.meta.env.VITE_X_LAYER_WALLET_ADDRESS?.trim() ||
  "0xf52a8c9f07446604743ffe60b7fbf75e9d16d9ff";
const FALLBACK_CONTRACT_ADDRESS =
  import.meta.env.VITE_X_LAYER_CONTRACT_ADDRESS?.trim() ||
  "0xa3a9fFddE592AE2D889562d9ca2B05d9Ae5634b3";
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

async function requestJson<T>(
  url: string,
  apiLabel: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`${apiLabel} API returned ${response.status}`);
  }

  return (await response.json()) as T;
}

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

export type XLayerReadiness = {
  ready: boolean;
  missing: Array<"walletAddress" | "contractAddress">;
  nextStep: string;
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
    const payload = await requestJson<{
      status?: string;
      xLayer?: XLayerSetup;
    }>(`${API_BASE}/xlayer/config`, "X Layer config");

    if (!payload.xLayer) {
      throw new Error("X Layer config payload missing");
    }

    return payload.xLayer;
  } catch (error) {
    console.warn("Falling back to local X Layer setup", error);
    return {
      targetNetwork: "xlayer-testnet",
      walletAddress: FALLBACK_WALLET_ADDRESS,
      contractAddress: FALLBACK_CONTRACT_ADDRESS,
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

export async function getXLayerReadiness(): Promise<XLayerReadiness> {
  try {
    const payload = await requestJson<{
      status?: string;
      readiness?: XLayerReadiness;
    }>(`${API_BASE}/xlayer/readiness`, "X Layer readiness");

    if (!payload.readiness) {
      throw new Error("X Layer readiness payload missing");
    }

    return payload.readiness;
  } catch (error) {
    console.warn("Falling back to local X Layer readiness", error);
    const missing = [
      !EVM_ADDRESS_PATTERN.test(FALLBACK_WALLET_ADDRESS)
        ? "walletAddress"
        : null,
      !EVM_ADDRESS_PATTERN.test(FALLBACK_CONTRACT_ADDRESS)
        ? "contractAddress"
        : null,
    ].filter((item): item is "walletAddress" | "contractAddress" => item !== null);

    return {
      ready: missing.length === 0,
      missing,
      nextStep:
        missing.length === 0
          ? "Copy the X Layer payload JSON when you are ready to publish a report."
          : "Add a deployed contract address, then copy the payload JSON into the wallet flow.",
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
    const payload = await requestJson<unknown>(
      `${API_BASE}/analysis/screen`,
      "Analysis",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
      },
    );
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
    const payload = await requestJson<{ payload: XLayerPublication }>(
      `${API_BASE}/analysis/publish-prep`,
      "Publication",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(report),
      },
    );
    return payload.payload;
  } catch (error) {
    console.warn("Falling back to local publication prep", error);
    return buildXLayerPublication(report);
  }
}

export async function preparePublishStatus(
  report: AnalysisReport,
): Promise<PublishStatus & { nextAction: string }> {
  try {
    return await requestJson<PublishStatus & { nextAction: string }>(
      `${API_BASE}/analysis/publish`,
      "Publish",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(report),
      },
    );
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
    return await requestJson<PublishStatus & { nextAction: string }>(
      `${API_BASE}/analysis/publish`,
      "Publish",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          report,
          receipt: parsedReceipt,
        }),
      },
    );
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
    return await requestJson<{
      status: "saved";
      record: unknown;
    }>(`${API_BASE}/analysis/records`, "Persistence", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(report),
    });
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
    const payload = await requestJson<{
      status?: string;
      records?: AnalysisRecord[];
    }>(`${API_BASE}/analysis/records`, "Records");

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
