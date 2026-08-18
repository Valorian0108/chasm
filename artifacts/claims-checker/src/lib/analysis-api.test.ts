// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeClaims, type AnalysisReport } from "@workspace/api-zod";
import {
  finalizePublishStatus,
  getDefaultSourceMetadata,
  getXLayerReadiness,
  getXLayerSetup,
  listRecords,
  preparePublication,
  preparePublishStatus,
  saveReport,
  screenClaims,
} from "./analysis-api";

const STORAGE_KEY = "claims-checker.records";
const officialTerms =
  "Holders receive contractual economic exposure with no voting rights.";
const publicMarketing = "Own a piece of the company with real shares.";

function reportWithProvenance(
  provenance: Partial<NonNullable<AnalysisReport["provenance"]>> = {},
): AnalysisReport {
  const base = analyzeClaims(officialTerms, publicMarketing);

  return {
    ...base,
    provenance: {
      provider: "local",
      network: "xlayer-testnet",
      sourceLabel: "Project site",
      sourceUrl: "https://example.com/terms",
      hashes: {
        officialTerms: "aaaaaaaaaaaaaaaa",
        publicMarketing: "bbbbbbbbbbbbbbbb",
        report: "cccccccccccccccc",
      },
      chainRecord: { status: "not_started" },
      ...provenance,
    },
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getDefaultSourceMetadata", () => {
  it("derives the label and URL from the current location", () => {
    expect(getDefaultSourceMetadata()).toEqual({
      sourceLabel: `${window.location.hostname} screening session`,
      sourceUrl: window.location.origin,
    });
  });
});

describe("getXLayerSetup", () => {
  it("returns the API payload when available", async () => {
    const xLayer = { targetNetwork: "xlayer-mainnet" };
    fetchMock.mockResolvedValue(jsonResponse({ status: "ok", xLayer }));

    await expect(getXLayerSetup()).resolves.toEqual(xLayer);
    expect(fetchMock).toHaveBeenCalledWith("/api/xlayer/config");
  });

  it("falls back to bundled defaults on an error response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    const setup = await getXLayerSetup();

    expect(setup.targetNetwork).toBe("xlayer-testnet");
    expect(setup.networks["xlayer-testnet"].chainId).toBe(1952);
    expect(setup.networks["xlayer-mainnet"].chainId).toBe(196);
    expect(setup.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("falls back when the payload is missing the config", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }));

    await expect(getXLayerSetup()).resolves.toMatchObject({
      faucetUrl: "https://www.okx.com/xlayer/faucet",
    });
  });
});

describe("getXLayerReadiness", () => {
  it("returns the API readiness when available", async () => {
    const readiness = {
      ready: false,
      missing: ["contractAddress"],
      nextStep: "x",
    };
    fetchMock.mockResolvedValue(jsonResponse({ readiness }));

    await expect(getXLayerReadiness()).resolves.toEqual(readiness);
  });

  it("computes readiness from the bundled fallback addresses", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(getXLayerReadiness()).resolves.toEqual({
      ready: true,
      missing: [],
      nextStep:
        "Copy the X Layer payload JSON when you are ready to publish a report.",
    });
  });
});

describe("screenClaims", () => {
  it("posts the parsed request and returns the API report", async () => {
    const report = reportWithProvenance();
    fetchMock.mockResolvedValue(jsonResponse(report));

    await expect(
      screenClaims(officialTerms, publicMarketing, {
        sourceLabel: "Manual label",
        sourceUrl: "https://example.com",
        targetNetwork: "xlayer-testnet",
      }),
    ).resolves.toEqual(report);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/analysis/screen");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      officialTerms,
      publicMarketing,
      sourceLabel: "Manual label",
      sourceUrl: "https://example.com",
      targetNetwork: "xlayer-testnet",
    });
  });

  it("rejects empty input before calling the API", async () => {
    await expect(screenClaims("   ", publicMarketing)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to local analysis with fallback provenance", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ nope: true }));

    const report = await screenClaims(officialTerms, publicMarketing);

    expect(report.provenance?.provider).toBe("fallback");
    expect(report.provenance?.network).toBe("local");
    expect(report.provenance?.hashes.officialTerms).toMatch(/^[0-9a-f]{16}$/);
    expect(report.findings[0].severity).toBe("high");
  });
});

describe("preparePublication", () => {
  it("returns the API payload", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ payload: { network: "xlayer-mainnet" } }),
    );

    await expect(preparePublication(reportWithProvenance())).resolves.toEqual({
      network: "xlayer-mainnet",
    });
  });

  it("builds the payload locally when the API fails", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    const payload = await preparePublication(reportWithProvenance());

    expect(payload).toMatchObject({
      network: "xlayer-testnet",
      reportHash: "cccccccccccccccc",
      highSeverityCount: 1,
    });
  });
});

describe("preparePublishStatus", () => {
  it("returns the API status", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: "ready", nextAction: "from api" }),
    );

    await expect(
      preparePublishStatus(reportWithProvenance()),
    ).resolves.toMatchObject({ nextAction: "from api" });
  });

  it("falls back to a local ready status", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const status = await preparePublishStatus(reportWithProvenance());

    expect(status.status).toBe("ready");
    expect(status.nextAction).toBe(
      "Send the payload through the testnet wallet flow to broadcast the transaction.",
    );
  });

  it("falls back to a local published status when the report has a receipt", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const status = await preparePublishStatus(
      reportWithProvenance({
        chainRecord: {
          status: "published",
          txHash: "0xabc",
          explorerUrl: "https://explorer.example.com/tx/0xabc",
          publishedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );

    expect(status.status).toBe("published");
    expect(status.nextAction).toBe(
      "Track the confirmed transaction on the explorer.",
    );
  });
});

describe("finalizePublishStatus", () => {
  it("posts the report and receipt together", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "published" }));

    await finalizePublishStatus(reportWithProvenance(), { txHash: "0xabc" });

    const body = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    );
    expect(body.receipt).toEqual({ txHash: "0xabc" });
    expect(body.report.summary).toBeDefined();
  });

  it("rejects an invalid receipt before calling the API", async () => {
    await expect(
      finalizePublishStatus(reportWithProvenance(), { txHash: "" }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to a locally published status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 502));

    const status = await finalizePublishStatus(reportWithProvenance(), {
      txHash: "0xabc",
      explorerUrl: "https://explorer.example.com/tx/0xabc",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(status).toMatchObject({
      status: "published",
      txHash: "0xabc",
      nextAction: "Track the confirmed transaction on the explorer.",
    });
  });
});

describe("saveReport and listRecords", () => {
  it("returns the API record when persistence succeeds", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: "saved", record: { id: 7 } }),
    );

    await expect(saveReport(reportWithProvenance())).resolves.toEqual({
      status: "saved",
      record: { id: 7 },
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("stores newest-first records in localStorage when the API fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const first = await saveReport(reportWithProvenance());
    const second = await saveReport(
      reportWithProvenance({ provider: "ai", sourceLabel: "Second run" }),
    );

    expect(first.status).toBe("saved");
    const stored = JSON.parse(String(window.localStorage.getItem(STORAGE_KEY)));
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({
      provider: "ai",
      sourceLabel: "Second run",
      findingsCount: 1,
      highSeverityCount: 1,
      reportHash: "cccccccccccccccc",
    });
    expect(JSON.parse(stored[0].publicationPayload).network).toBe(
      "xlayer-testnet",
    );
    expect(stored[1]).toMatchObject({ provider: "local" });
    expect(second.record).toBeDefined();
  });

  it("caps the local store at 25 records", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    for (let index = 0; index < 27; index += 1) {
      await saveReport(reportWithProvenance());
    }

    expect(
      JSON.parse(String(window.localStorage.getItem(STORAGE_KEY))),
    ).toHaveLength(25);
  });

  it("lists records from the API", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ records: [{ id: 1 }] }));

    await expect(listRecords()).resolves.toEqual([{ id: 1 }]);
  });

  it("returns an empty list when the API omits records", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }));

    await expect(listRecords()).resolves.toEqual([]);
  });

  it("reads local records when the API fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 42 }]));

    await expect(listRecords()).resolves.toEqual([{ id: 42 }]);
  });

  it("returns an empty list for unusable local storage contents", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    window.localStorage.setItem(STORAGE_KEY, "not json");
    await expect(listRecords()).resolves.toEqual([]);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 1 }));
    await expect(listRecords()).resolves.toEqual([]);
  });
});
