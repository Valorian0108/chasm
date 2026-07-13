from google import genai
from dotenv import load_dotenv
import os
import json

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def analyze_social(twitter, telegram):

    prompt = f"""
You are an experienced crypto research analyst.

Official Twitter:
{twitter}

Official Telegram:
{telegram}

Analyze the project's community based only on these links.

Return ONLY valid JSON in this format:

{{
    "community": "Strong",
    "sentiment": "Bullish",
    "confidence": 0.85,
    "summary": "Large active community with official social channels."
}}
"""

    response = client.models.generate_content(
        model="models/gemini-flash-latest",
        contents=prompt
    )

    text = response.text.strip()

    # Remove markdown if Gemini wraps the JSON
    if text.startswith("```json"):
        text = text.replace("```json", "").replace("```", "").strip()
    elif text.startswith("```"):
        text = text.replace("```", "").strip()

    return json.loads(text)