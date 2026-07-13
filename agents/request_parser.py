from google import genai
from dotenv import load_dotenv
import json
import os

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def parse(request):

    prompt = f"""
You are an AI request parser for a crypto assistant.

Extract:

1. The token name or symbol.
2. The user's intent.

Return ONLY JSON.

Example:

User:
Should I buy PEPE?

Output:

{{
    "token":"PEPE",
    "intent":"buy advice"
}}
    
User:
How risky is BONK?

Output:

{{
    "token":"BONK",
    "intent":"risk analysis"
}}

User:

{request}
"""

    response = client.models.generate_content(
        model="models/gemini-flash-latest",
        contents=prompt
    )

    text = response.text.strip()

    if text.startswith("```json"):
        text = text.replace("```json", "").replace("```", "").strip()
    elif text.startswith("```"):
        text = text.replace("```", "").strip()

    return json.loads(text)