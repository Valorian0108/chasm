import {
  analyzeClaims,
  type AnalysisRequest,
  type AnalysisReport,
  analysisReportSchema,
} from "@workspace/api-zod";

export type AnalysisProvider = "local" | "ai" | "fallback";

export type AnalysisEngine = {
  provider: AnalysisProvider;
  analyze: (
    request: AnalysisRequest,
  ) => Promise<{ report: AnalysisReport; provider: AnalysisProvider }>;
};

function normalizeAiContent(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return trimmed;
}

export function createAnalysisEngine(): AnalysisEngine {
  const provider = (process.env.ANALYSIS_PROVIDER ?? "ai") as AnalysisProvider;

  if (provider === "ai") {
    const aiBaseUrl =
      process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
    const aiApiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
    const aiModel = process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

    if (!aiBaseUrl || !aiApiKey) {
      return {
        provider: "fallback",
        analyze: async (request) => ({
          report: analyzeClaims(request.officialTerms, request.publicMarketing),
          provider: "fallback",
        }),
      };
    }

    return {
      provider: "ai",
      analyze: async (request) => {
        try {
          const response = await fetch(`${aiBaseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${aiApiKey}`,
            },
            body: JSON.stringify({
              model: aiModel,
              temperature: 0.2,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content:
                    "You are a precise screening assistant. Compare public marketing against official terms and return ONLY valid JSON matching this shape: {checkedAt,status,score,summary,findings:[{title,severity,marketingQuote,termsQuote,explanation,confidence}]}. Use severity values high, medium, low. Keep quotes short and grounded in the supplied text. Do not add markdown or extra keys.",
                },
                {
                  role: "user",
                  content: JSON.stringify({
                    officialTerms: request.officialTerms,
                    publicMarketing: request.publicMarketing,
                  }),
                },
              ],
            }),
          });

          if (!response.ok) {
            throw new Error(`AI provider returned ${response.status}`);
          }

          const payload = (await response.json()) as {
            choices?: Array<{
              message?: {
                content?: string;
              };
            }>;
          };

          const content = payload.choices?.[0]?.message?.content;

          if (!content) {
            throw new Error("AI provider returned no content");
          }

          const parsed = analysisReportSchema.parse(
            JSON.parse(normalizeAiContent(content)),
          );
          return {
            report: parsed as AnalysisReport,
            provider: "ai",
          };
        } catch (error) {
          console.warn("Falling back to local screening", error);
          return {
            report: analyzeClaims(
              request.officialTerms,
              request.publicMarketing,
            ),
            provider: "fallback",
          };
        }
      },
    };
  }

  return {
    provider: "local",
    analyze: async (request) => ({
      report: analyzeClaims(request.officialTerms, request.publicMarketing),
      provider: "local",
    }),
  };
}
