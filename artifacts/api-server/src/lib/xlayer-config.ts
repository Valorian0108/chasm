import type { AnalysisReport } from "@workspace/api-zod";
import { loadEnvFiles } from "@workspace/env";

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

export type XLayerReadiness = {
  ready: boolean;
  missing: Array<"walletAddress" | "contractAddress">;
  nextStep: string;
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

export function getXLayerReportNetworkName(
  report: AnalysisReport,
): XLayerNetworkName {
  return report.provenance?.network === "xlayer-mainnet"
    ? "xlayer-mainnet"
    : "xlayer-testnet";
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function getXLayerReadiness(): XLayerReadiness {
  const missing: Array<"walletAddress" | "contractAddress"> = [];

  if (!isEvmAddress(xLayerConfig.walletAddress)) {
    missing.push("walletAddress");
  }

  if (!isEvmAddress(xLayerConfig.contractAddress)) {
    missing.push("contractAddress");
  }

  const ready = missing.length === 0;

  return {
    ready,
    missing,
    nextStep: ready
      ? "Testnet publish is ready."
      : "Add a deployed contract address, then copy the payload JSON into the wallet flow.",
  };
}
