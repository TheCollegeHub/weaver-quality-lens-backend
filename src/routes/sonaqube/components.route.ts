import { Router } from 'express';
import { getComponentsController, getMetricsByComponent } from '../../controllers/sonarqube/sonar-components.controller';

const router = Router();

/**
 * @swagger
 * /v1/components/search:
 *   get:
 *     summary: Search SonarQube components
 *     description: Searches for components in SonarQube by qualifiers with pagination support
 *     tags: [SonarQube]
 *     parameters:
 *       - in: query
 *         name: qualifiers
 *         schema:
 *           type: string
 *         description: Comma-separated list of component qualifiers such as TRK, APP, VW, SWV
 *         example: "TRK,VW"
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           minimum: 1
 *         description: Page number for pagination, defaults to 1
 *         example: 1
 *       - in: query
 *         name: size
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 500
 *         description: Number of results per page, defaults to 100 with maximum of 500
 *         example: 50
 *     responses:
 *       200:
 *         description: Components successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paging:
 *                   type: object
 *                   properties:
 *                     pageIndex:
 *                       type: number
 *                       example: 1
 *                     pageSize:
 *                       type: number
 *                       example: 50
 *                     total:
 *                       type: number
 *                       example: 125
 *                 components:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SonarComponent'
 *             examples:
 *               success:
 *                 summary: Successful response
 *                 value:
 *                   paging:
 *                     pageIndex: 1
 *                     pageSize: 50
 *                     total: 125
 *                   components:
 *                     - key: "my-project:main"
 *                       qualifier: "TRK"
 *                       name: "My Application"
 *                       project: "my-project"
 *       500:
 *         description: Internal server error - SonarQube connection issues
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/v1/components/search', getComponentsController);

/**
 * @swagger
 * /v1/measures/component:
 *   get:
 *     summary: Get component metrics from SonarQube
 *     description: Retrieves quality metrics for a specific SonarQube component including coverage, tests, and code quality measures
 *     tags: [SonarQube]
 *     parameters:
 *       - in: query
 *         name: componentKey
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique key of the SonarQube component
 *         example: "my-project:main"
 *     responses:
 *       200:
 *         description: Component metrics successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SonarMetrics'
 *             examples:
 *               success:
 *                 summary: Successful response with metrics
 *                 value:
 *                   component:
 *                     key: "my-project:main"
 *                     name: "My Application"
 *                     qualifier: "TRK"
 *                     measures:
 *                       - metric: "coverage"
 *                         value: "85.5"
 *                         bestValue: false
 *                       - metric: "branch_coverage"
 *                         value: "78.2"
 *                         bestValue: false
 *                       - metric: "tests"
 *                         value: "1250"
 *                       - metric: "test_errors"
 *                         value: "0"
 *                         bestValue: true
 *                       - metric: "test_failures"
 *                         value: "2"
 *                       - metric: "skipped_tests"
 *                         value: "5"
 *                       - metric: "test_success_density"
 *                         value: "99.4"
 *       400:
 *         description: Bad request - componentKey parameter is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "params 'componentKey' is required"
 *       500:
 *         description: Internal server error - SonarQube connection issues
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/v1/measures/component", getMetricsByComponent);

export default router;
