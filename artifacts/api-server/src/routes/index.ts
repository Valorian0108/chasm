import { Router, type IRouter } from "express";
import analysisRouter from "./analysis";
import healthRouter from "./health";
import publicationRouter from "./publication";
import recordsRouter from "./records";

const router: IRouter = Router();

router.use(analysisRouter);
router.use(publicationRouter);
router.use(recordsRouter);
router.use(healthRouter);

export default router;
