import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import boatsRouter from "./boats";
import launchesRouter from "./launches";
import reservationsRouter from "./reservations";
import noticesRouter from "./notices";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(boatsRouter);
router.use(launchesRouter);
router.use(reservationsRouter);
router.use(noticesRouter);

export default router;
