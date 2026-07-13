def display(report):

    print("\n" + "=" * 45)
    print("        TOKEN ANALYSIS REPORT")
    print("=" * 45)

    wallet = report.get("wallet")
    social = report.get("social")
    risk = report.get("risk")
    docs = report.get("docs")
    decision = report.get("decision")

    # =========================
    # Wallet
    # =========================
    print("\n💰 Wallet")
    print("-" * 45)

    if wallet:
        data = wallet["data"]

        print(f"Price: ${data['price']}")
        print(f"Market Cap: ${data['market_cap']:,}")
        print(f"Liquidity: ${data['liquidity']:,}")
        print(f"Chain: {data['chain'].title()}")
        print(f"DEX: {data['dex'].title()}")

        print()
        print("Summary:")
        print(wallet["summary"])

        print(f"\nConfidence: {wallet['confidence']:.0%}")

        print("\nReasoning:")

        for item in wallet["reasoning"]:
            print(f"✓ {item}")
    else:
        print("Skipped")

    # =========================
    # Social
    # =========================
    print("\n📢 Social")
    print("-" * 45)

    if social:
        data = social["data"]

        print(f"Community: {data.get('community', 'Unknown')}")
        print(f"Twitter: {data.get('twitter', 'N/A')}")
        print(f"Telegram: {data.get('telegram', 'N/A')}")
        print(f"Sentiment: {data.get('sentiment', 'Unknown')}")
        print(f"Confidence: {data.get('confidence', 'N/A')}")

        print("\nAI Summary:")
        print(data.get("summary", "No summary available."))

    else:
        print("Skipped")

    # =========================
    # Risk
    # =========================
    print("\n🛡 Risk")
    print("-" * 45)

    if risk:
        data = risk["data"]

        print(f"Rug Risk: {data['rug_risk']}")
        print(f"Contract Verified: {data['contract_verified']}")
        print(f"Liquidity Locked: {data['liquidity_locked']}")

        print()
        print("Summary:")
        print(risk["summary"])

        print(f"\nConfidence: {risk['confidence']:.0%}")

        print("\nReasoning:")

        for item in risk["reasoning"]:
            print(f"✓ {item}")
    else:
        print("Skipped")

    # =========================
    # Documentation
    # =========================
    print("\n📄 Documentation")
    print("-" * 45)

    if docs:
        data = docs["data"]

        print(f"Website: {data.get('website', 'Unknown')}")
        print(f"Whitepaper: {data.get('whitepaper', 'Not Found')}")
        print(f"Roadmap: {data.get('roadmap', 'Unknown')}")
    else:
        print("Skipped")

    # =========================
    # AI Verdict
    # =========================
    print("\n🧠 AI Investment Thesis")
    print("-" * 45)

    if decision:
        print(f"Score: {decision['score']}")
        print(f"Recommendation: {decision['recommendation']}")
        print(f"Confidence: {decision['confidence']}")

        print("\nStrengths:")
        for item in decision["strengths"]:
            print(f"✓ {item}")

        print("\nWeaknesses:")
        for item in decision["weaknesses"]:
            print(f"• {item}")

        print("\nSummary:")
        print(decision["summary"])
    else:
        print("No AI decision available.")