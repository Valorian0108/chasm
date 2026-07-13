def analyze(request):

    request = request.lower()

    # User explicitly asks for one thing
    if "wallet" in request:
        return ["wallet"]

    if "community" in request or "twitter" in request:
        return ["social"]

    if "risk" in request or "rug" in request:
        return ["risk"]

    if "website" in request or "whitepaper" in request:
        return ["docs"]

    # Default: start with Wallet Agent
    return ["wallet"]