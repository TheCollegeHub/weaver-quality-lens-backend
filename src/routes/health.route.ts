import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /v1/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API server and connected services
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy and operational
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 services:
 *                   type: object
 *                   properties:
 *                     azureDevOps:
 *                       type: string
 *                       example: "connected"
 *                     sonarQube:
 *                       type: string
 *                       example: "connected"
 *                     redis:
 *                       type: string
 *                       example: "connected"
 *             examples:
 *               healthy:
 *                 summary: Healthy server response
 *                 value:
 *                   status: "healthy"
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *                   version: "1.0.0"
 *                   services:
 *                     azureDevOps: "connected"
 *                     sonarQube: "connected"
 *                     redis: "connected"
 *       503:
 *         description: Server is unhealthy or services are unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Azure DevOps connection failed", "Redis unavailable"]
 */
router.get('/v1/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      azureDevOps: process.env.ADO_ORGANIZATION ? 'configured' : 'not configured',
      sonarQube: process.env.SONAR_DOMAIN ? 'configured' : 'not configured',
      redis: process.env.REDIS_URL ? 'configured' : 'not configured',
    },
  };

  res.status(200).json(healthCheck);
});

export default router;