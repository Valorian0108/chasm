import express, { type Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { analyzeClaims, type AnalysisReport } from "@workspace/api-zod";

vi.mock("../lib/load-env", () => ({ loadEnvFiles: () => {} }));
vi.mock("../lib/logger", () => ({
  logger: { info: () => {}, error: () => {} },
}));

const WALLET = "0xf52a8c9f07446604743ffe60b7fbf75e9d16d9ff";

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
      sourceLabel: "Project site",
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

let app: Express;

beforeAll(async () => {
  vi.stubEnv("ANALYSIS_PROVIDER", "local");
  vi.stubEnv("X_LAYER_WALLET_ADDRESS", WALLET);
  vi.stubEnv("DATABASE_URL", undefined);

  const router = (await import("./index")).default;
  app = express();
  app.use(express.json());
  app.use("/api", router);
});

describe("GET /api/healthz", () => {
  it("reports service health", async () => {
    const response = await request(app).get("/api/healthz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("POST /api/analysis/screen", () => {
  it("returns a report enriched with provenance", async () => {
    const response = await request(app).post("/api/analysis/screen").send({
      officialTerms:
        "Holders receive contractual economic exposure with no voting rights.",
      publicMarketing: "Own a piece of the company with real shares.",
      sourceLabel: "Project site",
    });

    expect(response.status).toBe(200);
    expect(response.body.findings).toHaveLength(1);
    expect(response.body.provenance).toMatchObject({
      provider: "local",
      network: "local",
      sourceLabel: "Project site",
      chainRecord: { status: "not_started" },
    });
    expect(response.body.provenance.hashes.report).toMatch(/^[0-9a-f]{16}$/);
  });

  it("rejects a request with empty sources", async () => {
    const response = await request(app)
      .post("/api/analysis/screen")
      .send({ officialTerms: "  ", publicMarketing: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid analysis request");
    expect(response.body.details).toBeDefined();
  });
});

describe("POST /api/analysis/publish-prep", () => {
  it("returns the compact publication payload", async () => {
    const response = await request(app)
      .post("/api/analysis/publish-prep")
      .send(report());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ready",
      payload: {
        network: "xlayer-testnet",
        reportHash: "cccccccccccccccc",
        highSeverityCount: 1,
      },
    });
  });

  it("rejects an invalid report", async () => {
    const response = await request(app)
      .post("/api/analysis/publish-prep")
      .send({ status: "flagged" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid analysis report");
  });
});

describe("POST /api/analysis/publish", () => {
  it("prepares a publish status without a receipt", async () => {
    const response = await request(app)
      .post("/api/analysis/publish")
      .send(report());

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ready");
    expect(response.body.nextAction).toContain("X Layer testnet");
  });

  it("finalizes a publish status from a nested receipt", async () => {
    const response = await request(app)
      .post("/api/analysis/publish")
      .send({ report: report(), receipt: { txHash: "0xabc" } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "published",
      txHash: "0xabc",
    });
  });

  it("accepts receipt fields at the top level", async () => {
    const response = await request(app)
      .post("/api/analysis/publish")
      .send({ ...report(), txHash: "0xdef" });

    expect(response.status).toBe(200);
    expect(response.body.txHash).toBe("0xdef");
  });

  it("rejects an invalid receipt", async () => {
    const response = await request(app)
      .post("/api/analysis/publish")
      .send({ report: report(), receipt: { txHash: "" } });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid publish receipt");
  });

  it("rejects an invalid report", async () => {
    const response = await request(app)
      .post("/api/analysis/publish")
      .send({ report: { score: 1 } });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid analysis report");
  });
});

describe("/api/analysis/records", () => {
  it("saves to the in-memory store and lists it back", async () => {
    const created = await request(app)
      .post("/api/analysis/records")
      .send(report({ chainRecord: { status: "published", txHash: "0xabc" } }));

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: "saved",
      record: {
        provider: "local",
        network: "xlayer-testnet",
        findingsCount: 1,
        highSeverityCount: 1,
        txHash: "0xabc",
      },
    });
    expect(JSON.parse(created.body.record.publicationPayload).network).toBe(
      "xlayer-testnet",
    );

    const listed = await request(app).get("/api/analysis/records");

    expect(listed.status).toBe(200);
    expect(listed.body.status).toBe("ok");
    expect(listed.body.records[0]).toMatchObject({ txHash: "0xabc" });
  });

  it("rejects an invalid report", async () => {
    const response = await request(app)
      .post("/api/analysis/records")
      .send({ findings: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid analysis report");
  });
});

describe("X Layer routes", () => {
  it("exposes the network configuration", async () => {
    const response = await request(app).get("/api/xlayer/config");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.xLayer.networks["xlayer-testnet"].chainId).toBe(1952);
  });

  it("exposes publish readiness", async () => {
    const response = await request(app).get("/api/xlayer/readiness");

    expect(response.status).toBe(200);
    expect(response.body.readiness).toMatchObject({
      ready: false,
      missing: ["contractAddress"],
    });
  });
});
