def analyze(report):

    wallet = report.get("wallet")
    social = report.get("social")
    risk = report.get("risk")
    docs = report.get("docs")

    score = 0
    reasons = []

    # Wallet
    if wallet:
        data = wallet["data"]

        if data["liquidity"] > 100000:
            score += 2
            reasons.append("High liquidity")

        if data["market_cap"] and data["market_cap"] > 1000000:
            score += 2
            reasons.append("Strong market cap")

    # Social
    if social:
        data = social["data"]

        if data["sentiment"] == "Positive":
            score += 2
            reasons.append("Positive sentiment")

        if data["community"] == "Active":
            score += 1
            reasons.append("Active community")

    # Risk
    if risk:
        data = risk["data"]

        if data["rug_risk"] == "Low":
            score += 2
            reasons.append("Low rug risk")

        if data["contract_verified"]:
            score += 1
            reasons.append("Verified contract")

    # Docs
    if docs:
        data = docs["data"]

        if data["website"] == "Available":
            score += 1
            reasons.append("Official website")

    if score >= 8:
        verdict = "🟢 Strong Buy"
    elif score >= 5:
        verdict = "🟡 Worth Watching"
    else:
        verdict = "🔴 Not Enough Information"

    return {
        "score": score,
        "verdict": verdict,
        "reasons": reasons
    }