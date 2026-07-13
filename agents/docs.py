import requests


def get_token_docs(token):

    url = f"https://api.dexscreener.com/latest/dex/search?q={token}"

    response = requests.get(url)
    data = response.json()

    if not data["pairs"]:
        return {}

    pair = data["pairs"][0]

    info = pair.get("info", {})

    websites = info.get("websites", [])
    socials = info.get("socials", [])

    website = "Unknown"
    twitter = None
    telegram = None

    if websites:
        website = websites[0].get("url", "Unknown")

    for social in socials:

        if social["type"] == "twitter":
            twitter = social["url"]

        elif social["type"] == "telegram":
            telegram = social["url"]

    return {
        "website": website,
        "twitter": twitter,
        "telegram": telegram
    }


def analyze(token):

    print(f"📚 Docs Agent is reading documents for {token}...")

    docs = get_token_docs(token)
    website = docs.get("website")
    twitter = docs.get("twitter")
    telegram = docs.get("telegram")

    # The dexscreener response does not include explicit whitepaper/roadmap fields
    whitepaper = None
    roadmap = None

    return {
        "data": {
            "website": website,
            "whitepaper": whitepaper,
            "roadmap": roadmap,
            "twitter": twitter,
            "telegram": telegram,
        },

        "summary": (
            "Official documentation was successfully located."
            if website != "Unknown"
            else "No official documentation found."
        ),

        "confidence": 0.85 if website != "Unknown" else 0.40,

        "reasoning": [
            f"Website: {website}",
            f"Whitepaper: {whitepaper}",
            f"Roadmap: {roadmap}"
        ],

        "next_agents": []
    }