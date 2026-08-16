import { Router, type IRouter } from "express";
import { xLayerConfig, xLayerNetworks } from "../lib/xlayer-config";

const router: IRouter = Router();

router.get("/xlayer/config", (_req, res) => {
  return res.json({
    status: "ok",
    xLayer: {
      targetNetwork: xLayerConfig.targetNetwork,
      walletAddress: xLayerConfig.walletAddress,
      contractAddress: xLayerConfig.contractAddress,
      faucetUrl: xLayerConfig.faucetUrl,
      networks: xLayerNetworks,
    },
  });
});

export default router;
