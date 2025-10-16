import { Router } from 'express';
import { getAreaPaths } from '../controllers/organization.controller';
import { getAllAreaPaths } from '../services/azure-organization.service';

const router = Router();

/**
 * @swagger
 * /v1/organization/areaPaths:
 *   get:
 *     summary: Get all area paths from Azure DevOps organization
 *     description: Retrieves all available area paths from the Azure DevOps organization, used for filtering teams and projects
 *     tags: [Organization]
 *     responses:
 *       200:
 *         description: List of area paths successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AreaPath'
 *             examples:
 *               success:
 *                 summary: Successful response
 *                 value:
 *                   - id: "304c9ee4-0776-4f09-80d0-5bc4a06f80dc"
 *                     name: "Kantar Automation Platform"
 *                   - id: "40b06b29-21f8-4b7a-b3a2-1fde2226ea15"
 *                     name: "Kantar Automation Platform\\Core"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/v1/organization/areaPaths', getAreaPaths);

export default router;
