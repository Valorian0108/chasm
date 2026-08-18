import { describe, expect, it, vi } from "vitest";
import { analyzeClaims, type AnalysisReport } from "@workspace/api-zod";
import { createXLayerPublisher } from "./xlayer-publisher";

vi.mock("../lib/load-env", () => ({ loadEnvFiles: () => {} }));

const publisher = createXLayerPublisher();

function report(
  provenance: Partial<NonNullable<AnalysisReport["provenance"]>> = {},
): AnalysisReport {
  const base = analyzeClaims(
    "Holders receive contractual economic exposure with no voting rights.",
    "Own a piece of the company with real shares.",
  );

  return {
    ...base,
    provenance: {
      provider: "local",
      network: "xlayer-testnet",
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

describe("prepare", () => {
  it("returns a ready status with the testnet wallet next action", () => {
    const status = publisher.prepare(report());

    expect(status.status).toBe("ready");
    expect(status.network).toBe("xlayer-testnet");
    expect(status.nextAction).toBe(
      "Send the payload through the X Layer testnet wallet flow to broadcast the transaction.",
    );
    expect(status.payload.reportHash).toBe("cccccccccccccccc");
  });

  it("uses the mainnet label for mainnet reports", () => {
    const status = publisher.prepare(report({ network: "xlayer-mainnet" }));

    expect(status.network).toBe("xlayer-mainnet");
    expect(status.nextAction).toContain("X Layer mainnet");
  });
});

describe("finalize", () => {
  it("marks the report published from a receipt", () => {
    const status = publisher.finalize(report(), {
      receipt: {
        txHash: "0xabc",
        explorerUrl: "https://explorer.example.com/tx/0xabc",
        publishedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(status).toMatchObject({
      status: "published",
      txHash: "0xabc",
      explorerUrl: "https://explorer.example.com/tx/0xabc",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(status.nextAction).toBe(
      "Track the confirmed transaction on the X Layer testnet explorer.",
    );
  });

  it("falls back to the network explorer URL when the receipt omits one", () => {
    const status = publisher.finalize(report(), {
      receipt: { txHash: "0xabc" },
    });

    expect(status.explorerUrl).toBe(
      "https://www.okx.com/web3/explorer/xlayer-test",
    );
    expect(status.status).toBe("published");
  });

  it("reuses a transaction hash already stored on the report", () => {
    const status = publisher.finalize(
      report({
        chainRecord: {
          status: "published",
          txHash: "0xdef",
          explorerUrl: "https://explorer.example.com/tx/0xdef",
          publishedAt: "2026-02-02T00:00:00.000Z",
        },
      }),
    );

    expect(status.txHash).toBe("0xdef");
    expect(status.status).toBe("published");
    expect(status.nextAction).toContain("Track the confirmed transaction");
  });

  it("stays ready when there is no receipt and no chain record", () => {
    const status = publisher.finalize(report());

    expect(status.status).toBe("ready");
    expect(status.txHash).toBeUndefined();
    expect(status.explorerUrl).toBe(
      "https://www.okx.com/web3/explorer/xlayer-test",
    );
    expect(status.nextAction).toContain("wallet flow");
  });

  it("rejects an invalid receipt", () => {
    expect(() =>
      publisher.finalize(report(), {
        receipt: { txHash: "", publishedAt: "not-a-date" },
      }),
    ).toThrow();
  });

  it("uses the mainnet explorer for mainnet reports", () => {
    const status = publisher.finalize(report({ network: "xlayer-mainnet" }), {
      receipt: { txHash: "0xabc" },
    });

    expect(status.explorerUrl).toBe("https://www.okx.com/web3/explorer/xlayer");
    expect(status.nextAction).toContain("X Layer mainnet");
  });
});
