const JSON_HEADERS = {
  "content-type": "application/json",
};

const MAX_SOURCE_TEXT_CHARS = 20_000;
const MAX_SOURCE_LABEL_CHARS = 200;
const MAX_URL_CHARS = 2_048;
const MAX_BODY_BYTES = 256 * 1024;

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates the untrusted request body and returns either an error message or a
 * normalized request with bounded field sizes.
 */
function parseScreeningRequest(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Request body must be a JSON object" };
  }

  const { officialTerms, publicMarketing, sourceLabel, sourceUrl, targetNetwork } = body;

  if (typeof officialTerms !== "string" || typeof publicMarketing !== "string") {
    return { error: "officialTerms and publicMarketing are required" };
  }

  const terms = officialTerms.trim();
  const marketing = publicMarketing.trim();

  if (!terms || !marketing) {
    return { error: "officialTerms and publicMarketing are required" };
  }

  if (terms.length > MAX_SOURCE_TEXT_CHARS || marketing.length > MAX_SOURCE_TEXT_CHARS) {
    return {
      error: `officialTerms and publicMarketing must each be ${MAX_SOURCE_TEXT_CHARS} characters or fewer`,
    };
  }

  if (
    sourceLabel !== undefined &&
    (typeof sourceLabel !== "string" || sourceLabel.length > MAX_SOURCE_LABEL_CHARS)
  ) {
    return { error: "sourceLabel must be a string of 200 characters or fewer" };
  }

  if (
    sourceUrl !== undefined &&
    (typeof sourceUrl !== "string" || sourceUrl.length > MAX_URL_CHARS || !isHttpUrl(sourceUrl))
  ) {
    return { error: "sourceUrl must be an http or https URL" };
  }

  if (
    targetNetwork !== undefined &&
    !["local", "xlayer-testnet", "xlayer-mainnet"].includes(targetNetwork)
  ) {
    return { error: "targetNetwork is not supported" };
  }

  return {
    request: {
      officialTerms: terms,
      publicMarketing: marketing,
      sourceLabel,
      sourceUrl,
      targetNetwork,
    },
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
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

function localAnalyze(officialTerms, publicMarketing) {
  const legal = officialTerms.toLowerCase();
  const marketing = publicMarketing.toLowerCase();
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
    status: highCount > 0 ? "flagged" : findings.some((finding) => finding.severity === "medium") ? "flagged" : "clear",
    score,
    summary:
      highCount > 0
        ? `${highCount} high-severity promise${highCount === 1 ? "" : "s"} conflict with or exceed the supplied terms.`
        : "No strong mismatch found by the local screening rules.",
    findings,
  };
}

function withProvenance(report, request, provider) {
  const officialTermsHash = fingerprintHex(request.officialTerms);
  const publicMarketingHash = fingerprintHex(request.publicMarketing);

  return {
    ...report,
    provenance: {
      provider,
      network: request.targetNetwork ?? "xlayer-testnet",
      sourceLabel: request.sourceLabel,
      sourceUrl: request.sourceUrl,
      hashes: {
        officialTerms: officialTermsHash,
        publicMarketing: publicMarketingHash,
        report: fingerprintHex(JSON.stringify(report)),
      },
      chainRecord: {
        status: "not_started",
      },
    },
  };
}

function coerceAiReport(value) {
  const findings = Array.isArray(value.findings) ? value.findings : [];

  return {
    checkedAt: typeof value.checkedAt === "string" ? value.checkedAt : new Date().toISOString(),
    status: value.status === "clear" ? "clear" : "flagged",
    score:
      Number.isInteger(value.score) && value.score >= 0 && value.score <= 100
        ? value.score
        : 50,
    summary: typeof value.summary === "string" && value.summary.trim() ? value.summary : "AI screening completed.",
    findings: findings.map((finding) => ({
      title: String(finding.title ?? "Potential claim mismatch"),
      severity:
        finding.severity === "high" || finding.severity === "medium" || finding.severity === "low"
          ? finding.severity
          : "medium",
      marketingQuote: String(finding.marketingQuote ?? "").slice(0, 320),
      termsQuote: String(finding.termsQuote ?? "").slice(0, 320),
      explanation: String(finding.explanation ?? "Review this claim against the supplied terms."),
      confidence:
        Number.isInteger(finding.confidence) && finding.confidence >= 0 && finding.confidence <= 100
          ? finding.confidence
          : 75,
    })),
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "{}";

  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return json(413, { error: "Request body is too large" });
  }

  let body;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const parsed = parseScreeningRequest(body);

  if (parsed.error) {
    return json(400, { error: parsed.error });
  }

  const request = parsed.request;

  const aiApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const aiBaseUrl = process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || "https://api.openai.com";
  const aiModel = process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4.1-mini";

  if (!aiApiKey) {
    return json(200, withProvenance(localAnalyze(request.officialTerms, request.publicMarketing), request, "fallback"));
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
      throw new Error("AI provider returned no content");
    }

    const report = coerceAiReport(JSON.parse(normalizeAiContent(content)));
    return json(200, withProvenance(report, request, "ai"));
  } catch (error) {
    console.warn("Falling back to local screening", error);
    return json(200, withProvenance(localAnalyze(request.officialTerms, request.publicMarketing), request, "fallback"));
  }
}
