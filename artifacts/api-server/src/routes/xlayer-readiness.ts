import { Router, type IRouter } from "express";
import { getXLayerReadiness } from "../lib/xlayer-config";

const router: IRouter = Router();

router.get("/xlayer/readiness", (_req, res) => {
  return res.json({
    status: "ok",
    readiness: getXLayerReadiness(),
  });
});

export default router;
