import time
import requests

def analyze(token):

    print(f"💰 Wallet Agent is checking {token}...")

    time.sleep(3)

    url = f"https://api.dexscreener.com/latest/dex/search?q={token}"

    response = requests.get(url)

    data = response.json()

    if not data["pairs"]:
        return {"error": "Token not found"}

    pairs = data["pairs"]

    pair = max(
        pairs,
        key=lambda p: p.get("liquidity", {}).get("usd", 0)
    )

    price = pair.get("priceUsd") or pair.get("price") or 0
    market_cap = pair.get("marketCap") or 0
    liquidity = pair.get("liquidity", {}).get("usd", 0)
    chain = pair.get("chain") or "unknown"
    dex = pair.get("dexId") or pair.get("dex") or "unknown"

    next_agents = ["risk"]

    return {
    "data": {
        "price": price,
        "market_cap": market_cap,
        "liquidity": liquidity,
        "chain": chain,
        "dex": dex,
    },

    "summary": "Token has healthy liquidity and market activity.",

    "confidence": 0.90,

    "reasoning": [
        f"Liquidity: ${liquidity:,.2f}",
        f"Market Cap: ${market_cap:,.0f}",
        f"DEX: {dex}",
        f"Chain: {chain}"
    ],

    "next_agents": ["risk"]
}