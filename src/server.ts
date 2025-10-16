import express from 'express'
import dotenv from 'dotenv'
import testplanMetricsRoutes from './routes/testplans.route.js'
import organizationRoutes from './routes/organization.route.js'
import teamsMetricsRoutes from './routes/teams.route.js'
import sonarComponentsRoutes from "./routes/sonaqube/components.route.js"
import healthRoutes from './routes/health.route.js'
import cors from 'cors';
import { specs, swaggerUi } from './config/swagger.js';

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

app.use(express.json({ limit: '500mb' }));
app.use(cors());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Weaver Quality Lens API Documentation',
}));

// Redirect root to API documentation
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

app.use('/api', [healthRoutes, testplanMetricsRoutes, organizationRoutes, teamsMetricsRoutes, sonarComponentsRoutes])

app.listen(port, () => {
  console.log(`Server running on ${port}`)
})
