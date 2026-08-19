import { describe, expect, it } from "vitest";
import {
  analyzeClaims,
  buildAnalysisProvenance,
  buildPublicationChecklist,
  buildPublishStatus,
  buildXLayerPublication,
  findSentence,
  type AnalysisReport,
} from "./screening";

const ownershipTerms =
  "The token grants contractual economic exposure. It does not register the holder as a shareholder and gives no voting rights or delivery of the underlying share.";
const ownershipMarketing =
  "Backed 1:1 by real shares. Own a piece of the company today.";

function reportWithProvenance(
  overrides: Partial<NonNullable<AnalysisReport["provenance"]>> = {},
  reportOverrides: Partial<AnalysisReport> = {},
): AnalysisReport {
  const report = analyzeClaims(ownershipTerms, ownershipMarketing);

  return {
    ...report,
    ...reportOverrides,
    provenance: {
      provider: "local",
      network: "xlayer-testnet",
      hashes: {
        officialTerms: "aaaaaaaaaaaaaaaa",
        publicMarketing: "bbbbbbbbbbbbbbbb",
        report: "cccccccccccccccc",
      },
      chainRecord: { status: "not_started" },
      ...overrides,
    },
  };
}

describe("findSentence", () => {
  it("returns the first trimmed sentence matching the pattern", () => {
    const text = "First sentence. Second sentence mentions liquidity. Third.";

    expect(findSentence(text, /liquidity/i)).toBe(
      "Second sentence mentions liquidity.",
    );
  });

  it("splits on newlines as well as sentence punctuation", () => {
    expect(findSentence("alpha\n  beta line\ngamma", /beta/)).toBe("beta line");
  });

  it("returns undefined when nothing matches", () => {
    expect(findSentence("nothing to see here.", /liquidity/)).toBeUndefined();
  });
});

describe("analyzeClaims", () => {
  it("flags ownership language that the terms withhold", () => {
    const report = analyzeClaims(ownershipTerms, ownershipMarketing);

    expect(report.status).toBe("flagged");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].severity).toBe("high");
    expect(report.findings[0].marketingQuote).toBe(
      "Backed 1:1 by real shares.",
    );
    expect(report.findings[0].termsQuote).toContain("economic exposure");
    expect(report.summary).toBe(
      "1 high-severity promise conflict with or exceed the supplied terms.",
    );
    expect(report.score).toBe(81);
    expect(() => new Date(report.checkedAt).toISOString()).not.toThrow();
  });

  it("flags guaranteed return language against risk disclosures", () => {
    const report = analyzeClaims(
      "Rewards are variable and not guaranteed. Users may lose funds due to market risk.",
      "Earn guaranteed passive income with zero risk.",
    );

    expect(report.findings.map((finding) => finding.title)).toEqual([
      "Guaranteed return language conflicts with risk disclosures",
    ]);
    expect(report.findings[0].marketingQuote).toBe(
      "Earn guaranteed passive income with zero risk.",
    );
    expect(report.findings[0].termsQuote).toBe(
      "Rewards are variable and not guaranteed.",
    );
  });

  it("flags liquidity and same-upside mismatches", () => {
    const report = analyzeClaims(
      "The platform may use its own liquidity arrangements to facilitate trading. The token is not an ownership interest in the referenced asset.",
      "Trade with leading public-market liquidity. Access the same upside as holding the underlying stock.",
    );

    expect(report.findings.map((finding) => finding.severity)).toEqual([
      "high",
      "medium",
    ]);
    expect(report.findings[0].title).toBe(
      "Exchange-liquidity claim is undercut",
    );
    expect(report.findings[1].title).toBe(
      "“Same upside” leaves important rights unstated",
    );
    expect(report.status).toBe("flagged");
  });

  it("keeps a medium-only report flagged", () => {
    const report = analyzeClaims(
      "The token is not an ownership interest in the referenced asset.",
      "Access the same upside as holding the underlying stock.",
    );

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].severity).toBe("medium");
    expect(report.status).toBe("flagged");
    expect(report.summary).toBe(
      "Potentially unsupported language was found and should be reviewed.",
    );
  });

  it("returns a clear screening result when no rule matches", () => {
    const report = analyzeClaims(
      "This document describes the settlement calendar for the product.",
      "A calm product update about our new documentation site.",
    );

    expect(report.status).toBe("clear");
    expect(report.score).toBe(86);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].title).toBe("No strong mismatch found");
    expect(report.findings[0].confidence).toBe(63);
    expect(report.summary).toBe(
      "No strong mismatch found by the local screening rules.",
    );
  });

  it("truncates the fallback quotes to the first line and 160 characters", () => {
    const longLine = "x".repeat(200);
    const report = analyzeClaims(`${longLine}\nsecond`, `${longLine}\nsecond`);

    expect(report.findings[0].marketingQuote).toHaveLength(160);
    expect(report.findings[0].termsQuote).toHaveLength(160);
  });

  it("produces an empty findings list when a side is blank", () => {
    const report = analyzeClaims("", "");

    expect(report.findings).toEqual([]);
    expect(report.status).toBe("clear");
    expect(report.summary).toBe(
      "Potentially unsupported language was found and should be reviewed.",
    );
  });

  it("subtracts severity weights from the score for every finding", () => {
    const report = analyzeClaims(
      "Rewards are variable and not guaranteed and users may lose funds. Holders receive contractual economic exposure with no voting rights. The platform may use its own liquidity arrangements.",
      "Earn guaranteed passive income with zero risk. Own a piece of the company. Trade with leading public-market liquidity. Access the same upside as holding the underlying stock.",
    );

    expect(report.findings).toHaveLength(4);
    expect(report.score).toBe(32);
    expect(report.summary).toBe(
      "3 high-severity promises conflict with or exceed the supplied terms.",
    );
  });
});

describe("buildAnalysisProvenance", () => {
  const request = {
    officialTerms: ownershipTerms,
    publicMarketing: ownershipMarketing,
  };

  it("defaults the provider and network and fingerprints every source", async () => {
    const report = analyzeClaims(ownershipTerms, ownershipMarketing);
    const provenance = await buildAnalysisProvenance(request, report);

    expect(provenance.provider).toBe("local");
    expect(provenance.network).toBe("local");
    expect(provenance.chainRecord).toEqual({
      status: "not_started",
      txHash: undefined,
      explorerUrl: undefined,
      publishedAt: undefined,
    });
    for (const hash of Object.values(provenance.hashes)) {
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(provenance.hashes.officialTerms).not.toBe(
      provenance.hashes.publicMarketing,
    );
  });

  it("produces stable hashes for identical input", async () => {
    const report = analyzeClaims(ownershipTerms, ownershipMarketing);
    const [first, second] = await Promise.all([
      buildAnalysisProvenance(request, report),
      buildAnalysisProvenance(request, report),
    ]);

    expect(first.hashes).toEqual(second.hashes);
  });

  it("prefers the request target network and marks published records", async () => {
    const report = analyzeClaims(ownershipTerms, ownershipMarketing);
    const provenance = await buildAnalysisProvenance(
      { ...request, targetNetwork: "xlayer-mainnet", sourceLabel: "Docs" },
      report,
      {
        provider: "ai",
        txHash: "0xabc",
        explorerUrl: "https://example.com/tx/0xabc",
        publishedAt: "2026-01-01T00:00:00.000Z",
      },
    );

    expect(provenance).toMatchObject({
      provider: "ai",
      network: "xlayer-mainnet",
      sourceLabel: "Docs",
      chainRecord: {
        status: "published",
        txHash: "0xabc",
        explorerUrl: "https://example.com/tx/0xabc",
        publishedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("lets explicit options override the requested network", async () => {
    const report = analyzeClaims(ownershipTerms, ownershipMarketing);
    const provenance = await buildAnalysisProvenance(
      { ...request, targetNetwork: "xlayer-mainnet" },
      report,
      { network: "xlayer-testnet" },
    );

    expect(provenance.network).toBe("xlayer-testnet");
  });
});

describe("buildXLayerPublication", () => {
  it("maps report provenance into the compact payload", () => {
    const report = reportWithProvenance({
      sourceLabel: "Project site",
      sourceUrl: "https://example.com/terms",
    });
    const payload = buildXLayerPublication(report);

    expect(payload).toEqual({
      network: "xlayer-testnet",
      sourceLabel: "Project site",
      sourceUrl: "https://example.com/terms",
      reportHash: "cccccccccccccccc",
      officialTermsHash: "aaaaaaaaaaaaaaaa",
      publicMarketingHash: "bbbbbbbbbbbbbbbb",
      findingsCount: 1,
      highSeverityCount: 1,
      summary: report.summary,
      timestamp: report.checkedAt,
    });
  });

  it("keeps mainnet reports on mainnet and downgrades local ones to testnet", () => {
    expect(
      buildXLayerPublication(
        reportWithProvenance({ network: "xlayer-mainnet" }),
      ).network,
    ).toBe("xlayer-mainnet");
    expect(
      buildXLayerPublication(reportWithProvenance({ network: "local" }))
        .network,
    ).toBe("xlayer-testnet");
  });

  it("throws when the report has no provenance", () => {
    const report = analyzeClaims(ownershipTerms, ownershipMarketing);

    expect(() => buildXLayerPublication(report)).toThrow(
      /provenance is required/i,
    );
  });
});

describe("buildPublicationChecklist", () => {
  it("marks source, provenance and payload items incomplete without metadata", () => {
    const checklist = buildPublicationChecklist(reportWithProvenance());
    const byKey = Object.fromEntries(
      checklist.map((item) => [item.key, item] as const),
    );

    expect(checklist.map((item) => item.key)).toEqual([
      "source-label",
      "source-url",
      "analysis-provenance",
      "publication-payload",
      "chain-record",
    ]);
    expect(byKey["source-label"].complete).toBe(false);
    expect(byKey["source-url"].complete).toBe(false);
    expect(byKey["analysis-provenance"].complete).toBe(true);
    expect(byKey["analysis-provenance"].detail).toBe(
      "Provider: local, network: xlayer-testnet.",
    );
    expect(byKey["publication-payload"].complete).toBe(false);
    expect(byKey["chain-record"].complete).toBe(false);
    expect(byKey["chain-record"].detail).toMatch(
      /Awaiting a testnet broadcast/,
    );
  });

  it("completes every item for a published report with a payload", () => {
    const report = reportWithProvenance({
      sourceLabel: "Project site",
      sourceUrl: "https://example.com/terms",
      chainRecord: { status: "published", txHash: "0xabc" },
    });
    const checklist = buildPublicationChecklist(
      report,
      buildXLayerPublication(report),
    );

    expect(checklist.every((item) => item.complete)).toBe(true);
    expect(checklist.find((item) => item.key === "source-label")?.detail).toBe(
      "Using Project site",
    );
    expect(checklist.find((item) => item.key === "chain-record")?.detail).toBe(
      "Onchain record marked as published.",
    );
  });

  it("explains a transaction hash that is not marked published yet", () => {
    const report = reportWithProvenance({
      chainRecord: { status: "ready", txHash: "0xabc" },
    });
    const chainRecord = buildPublicationChecklist(report).find(
      (item) => item.key === "chain-record",
    );

    expect(chainRecord?.complete).toBe(true);
    expect(chainRecord?.detail).toMatch(/not marked published yet/);
  });

  it("reports missing provenance", () => {
    const report = analyzeClaims(ownershipTerms, ownershipMarketing);
    const checklist = buildPublicationChecklist(report);

    expect(
      checklist.find((item) => item.key === "analysis-provenance"),
    ).toMatchObject({
      complete: false,
      detail: "Run a report to create provenance.",
    });
  });
});

describe("buildPublishStatus", () => {
  it("is ready when no receipt details are supplied", () => {
    const status = buildPublishStatus(reportWithProvenance());

    expect(status.status).toBe("ready");
    expect(status.network).toBe("xlayer-testnet");
    expect(status.txHash).toBeUndefined();
    expect(status.checklist).toHaveLength(5);
    expect(status.payload.findingsCount).toBe(1);
  });

  it("stays ready when only a transaction hash is known", () => {
    const status = buildPublishStatus(reportWithProvenance(), {
      txHash: "0xabc",
    });

    expect(status.status).toBe("ready");
    expect(status.txHash).toBe("0xabc");
  });

  it("is published once a transaction hash and timestamp exist", () => {
    const status = buildPublishStatus(reportWithProvenance(), {
      txHash: "0xabc",
      explorerUrl: "https://example.com/tx/0xabc",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(status).toMatchObject({
      status: "published",
      txHash: "0xabc",
      explorerUrl: "https://example.com/tx/0xabc",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("rejects an invalid explorer URL", () => {
    expect(() =>
      buildPublishStatus(reportWithProvenance(), {
        txHash: "0xabc",
        explorerUrl: "not-a-url",
        publishedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});
