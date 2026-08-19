import {
  analyzeClaims,
  analysisReportSchema,
  analysisRequestSchema,
  buildAnalysisProvenance,
} from "@workspace/api-zod";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function normalizeAiContent(content) {
  const trimmed = String(content ?? "").trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return trimmed;
}

async function buildFallbackResponse(request) {
  const report = analyzeClaims(request.officialTerms, request.publicMarketing);
  const provenance = await buildAnalysisProvenance(request, report, {
    provider: "fallback",
    network: request.targetNetwork ?? "local",
  });

  return {
    ...report,
    provenance,
  };
}

async function buildAiResponse(request) {
  const aiApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const aiBaseUrl =
    process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || "https://api.openai.com";
  const aiModel = process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4.1-mini";

  if (!aiApiKey) {
    return buildFallbackResponse(request);
  }

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
              "You are Claims Checker, a precise AI screening assistant for Web3 claims. Compare PUBLIC MARKETING against OFFICIAL TERMS. Treat official terms as the rulebook and marketing as the public promise. Focus on overpromises, guaranteed returns, safety claims, ownership, revenue rights, governance rights, backing, liquidity, and claims that outpace disclosures. Return ONLY valid JSON with keys checkedAt,status,score,summary,findings. findings must contain title,severity,marketingQuote,termsQuote,explanation,confidence. Use severity high, medium, or low. Quote only supplied text.",
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

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI provider returned no message content");
    }

    const parsed = analysisReportSchema.parse(JSON.parse(normalizeAiContent(content)));
    const provenance = await buildAnalysisProvenance(request, parsed, {
      provider: "ai",
      network: request.targetNetwork ?? "local",
    });

    return {
      ...parsed,
      provenance,
    };
  } catch (error) {
    console.warn("Unable to analyze with AI provider, falling back to local rules", error);
    return buildFallbackResponse(request);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }
  }

  const parsedRequest = analysisRequestSchema.safeParse(body ?? {});

  if (!parsedRequest.success) {
    sendJson(res, 400, {
      error: "officialTerms and publicMarketing are required",
    });
    return;
  }

  const report = await buildAiResponse(parsedRequest.data);
  sendJson(res, 200, report);
}
