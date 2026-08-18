// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { XLayerPublication } from "@workspace/api-zod";
import { publishToXLayer } from "./xlayer-wallet";
import type { XLayerSetup } from "./analysis-api";

const ACCOUNT = "0xf52a8c9f07446604743ffe60b7fbf75e9d16d9ff";
const CONTRACT = "0xa3a9fFddE592AE2D889562d9ca2B05d9Ae5634b3";

const setup: XLayerSetup = {
  targetNetwork: "xlayer-testnet",
  walletAddress: ACCOUNT,
  contractAddress: CONTRACT,
  faucetUrl: "https://www.okx.com/xlayer/faucet",
  networks: {
    "xlayer-testnet": {
      name: "xlayer-testnet",
      chainId: 1952,
      rpcUrl: "https://testrpc.xlayer.tech/terigon",
      explorerUrl: "https://explorer.example.com",
    },
    "xlayer-mainnet": {
      name: "xlayer-mainnet",
      chainId: 196,
      rpcUrl: "https://rpc.xlayer.tech",
      explorerUrl: "https://mainnet-explorer.example.com",
    },
  },
};

const publication: XLayerPublication = {
  network: "xlayer-testnet",
  reportHash: "cccccccccccccccc",
  officialTermsHash: "0xaaaaaaaaaaaaaaaa",
  publicMarketingHash: "bbbbbbbbbbbbbbbb",
  findingsCount: 2,
  highSeverityCount: 1,
  summary: "Summary",
  timestamp: "2026-01-01T00:00:00.000Z",
};

type Request = { method: string; params?: unknown };

function stubWallet(
  handler: (request: Request) => Promise<unknown>,
): ReturnType<typeof vi.fn> {
  const request = vi.fn(handler);
  (window as Window & { ethereum?: unknown }).ethereum = { request };
  return request;
}

const happyPath = async (request: Request) => {
  switch (request.method) {
    case "wallet_switchEthereumChain":
    case "wallet_addEthereumChain":
      return null;
    case "eth_requestAccounts":
      return [ACCOUNT];
    case "eth_sendTransaction":
      return "0xtx";
    default:
      throw new Error(`Unexpected method ${request.method}`);
  }
};

beforeEach(() => {
  delete (window as Window & { ethereum?: unknown }).ethereum;
});

afterEach(() => {
  delete (window as Window & { ethereum?: unknown }).ethereum;
  vi.restoreAllMocks();
});

describe("publishToXLayer", () => {
  it("switches the chain, encodes the call and returns the receipt", async () => {
    const request = stubWallet(happyPath);

    const result = await publishToXLayer(publication, setup);

    expect(result).toEqual({
      account: ACCOUNT,
      txHash: "0xtx",
      explorerUrl: "https://explorer.example.com/tx/0xtx",
    });
    expect(request.mock.calls.map(([call]) => call.method)).toEqual([
      "wallet_switchEthereumChain",
      "eth_requestAccounts",
      "eth_sendTransaction",
    ]);

    const [{ params }] = request.mock.calls[2];
    const [transaction] = params as Array<{
      from: string;
      to: string;
      data: string;
      value: string;
    }>;
    expect(transaction.from).toBe(ACCOUNT);
    expect(transaction.to).toBe(CONTRACT);
    expect(transaction.value).toBe("0x0");
    // Left-padded 32-byte hashes, with or without an incoming 0x prefix.
    expect(transaction.data).toContain(`${"0".repeat(48)}cccccccccccccccc`);
    expect(transaction.data).toContain(`${"0".repeat(48)}aaaaaaaaaaaaaaaa`);
  });

  it("adds the X Layer testnet when the wallet does not know it", async () => {
    const request = stubWallet(async (call) => {
      if (call.method === "wallet_switchEthereumChain") {
        throw Object.assign(new Error("Unrecognized chain"), { code: 4902 });
      }
      return happyPath(call);
    });

    await publishToXLayer(publication, setup);

    const addCall = request.mock.calls.find(
      ([call]) => call.method === "wallet_addEthereumChain",
    );
    expect(addCall).toBeDefined();
    expect((addCall?.[0].params as Array<{ chainId: string }>)[0].chainId).toBe(
      "0x7a0",
    );
  });

  it("propagates a wallet switch rejection", async () => {
    stubWallet(async (call) => {
      if (call.method === "wallet_switchEthereumChain") {
        throw Object.assign(new Error("User rejected"), { code: 4001 });
      }
      return happyPath(call);
    });

    await expect(publishToXLayer(publication, setup)).rejects.toThrow(
      "User rejected",
    );
  });

  it("requires a browser wallet", async () => {
    await expect(publishToXLayer(publication, setup)).rejects.toThrow(
      /No browser wallet found/,
    );
  });

  it("requires a configured contract address", async () => {
    stubWallet(happyPath);

    await expect(
      publishToXLayer(publication, { ...setup, contractAddress: "0x123" }),
    ).rejects.toThrow("X Layer contract address is not configured.");
  });

  it("requires a selected account", async () => {
    stubWallet(async (call) =>
      call.method === "eth_requestAccounts" ? [] : happyPath(call),
    );

    await expect(publishToXLayer(publication, setup)).rejects.toThrow(
      "No wallet account selected.",
    );
  });

  it("rejects a non-hex hash", async () => {
    stubWallet(happyPath);

    await expect(
      publishToXLayer({ ...publication, reportHash: "not-a-hash" }, setup),
    ).rejects.toThrow(/Invalid hash value/);
  });

  it("rejects a hash longer than 32 bytes", async () => {
    stubWallet(happyPath);

    await expect(
      publishToXLayer({ ...publication, reportHash: "a".repeat(65) }, setup),
    ).rejects.toThrow(/Invalid hash value/);
  });

  it("falls back to the current time for an unparsable timestamp", async () => {
    const request = stubWallet(happyPath);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T05:06:07.000Z"));

    try {
      await publishToXLayer({ ...publication, timestamp: "whenever" }, setup);
    } finally {
      vi.useRealTimers();
    }

    const [{ params }] = request.mock.calls[2];
    const { data } = (params as Array<{ data: string }>)[0];
    const expected = Math.floor(
      Date.parse("2026-03-04T05:06:07.000Z") / 1000,
    ).toString(16);
    expect(data).toContain(expected);
  });
});
