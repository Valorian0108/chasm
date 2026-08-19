import { encodeFunctionData, isAddress, parseAbi, type Hex } from "viem";
import type { XLayerPublication } from "@workspace/api-zod";
import type { XLayerSetup } from "./analysis-api";

type EthereumRequest = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

type EthereumProvider = {
  request: (request: EthereumRequest) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const xLayerPublishAbi = parseAbi([
  "function publish(bytes32 reportHash, bytes32 officialTermsHash, bytes32 publicMarketingHash, uint256 findingsCount, uint256 highSeverityCount, uint64 timestamp, string network)",
]);

const X_LAYER_TESTNET_PARAMS = {
  chainId: "0x7a0",
  chainName: "X Layer Testnet",
  nativeCurrency: {
    name: "OKB",
    symbol: "OKB",
    decimals: 18,
  },
  rpcUrls: ["https://testrpc.xlayer.tech/terigon"],
  blockExplorerUrls: ["https://www.okx.com/web3/explorer/xlayer-test"],
};

function getEthereumProvider(): EthereumProvider {
  if (!window.ethereum) {
    throw new Error("No browser wallet found. Install or unlock MetaMask/OKX Wallet, then try again.");
  }

  return window.ethereum;
}

function toBytes32(value: string): Hex {
  const clean = value.trim().replace(/^0x/i, "");

  if (!/^[a-fA-F0-9]+$/.test(clean) || clean.length > 64) {
    throw new Error(`Invalid hash value for X Layer publish: ${value}`);
  }

  return `0x${clean.padStart(64, "0")}` as Hex;
}

function toUnixSeconds(value: string): bigint {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    throw new Error(
      `Invalid timestamp for X Layer publish: ${value}. The onchain record must carry the report timestamp.`,
    );
  }

  return BigInt(Math.floor(parsed / 1000));
}

async function ensureXLayerTestnet(provider: EthereumProvider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: X_LAYER_TESTNET_PARAMS.chainId }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;

    if (code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [X_LAYER_TESTNET_PARAMS],
    });
  }
}

export async function publishToXLayer(
  publication: XLayerPublication,
  setup: XLayerSetup,
) {
  const provider = getEthereumProvider();

  if (!isAddress(setup.contractAddress)) {
    throw new Error("X Layer contract address is not configured.");
  }

  await ensureXLayerTestnet(provider);

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const account = accounts[0];

  if (!account || !isAddress(account)) {
    throw new Error("No wallet account selected.");
  }

  const data = encodeFunctionData({
    abi: xLayerPublishAbi,
    functionName: "publish",
    args: [
      toBytes32(publication.reportHash),
      toBytes32(publication.officialTermsHash),
      toBytes32(publication.publicMarketingHash),
      BigInt(publication.findingsCount),
      BigInt(publication.highSeverityCount),
      toUnixSeconds(publication.timestamp),
      publication.network,
    ],
  });

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: account,
        to: setup.contractAddress,
        data,
        value: "0x0",
      },
    ],
  })) as string;

  return {
    account,
    txHash,
    explorerUrl: `${setup.networks["xlayer-testnet"].explorerUrl}/tx/${txHash}`,
  };
}
