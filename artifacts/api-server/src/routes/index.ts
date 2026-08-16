import { Router, type IRouter } from "express";
import analysisRouter from "./analysis";
import healthRouter from "./health";
import publishRouter from "./publish";
import publicationRouter from "./publication";
import recordsRouter from "./records";
import xlayerRouter from "./xlayer";

const router: IRouter = Router();

router.use(analysisRouter);
router.use(publishRouter);
router.use(publicationRouter);
router.use(recordsRouter);
router.use(xlayerRouter);
router.use(healthRouter);

export default router;
