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
You are the Chief Investment Officer (CIO) of a crypto investment fund.

Your specialist AI analysts have already analyzed this token.

========================

WALLET AGENT

Summary:
{wallet.get("summary", "Unknown")}

Confidence:
{wallet.get("confidence", 0)}

Reasoning:
{wallet.get("reasoning", [])}

========================

RISK AGENT

Summary:
{risk.get("summary", "Unknown")}

Confidence:
{risk.get("confidence", 0)}

Reasoning:
{risk.get("reasoning", [])}

========================

SOCIAL AGENT

Summary:
{social.get("summary", "Unknown")}

Confidence:
{social.get("confidence", 0)}

Reasoning:
{social.get("reasoning", [])}

========================

DOCS AGENT

Summary:
{docs.get("summary", "Unknown")}

Confidence:
{docs.get("confidence", 0)}

Reasoning:
{docs.get("reasoning", [])}

========================

Based ONLY on these reports, produce an investment recommendation.

Return ONLY valid JSON.

Example:

{{
    "score": 88,
    "recommendation": "BUY",
    "confidence": 0.86,
    "strengths": [
        "High liquidity",
        "Strong community"
    ],
    "weaknesses": [
        "Speculative meme token"
    ],
    "summary": "Overall this token demonstrates strong fundamentals relative to similar meme projects."
}}
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
        print(f"⚠️ Decision AI unavailable: {e}")
        return {
            "score": None,
            "recommendation": "UNAVAILABLE",
            "confidence": 0,
            "strengths": [],
            "weaknesses": [],
            "summary": "The Investment Committee could not generate a recommendation because the AI service is temporarily unavailable."
        }