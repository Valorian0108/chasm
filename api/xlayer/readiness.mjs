function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value ?? "").trim());
}

export default async function handler() {
  const missing = [];
  const walletAddress = process.env.X_LAYER_WALLET_ADDRESS?.trim() || "";
  const contractAddress = process.env.X_LAYER_CONTRACT_ADDRESS?.trim() || "";

  if (!isEvmAddress(walletAddress)) {
    missing.push("walletAddress");
  }

  if (!isEvmAddress(contractAddress)) {
    missing.push("contractAddress");
  }

  const ready = missing.length === 0;

  return json(200, {
    status: "ok",
    readiness: {
      ready,
      missing,
      nextStep: ready
        ? "Copy the X Layer payload JSON when you are ready to publish a report."
        : "Add a deployed contract address, then copy the payload JSON into the wallet flow.",
    },
  });
}
