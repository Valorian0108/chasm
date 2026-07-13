import time

from agents.social_ai import analyze_social
from agents.docs import get_token_docs


def analyze(token):

    print(f"🔍 Social Agent is researching {token}...")

    time.sleep(1)

    # Get official social links from the Docs Agent helper
    docs = get_token_docs(token)

    twitter = docs.get("twitter")
    telegram = docs.get("telegram")

    # Ask Gemini to analyze the community
    ai = analyze_social(twitter, telegram)

    return {
        "data": {
            "community": ai.get("community", "Unknown"),
            "twitter": twitter or "N/A",
            "telegram": telegram or "N/A",
            "sentiment": ai.get("sentiment", "Unknown"),
            "confidence": ai.get("confidence", 0),
            "summary": ai.get("summary", "No summary available.")
        },

        "summary": ai.get("summary", "No summary available."),

        "confidence": ai.get("confidence", 0),

        "reasoning": [
            f"Community: {ai.get('community', 'Unknown')}",
            f"Sentiment: {ai.get('sentiment', 'Unknown')}",
            f"Twitter: {twitter or 'N/A'}",
            f"Telegram: {telegram or 'N/A'}"
        ],

        "next_agents": ai.get("next_agents", [])
    }