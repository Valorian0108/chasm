const JSON_HEADERS = {
  "content-type": "application/json",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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

function findSentence(text, pattern) {
  return String(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .find((sentence) => pattern.test(sentence))
    ?.trim();
}

function fingerprintHex(value) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, "0");
}

function analyzeClaims(officialTerms, publicMarketing) {
  const marketing = publicMarketing.toLowerCase();
  const legal = officialTerms.toLowerCase();
  const findings = [];

  if (
    /guaranteed|guarantee|zero risk|no risk|risk-free|safe passive|passive income|fixed return|fixed yield/.test(
      marketing,
    ) &&
    /not guaranteed|variable|may lose|lose funds|market risk|risk|not insured|not protected/.test(
      legal,
    )
  ) {
    findings.push({
      title: "Guaranteed return language conflicts with risk disclosures",
      severity: "high",
      marketingQuote:
        findSentence(
          publicMarketing,
          /guaranteed|guarantee|zero risk|no risk|risk-free|safe passive|passive income|fixed return|fixed yield/i,
        ) || "Earn guaranteed passive income with zero risk.",
      termsQuote:
        findSentence(
          officialTerms,
          /not guaranteed|variable|may lose|lose funds|market risk|risk|not insured|not protected/i,
        ) ||
        "Rewards are variable and not guaranteed. Users may lose funds due to market risk.",
      explanation:
        "The marketing promises certainty and safety, while the terms say rewards can vary, are not guaranteed, and users may lose funds.",
      confidence: 97,
    });
  }

  if (
    /community-owned|routes? .*value|protocol value|ecosystem pool|fee-splitting|buybacks|holding and staking|people holding|perpetual.*engine/.test(
      marketing,
    ) &&
    /zero equity rights|zero legal claims|no governance|no investor protections|memecoin|experimental/.test(
      legal,
    )
  ) {
    findings.push({
      title: "Community value language outpaces holder rights",
      severity: "high",
      marketingQuote:
        findSentence(
          publicMarketing,
          /community-owned|routes? .*value|protocol value|ecosystem pool|fee-splitting|buybacks|holding and staking|people holding|perpetual.*engine/i,
        ) ||
        "We are building a perpetual, community-owned engine that routes real protocol value directly back to the people holding and staking.",
      termsQuote:
        findSentence(
          officialTerms,
          /zero equity rights|zero legal claims|no governance|no investor protections|memecoin|experimental/i,
        ) ||
        "Holders have zero equity rights, zero legal claims to revenue, and no governance voting rights.",
      explanation:
        "The marketing frames holders as sharing in a community value engine, while the terms deny equity, revenue claims, governance rights, and formal protections.",
      confidence: 91,
    });
  }

  if (!findings.length) {
    findings.push({
      title: "No strong mismatch found",
      severity: "low",
      marketingQuote: publicMarketing.trim().split(/\n+/)[0]?.slice(0, 160) ?? "",
      termsQuote: officialTerms.trim().split(/\n+/)[0]?.slice(0, 160) ?? "",
      explanation:
        "The checker did not find a strong mismatch between the two boxes. This is a screening result, not a final verdict; review nuanced or implied claims manually.",
      confidence: 63,
    });
  }

  const highCount = findings.filter((finding) => finding.severity === "high").length;
  const score =
    findings[0]?.title === "No strong mismatch found"
      ? 86
      : Math.max(
          18,
          Math.round(
            100 -
              findings.reduce((total, finding) => {
                if (finding.severity === "high") return total + 19;
                if (finding.severity === "medium") return total + 11;
                return total + 5;
              }, 0),
          ),
        );

  return {
    checkedAt: new Date().toISOString(),
    status:
      highCount > 0
        ? "flagged"
        : findings.some((finding) => finding.severity === "medium")
          ? "flagged"
          : "clear",
    score,
    summary:
      highCount > 0
        ? `${highCount} high-severity promise${highCount === 1 ? "" : "s"} conflict with or exceed the supplied terms.`
        : "No strong mismatch found by the local screening rules.",
    findings,
  };
}

function buildProvenance(request, report, provider) {
  return {
    provider,
    network: request.targetNetwork ?? "local",
    sourceLabel: request.sourceLabel,
    sourceUrl: request.sourceUrl,
    hashes: {
      officialTerms: fingerprintHex(request.officialTerms),
      publicMarketing: fingerprintHex(request.publicMarketing),
      report: fingerprintHex(JSON.stringify(report)),
    },
    chainRecord: {
      status: "not_started",
    },
  };
}

function normalizeReport(value) {
  const findings = Array.isArray(value?.findings) ? value.findings : [];

  return {
    checkedAt: isNonEmptyString(value?.checkedAt) ? value.checkedAt : new Date().toISOString(),
    status: value?.status === "clear" ? "clear" : "flagged",
    score: Number.isInteger(value?.score) && value.score >= 0 && value.score <= 100 ? value.score : 50,
    summary: isNonEmptyString(value?.summary) ? value.summary : "AI screening completed.",
    findings: findings.map((finding) => ({
      title: String(finding?.title ?? "Potential claim mismatch"),
      severity:
        finding?.severity === "high" || finding?.severity === "medium" || finding?.severity === "low"
          ? finding.severity
          : "medium",
      marketingQuote: String(finding?.marketingQuote ?? "").slice(0, 320),
      termsQuote: String(finding?.termsQuote ?? "").slice(0, 320),
      explanation: String(finding?.explanation ?? "Review this claim against the supplied terms."),
      confidence:
        Number.isInteger(finding?.confidence) && finding.confidence >= 0 && finding.confidence <= 100
          ? finding.confidence
          : 75,
    })),
  };
}

async function analyzeWithAi(request) {
  const aiApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const aiBaseUrl = process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || "https://api.openai.com";
  const aiModel = process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4.1-mini";

  if (!aiApiKey) {
    const report = analyzeClaims(request.officialTerms, request.publicMarketing);
    return {
      ...report,
      provenance: buildProvenance(request, report, "fallback"),
    };
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

    const report = normalizeReport(JSON.parse(normalizeAiContent(content)));
    return {
      ...report,
      provenance: buildProvenance(request, report, "ai"),
    };
  } catch (error) {
    console.warn("Unable to analyze with AI provider, falling back to local rules", error);
    const report = analyzeClaims(request.officialTerms, request.publicMarketing);
    return {
      ...report,
      provenance: buildProvenance(request, report, "fallback"),
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }
  }

  if (!isNonEmptyString(body?.officialTerms) || !isNonEmptyString(body?.publicMarketing)) {
    return json(400, {
      error: "officialTerms and publicMarketing are required",
    });
  }

  const request = {
    officialTerms: body.officialTerms.trim(),
    publicMarketing: body.publicMarketing.trim(),
    sourceLabel: isNonEmptyString(body?.sourceLabel) ? body.sourceLabel.trim() : undefined,
    sourceUrl: isNonEmptyString(body?.sourceUrl) ? body.sourceUrl.trim() : undefined,
    targetNetwork:
      body?.targetNetwork === "xlayer-testnet" || body?.targetNetwork === "xlayer-mainnet"
        ? body.targetNetwork
        : "local",
  };

  const report = await analyzeWithAi(request);
  return json(200, report);
}
