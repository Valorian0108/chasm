import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisRequest } from "@workspace/api-zod";

vi.mock("../lib/load-env", () => ({ loadEnvFiles: () => {} }));

const request: AnalysisRequest = {
  officialTerms:
    "Holders receive contractual economic exposure with no voting rights.",
  publicMarketing: "Own a piece of the company with real shares.",
};

const aiReport = {
  checkedAt: "2026-01-01T00:00:00.000Z",
  status: "flagged",
  score: 40,
  summary: "AI summary",
  findings: [
    {
      title: "AI finding",
      severity: "high",
      marketingQuote: "Own a piece of the company",
      termsQuote: "contractual economic exposure",
      explanation: "Mismatch",
      confidence: 90,
    },
  ],
};

function chatCompletion(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

async function importEngine() {
  vi.resetModules();
  return import("./analysis-engine");
}

beforeEach(() => {
  for (const key of [
    "ANALYSIS_PROVIDER",
    "AI_BASE_URL",
    "AI_API_KEY",
    "AI_MODEL",
    "OPENAI_BASE_URL",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
  ]) {
    vi.stubEnv(key, undefined);
  }
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createAnalysisEngine", () => {
  it("uses the local ruleset when the provider is local", async () => {
    vi.stubEnv("ANALYSIS_PROVIDER", "local");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { createAnalysisEngine } = await importEngine();
    const engine = createAnalysisEngine();
    const result = await engine.analyze(request);

    expect(engine.provider).toBe("local");
    expect(result.provider).toBe("local");
    expect(result.report.findings[0].severity).toBe("high");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to local screening when no API key is configured", async () => {
    const { createAnalysisEngine } = await importEngine();
    const engine = createAnalysisEngine();
    const result = await engine.analyze(request);

    expect(engine.provider).toBe("fallback");
    expect(result.provider).toBe("fallback");
    expect(result.report.findings).not.toHaveLength(0);
  });

  it("calls the configured AI endpoint and returns the parsed report", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_BASE_URL", "https://ai.example.com/");
    vi.stubEnv("AI_MODEL", "test-model");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(chatCompletion(JSON.stringify(aiReport)));

    const { createAnalysisEngine } = await importEngine();
    const engine = createAnalysisEngine();
    const result = await engine.analyze(request);

    expect(engine.provider).toBe("ai");
    expect(result.provider).toBe("ai");
    expect(result.report.summary).toBe("AI summary");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ai.example.com/v1/chat/completions");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.model).toBe("test-model");
    expect(body.messages[1].content).toContain(request.publicMarketing);
    expect(
      (init as RequestInit & { headers: Record<string, string> }).headers
        .authorization,
    ).toBe("Bearer test-key");
  });

  it("supports the OpenAI-style env aliases and default model", async () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(chatCompletion(JSON.stringify(aiReport)));

    const { createAnalysisEngine } = await importEngine();
    await createAnalysisEngine().analyze(request);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(JSON.parse(String((init as RequestInit).body)).model).toBe(
      "gpt-4.1-mini",
    );
  });

  it("strips markdown code fences from the AI response", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      chatCompletion(`\`\`\`json\n${JSON.stringify(aiReport)}\n\`\`\``),
    );

    const { createAnalysisEngine } = await importEngine();
    const result = await createAnalysisEngine().analyze(request);

    expect(result.provider).toBe("ai");
    expect(result.report.summary).toBe("AI summary");
  });

  it("falls back to local screening on a non-ok AI response", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as unknown as Response);

    const { createAnalysisEngine } = await importEngine();
    const result = await createAnalysisEngine().analyze(request);

    expect(result.provider).toBe("fallback");
    expect(result.report.findings[0].severity).toBe("high");
  });

  it("falls back when the AI returns no content", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    } as unknown as Response);

    const { createAnalysisEngine } = await importEngine();
    const result = await createAnalysisEngine().analyze(request);

    expect(result.provider).toBe("fallback");
  });

  it("falls back when the AI payload does not match the report schema", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      chatCompletion(JSON.stringify({ status: "flagged" })),
    );

    const { createAnalysisEngine } = await importEngine();
    const result = await createAnalysisEngine().analyze(request);

    expect(result.provider).toBe("fallback");
  });

  it("falls back when the request itself throws", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const { createAnalysisEngine } = await importEngine();
    const result = await createAnalysisEngine().analyze(request);

    expect(result.provider).toBe("fallback");
  });
});
