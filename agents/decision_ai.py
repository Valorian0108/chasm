from google import genai
from dotenv import load_dotenv
import os
import json

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def analyze(report):

    wallet = report.get("wallet", {})
    risk = report.get("risk", {})
    social = report.get("social", {})
    docs = report.get("docs", {})

    prompt = f"""
You are the Investment Committee of AEGIS, an institutional crypto research committee.

Your job is to synthesize the specialist reports below into a disciplined investment view.
Do not rewrite the reports. Do not invent facts. Do not infer facts that are not supported.
If evidence is missing, weak, mixed, or conflicting, explicitly say so.
Every conclusion must be based only on the supplied department reports.

Reasoning framework:
1. Evaluate contract risk.
2. Evaluate on-chain health.
3. Evaluate community quality.
4. Evaluate documentation maturity.
5. Identify conflicting evidence.
6. Produce an investment thesis.
7. Recommend BUY, HOLD, or AVOID.

Scoring rubric:
90-100 = Exceptional
80-89 = Strong
70-79 = Promising but speculative
60-69 = Mixed
40-59 = High risk
0-39 = Avoid

Department reports:

RISK / CONTRACT SAFETY
Summary:
{risk.get("summary", "Unknown")}

Confidence:
{risk.get("confidence", 0)}

Reasoning:
{risk.get("reasoning", [])}

========================

ON-CHAIN / WALLET HEALTH
Summary:
{wallet.get("summary", "Unknown")}

Confidence:
{wallet.get("confidence", 0)}

Reasoning:
{wallet.get("reasoning", [])}

========================

COMMUNITY QUALITY
Summary:
{social.get("summary", "Unknown")}

Confidence:
{social.get("confidence", 0)}

Reasoning:
{social.get("reasoning", [])}

========================

DOCUMENTATION MATURITY
Summary:
{docs.get("summary", "Unknown")}

Confidence:
{docs.get("confidence", 0)}

Reasoning:
{docs.get("reasoning", [])}

========================

Return ONLY valid JSON matching this exact schema:

{{
    "score": 88,
    "recommendation": "BUY",
    "confidence": 0.86,
    "risk_level": "LOW",
    "investment_thesis": "Concise institutional thesis grounded only in the supplied reports.",
    "strengths": [
        "High liquidity"
    ],
    "weaknesses": [
        "Documentation is incomplete"
    ],
    "red_flags": [
        "Conflicting evidence across reports"
    ],
    "next_steps": [
        "Verify contract ownership"
    ],
    "summary": "Overall committee conclusion."
}}

Use these exact recommendation values only: BUY, HOLD, AVOID.
Use these exact risk_level values only: LOW, MEDIUM, HIGH, UNKNOWN.
If evidence is missing or conflicting, say so plainly in the thesis, red flags, or summary.
"""

    try:
        response = client.models.generate_content(
            model="models/gemini-flash-latest",
            contents=prompt
        )

        text = response.text.strip()

        # Gemini sometimes wraps JSON in markdown
        if text.startswith("```json"):
            text = text.replace("```json", "").replace("```", "").strip()
        elif text.startswith("```"):
            text = text.replace("```", "").strip()

        return json.loads(text)

    except Exception as e:
        print(f"Warning: Decision AI unavailable: {e}")
        return {
            "score": 0,
            "recommendation": "AVOID",
            "confidence": 0.0,
            "risk_level": "UNKNOWN",
            "investment_thesis": (
                "The Investment Committee could not produce an evidence-based thesis "
                "because the AI service is temporarily unavailable."
            ),
            "strengths": [],
            "weaknesses": [],
            "red_flags": [],
            "next_steps": [],
            "summary": (
                "The Investment Committee could not generate a recommendation because "
                "the AI service is temporarily unavailable."
            ),
        }
