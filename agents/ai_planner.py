from google import genai
from dotenv import load_dotenv
import json
import os

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def analyze(request):

    prompt = f"""
You are an AI planner for a crypto research system.

Available agents:

- wallet
- risk
- social
- docs

User request:

{request}

Choose ONLY the agents needed.

Return ONLY JSON.

Example:

{{
    "agents": ["wallet", "risk"]
}}
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

    return json.loads(text)["agents"]