import { loadEnvFiles } from "./load-env";

loadEnvFiles();

export type XLayerNetworkName = "xlayer-testnet" | "xlayer-mainnet";

export type XLayerNetworkConfig = {
  name: XLayerNetworkName;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
};

function readEnvNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readEnvString(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

export const xLayerNetworks: Record<XLayerNetworkName, XLayerNetworkConfig> = {
  "xlayer-testnet": {
    name: "xlayer-testnet",
    chainId: readEnvNumber("X_LAYER_TESTNET_CHAIN_ID", 1952),
    rpcUrl: readEnvString(
      "X_LAYER_TESTNET_RPC_URL",
      "https://testrpc.xlayer.tech/terigon",
    ),
    explorerUrl: readEnvString(
      "X_LAYER_TESTNET_EXPLORER_URL",
      "https://www.okx.com/web3/explorer/xlayer-test",
    ),
  },
  "xlayer-mainnet": {
    name: "xlayer-mainnet",
    chainId: readEnvNumber("X_LAYER_MAINNET_CHAIN_ID", 196),
    rpcUrl: readEnvString("X_LAYER_MAINNET_RPC_URL", "https://rpc.xlayer.tech"),
    explorerUrl: readEnvString(
      "X_LAYER_MAINNET_EXPLORER_URL",
      "https://www.okx.com/web3/explorer/xlayer",
    ),
  },
};

export const xLayerConfig = {
  targetNetwork:
    (process.env.X_LAYER_TARGET_NETWORK as XLayerNetworkName | undefined) ??
    "xlayer-testnet",
  walletAddress: process.env.X_LAYER_WALLET_ADDRESS?.trim() ?? "",
  contractAddress: process.env.X_LAYER_CONTRACT_ADDRESS?.trim() ?? "",
  faucetUrl:
    process.env.X_LAYER_FAUCET_URL?.trim() ||
    "https://www.okx.com/xlayer/faucet",
  networks: xLayerNetworks,
};

export function getXLayerNetworkConfig(
  network: XLayerNetworkName = xLayerConfig.targetNetwork,
): XLayerNetworkConfig {
  return xLayerNetworks[network];
}

export function getXLayerNetworkLabel(
  network: XLayerNetworkName = xLayerConfig.targetNetwork,
): string {
  return network === "xlayer-mainnet" ? "X Layer mainnet" : "X Layer testnet";
}
