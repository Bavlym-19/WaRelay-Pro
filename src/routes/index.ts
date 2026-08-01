import { Router, type IRouter } from "express";
import healthRouter from "./health";
import campaignsRouter from "./campaigns";
import contactsRouter from "./contacts";
import whatsappRouter from "./whatsapp";
import whatsappTestRouter from "./whatsapp-test";
import whatsappInstancesRouter from "./whatsapp-instances";
import parsePdfRouter from "./parse-pdf";

const router: IRouter = Router();

router.use(healthRouter);
router.use(campaignsRouter);
router.use(contactsRouter);
router.use(whatsappRouter);
router.use(whatsappTestRouter);
router.use(whatsappInstancesRouter);
router.use(parsePdfRouter);

export default router;
