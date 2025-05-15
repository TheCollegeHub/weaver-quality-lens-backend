import { Router } from 'express';
import { getAreaPaths } from '../controllers/organization.controller';

const router = Router();

router.get('/v1/organization/areaPaths', getAreaPaths);

export default router;
