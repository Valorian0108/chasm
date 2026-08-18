import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./load-env", () => ({ loadEnvFiles: () => {} }));

const WALLET = "0xf52a8c9f07446604743ffe60b7fbf75e9d16d9ff";
const CONTRACT = "0xa3a9fFddE592AE2D889562d9ca2B05d9Ae5634b3";

async function importConfig() {
  vi.resetModules();
  return import("./xlayer-config");
}

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("X_LAYER_")) {
      vi.stubEnv(key, undefined);
    }
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("xLayerNetworks", () => {
  it("falls back to the documented defaults", async () => {
    const { xLayerNetworks, xLayerConfig } = await importConfig();

    expect(xLayerNetworks["xlayer-testnet"]).toEqual({
      name: "xlayer-testnet",
      chainId: 1952,
      rpcUrl: "https://testrpc.xlayer.tech/terigon",
      explorerUrl: "https://www.okx.com/web3/explorer/xlayer-test",
    });
    expect(xLayerNetworks["xlayer-mainnet"]).toEqual({
      name: "xlayer-mainnet",
      chainId: 196,
      rpcUrl: "https://rpc.xlayer.tech",
      explorerUrl: "https://www.okx.com/web3/explorer/xlayer",
    });
    expect(xLayerConfig.targetNetwork).toBe("xlayer-testnet");
    expect(xLayerConfig.walletAddress).toBe("");
    expect(xLayerConfig.contractAddress).toBe("");
    expect(xLayerConfig.faucetUrl).toBe("https://www.okx.com/xlayer/faucet");
  });

  it("reads overrides from the environment and trims addresses", async () => {
    vi.stubEnv("X_LAYER_TESTNET_CHAIN_ID", "4242");
    vi.stubEnv("X_LAYER_TESTNET_RPC_URL", "https://rpc.example.com");
    vi.stubEnv("X_LAYER_TARGET_NETWORK", "xlayer-mainnet");
    vi.stubEnv("X_LAYER_WALLET_ADDRESS", `  ${WALLET}  `);
    vi.stubEnv("X_LAYER_FAUCET_URL", "https://faucet.example.com");

    const { xLayerNetworks, xLayerConfig } = await importConfig();

    expect(xLayerNetworks["xlayer-testnet"].chainId).toBe(4242);
    expect(xLayerNetworks["xlayer-testnet"].rpcUrl).toBe(
      "https://rpc.example.com",
    );
    expect(xLayerConfig.targetNetwork).toBe("xlayer-mainnet");
    expect(xLayerConfig.walletAddress).toBe(WALLET);
    expect(xLayerConfig.faucetUrl).toBe("https://faucet.example.com");
  });

  it("ignores non-numeric, zero and blank overrides", async () => {
    vi.stubEnv("X_LAYER_TESTNET_CHAIN_ID", "not-a-number");
    vi.stubEnv("X_LAYER_MAINNET_CHAIN_ID", "0");
    vi.stubEnv("X_LAYER_MAINNET_RPC_URL", "   ");

    const { xLayerNetworks } = await importConfig();

    expect(xLayerNetworks["xlayer-testnet"].chainId).toBe(1952);
    expect(xLayerNetworks["xlayer-mainnet"].chainId).toBe(196);
    expect(xLayerNetworks["xlayer-mainnet"].rpcUrl).toBe(
      "https://rpc.xlayer.tech",
    );
  });
});

describe("getXLayerNetworkConfig", () => {
  it("defaults to the configured target network", async () => {
    vi.stubEnv("X_LAYER_TARGET_NETWORK", "xlayer-mainnet");

    const { getXLayerNetworkConfig } = await importConfig();

    expect(getXLayerNetworkConfig().name).toBe("xlayer-mainnet");
    expect(getXLayerNetworkConfig("xlayer-testnet").chainId).toBe(1952);
  });
});

describe("getXLayerNetworkLabel", () => {
  it("labels each network in human-readable form", async () => {
    const { getXLayerNetworkLabel } = await importConfig();

    expect(getXLayerNetworkLabel("xlayer-mainnet")).toBe("X Layer mainnet");
    expect(getXLayerNetworkLabel("xlayer-testnet")).toBe("X Layer testnet");
    expect(getXLayerNetworkLabel()).toBe("X Layer testnet");
  });
});

describe("getXLayerReadiness", () => {
  it("reports both addresses missing when nothing is configured", async () => {
    const { getXLayerReadiness } = await importConfig();

    expect(getXLayerReadiness()).toEqual({
      ready: false,
      missing: ["walletAddress", "contractAddress"],
      nextStep:
        "Add a deployed contract address, then copy the payload JSON into the wallet flow.",
    });
  });

  it("reports the contract as the only gap once a wallet is set", async () => {
    vi.stubEnv("X_LAYER_WALLET_ADDRESS", WALLET);

    const { getXLayerReadiness } = await importConfig();

    expect(getXLayerReadiness().missing).toEqual(["contractAddress"]);
    expect(getXLayerReadiness().ready).toBe(false);
  });

  it("rejects addresses that are not 20-byte hex values", async () => {
    vi.stubEnv("X_LAYER_WALLET_ADDRESS", "0x1234");
    vi.stubEnv("X_LAYER_CONTRACT_ADDRESS", `${CONTRACT}ff`);

    const { getXLayerReadiness } = await importConfig();

    expect(getXLayerReadiness().missing).toEqual([
      "walletAddress",
      "contractAddress",
    ]);
  });

  it("is ready when both addresses are valid", async () => {
    vi.stubEnv("X_LAYER_WALLET_ADDRESS", WALLET);
    vi.stubEnv("X_LAYER_CONTRACT_ADDRESS", CONTRACT);

    const { getXLayerReadiness } = await importConfig();

    expect(getXLayerReadiness()).toEqual({
      ready: true,
      missing: [],
      nextStep: "Testnet publish is ready.",
    });
  });
});
