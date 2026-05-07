import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mapsListRouter from "./mapsList";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mapsListRouter);

export default router;
