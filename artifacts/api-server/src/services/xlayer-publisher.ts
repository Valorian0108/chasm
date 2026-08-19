import {
  buildPublishStatus,
  publishReceiptSchema,
  type AnalysisReport,
  type PublishReceipt,
  type PublishStatus,
} from "@workspace/api-zod";
import {
  getXLayerReportNetworkName,
  getXLayerNetworkConfig,
  getXLayerNetworkLabel,
} from "../lib/xlayer-config";

export type PublishMode = "ready" | "published";

export type PublishOptions = {
  receipt?: PublishReceipt;
};

function getNextAction(networkLabel: string, published: boolean): string {
  return published
    ? `Track the confirmed transaction on the ${networkLabel} explorer.`
    : `Send the payload through the ${networkLabel} wallet flow to broadcast the transaction.`;
}

export function createXLayerPublisher() {
  return {
    prepare(report: AnalysisReport): PublishStatus & { nextAction: string } {
      const networkName = getXLayerReportNetworkName(report);
      const networkLabel = getXLayerNetworkLabel(networkName);
      return {
        ...buildPublishStatus(report),
        nextAction: getNextAction(networkLabel, false),
      };
    },

    finalize(
      report: AnalysisReport,
      options?: PublishOptions,
    ): PublishStatus & { nextAction: string } {
      const receipt = options?.receipt
        ? publishReceiptSchema.parse(options.receipt)
        : undefined;
      const networkName = getXLayerReportNetworkName(report);

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
        nextAction: getNextAction(
          networkLabel,
          Boolean(receipt?.txHash || report.provenance?.chainRecord.txHash),
        ),
      };
    },
  };
}

export const xLayerPublisher = createXLayerPublisher();
