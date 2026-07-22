import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import seasonsRouter from "./seasons";
import athletesRouter from "./athletes";
import crewsRouter from "./crews";
import fleetRouter from "./fleet";
import equipmentRouter from "./equipment";
import trainingRouter from "./training";
import competitionsRouter from "./competitions";
import financialRouter from "./financial";
import documentsRouter from "./documents";
import dashboardRouter from "./dashboard";
import meetingsRouter from "./meetings";
import meetingsParseRouter from "./meetings-parse";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(seasonsRouter);
router.use(athletesRouter);
router.use(crewsRouter);
router.use(fleetRouter);
router.use(equipmentRouter);
router.use(trainingRouter);
router.use(competitionsRouter);
router.use(financialRouter);
router.use(documentsRouter);
router.use(dashboardRouter);
router.use(meetingsRouter);
router.use(meetingsParseRouter);

export default router;
