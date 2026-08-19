function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function readEnvNumber(key, fallback) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readEnvString(key, fallback) {
  return process.env[key]?.trim() || fallback;
}

const networks = {
  "xlayer-testnet": {
    name: "xlayer-testnet",
    chainId: readEnvNumber("X_LAYER_TESTNET_CHAIN_ID", 1952),
    rpcUrl: readEnvString("X_LAYER_TESTNET_RPC_URL", "https://testrpc.xlayer.tech/terigon"),
    explorerUrl: readEnvString("X_LAYER_TESTNET_EXPLORER_URL", "https://www.okx.com/web3/explorer/xlayer-test"),
  },
  "xlayer-mainnet": {
    name: "xlayer-mainnet",
    chainId: readEnvNumber("X_LAYER_MAINNET_CHAIN_ID", 196),
    rpcUrl: readEnvString("X_LAYER_MAINNET_RPC_URL", "https://rpc.xlayer.tech"),
    explorerUrl: readEnvString("X_LAYER_MAINNET_EXPLORER_URL", "https://www.okx.com/web3/explorer/xlayer"),
  },
};

export default async function handler() {
  return json(200, {
    status: "ok",
    xLayer: {
      targetNetwork: process.env.X_LAYER_TARGET_NETWORK?.trim() || "xlayer-testnet",
      walletAddress: process.env.X_LAYER_WALLET_ADDRESS?.trim() || "",
      contractAddress: process.env.X_LAYER_CONTRACT_ADDRESS?.trim() || "",
      faucetUrl: process.env.X_LAYER_FAUCET_URL?.trim() || "https://www.okx.com/xlayer/faucet",
      networks,
    },
  });
}
