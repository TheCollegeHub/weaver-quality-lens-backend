import { Router } from 'express';
import { getComponentsController, getMetricsByComponent } from '../../controllers/sonarqube/sonar-components.controller';

const router = Router();

router.get('/v1/components/search', getComponentsController);
router.get("/v1/measures/component", getMetricsByComponent);

export default router;
