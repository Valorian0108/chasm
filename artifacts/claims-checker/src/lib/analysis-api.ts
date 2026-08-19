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

/**
 * Error raised when the API cannot be reached or answers with a failure.
 * `unreachable` covers transport errors, `malformed` covers a response body
 * that does not match the API contract, and `http` carries the status code.
 */
export type ApiFailureKind = "unreachable" | "http" | "malformed";

export class ApiRequestError extends Error {
  readonly kind: ApiFailureKind;
  readonly endpoint: string;
  readonly status: number | null;

  constructor(
    kind: ApiFailureKind,
    endpoint: string,
    message: string,
    options?: { cause?: unknown; status?: number },
  ) {
    super(message, options);
    this.name = "ApiRequestError";
    this.kind = kind;
    this.endpoint = endpoint;
    this.status = options?.status ?? null;
  }
}

async function requestJson<T>(
  endpoint: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${endpoint}`, init);
  } catch (cause) {
    throw new ApiRequestError(
      "unreachable",
      endpoint,
      `${endpoint} is unreachable`,
      { cause },
    );
  }

  if (!response.ok) {
    throw new ApiRequestError(
      "http",
      endpoint,
      `${endpoint} returned ${response.status}`,
      { status: response.status },
    );
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new ApiRequestError(
      "malformed",
      endpoint,
      `${endpoint} returned a body that is not valid JSON`,
      { cause, status: response.status },
    );
  }
}

/**
 * The API is optional: static deployments serve the SPA shell for every route,
 * so transport errors, missing routes, non-API responses, and server faults
 * fall back to local screening. A 4xx answer means the API is present and
 * rejected the request, and falling back there would hide a real contract bug
 * behind a plausible-looking local result.
 */
function isApiUnavailable(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) {
    return false;
  }

  if (error.kind !== "http") {
    return true;
  }

  return error.status === 404 || (error.status ?? 500) >= 500;
}

function rethrowUnexpected(error: unknown, context: string): void {
  if (!isApiUnavailable(error)) {
    throw error;
  }

  console.warn(context, error);
}

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
    }>("/xlayer/config");

    if (!payload.xLayer) {
      throw new ApiRequestError(
        "malformed",
        "/xlayer/config",
        "X Layer config payload missing",
      );
    }

    return payload.xLayer;
  } catch (error) {
    rethrowUnexpected(error, "Falling back to local X Layer setup");
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
    }>("/xlayer/readiness");

    if (!payload.readiness) {
      throw new ApiRequestError(
        "malformed",
        "/xlayer/readiness",
        "X Layer readiness payload missing",
      );
    }

    return payload.readiness;
  } catch (error) {
    rethrowUnexpected(error, "Falling back to local X Layer readiness");
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
    const payload = await requestJson<unknown>("/analysis/screen", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });

    return analysisReportSchema.parse(payload);
  } catch (error) {
    rethrowUnexpected(error, "Falling back to local browser analysis");
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
    const payload = await requestJson<{ payload?: XLayerPublication }>(
      "/analysis/publish-prep",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(report),
      },
    );

    if (!payload.payload) {
      throw new ApiRequestError(
        "malformed",
        "/analysis/publish-prep",
        "Publication payload missing",
      );
    }

    return payload.payload;
  } catch (error) {
    rethrowUnexpected(error, "Falling back to local publication prep");
    return buildXLayerPublication(report);
  }
}

export async function preparePublishStatus(
  report: AnalysisReport,
): Promise<PublishStatus & { nextAction: string }> {
  try {
    return await requestJson<PublishStatus & { nextAction: string }>(
      "/analysis/publish",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(report),
      },
    );
  } catch (error) {
    rethrowUnexpected(error, "Falling back to local publish status");
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
      "/analysis/publish",
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
    rethrowUnexpected(error, "Falling back to local published status");
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
    return await requestJson<{ status: "saved"; record: unknown }>(
      "/analysis/records",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(report),
      },
    );
  } catch (error) {
    rethrowUnexpected(error, "Falling back to local record storage");
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
    }>("/analysis/records");

    return payload.records ?? [];
  } catch (error) {
    rethrowUnexpected(error, "Falling back to local record storage");
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

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as AnalysisRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    // Corrupt payloads are dropped rather than blocking the ledger, but the
    // reason stays visible in the console.
    console.warn("Discarding unreadable local records", error);
    return [];
  }
}

function writeLocalRecords(records: AnalysisRecord[]) {
  if (typeof window === "undefined") {
    throw new Error(
      "Local record storage is unavailable outside the browser.",
    );
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 25)));
  } catch (cause) {
    throw new Error("Unable to write the record to browser storage.", {
      cause,
    });
  }
}
