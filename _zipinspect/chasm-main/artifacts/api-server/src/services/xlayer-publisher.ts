import {
  buildPublishStatus,
  publishReceiptSchema,
  type AnalysisReport,
  type PublishReceipt,
  type PublishStatus,
} from "@workspace/api-zod";
import {
  getXLayerNetworkConfig,
  getXLayerNetworkLabel,
} from "../lib/xlayer-config";

export type PublishMode = "ready" | "published";

export type PublishOptions = {
  receipt?: PublishReceipt;
};

export function createXLayerPublisher() {
  return {
    prepare(report: AnalysisReport): PublishStatus & { nextAction: string } {
      const networkName =
        report.provenance?.network === "xlayer-mainnet"
          ? "xlayer-mainnet"
          : "xlayer-testnet";
      const networkLabel = getXLayerNetworkLabel(networkName);
      return {
        ...buildPublishStatus(report),
        nextAction:
          `Send the payload through the ${networkLabel} wallet flow to broadcast the transaction.`,
      };
    },

    finalize(
      report: AnalysisReport,
      options?: PublishOptions,
    ): PublishStatus & { nextAction: string } {
      const receipt = options?.receipt
        ? publishReceiptSchema.parse(options.receipt)
        : undefined;
      const networkName =
        report.provenance?.network === "xlayer-mainnet"
          ? "xlayer-mainnet"
          : "xlayer-testnet";

      const status = buildPublishStatus(report, {
        txHash: receipt?.txHash ?? report.provenance?.chainRecord.txHash,
        explorerUrl:
          receipt?.explorerUrl ??
          report.provenance?.chainRecord.explorerUrl ??
          getXLayerNetworkConfig(networkName).explorerUrl,
        publishedAt:
          receipt?.publishedAt ?? report.provenance?.chainRecord.publishedAt,
      });

      const networkLabel = getXLayerNetworkLabel(networkName);

      return {
        ...status,
        status:
          receipt?.txHash || report.provenance?.chainRecord.txHash
            ? "published"
            : status.status,
        nextAction:
          receipt?.txHash || report.provenance?.chainRecord.txHash
            ? `Track the confirmed transaction on the ${networkLabel} explorer.`
            : `Send the payload through the ${networkLabel} wallet flow to broadcast the transaction.`,
      };
    },
  };
}

export const xLayerPublisher = createXLayerPublisher();
