import express from 'express'
import dotenv from 'dotenv'
import metricsRoutes from './routes/metrics.route.js'
import organizationRoutes from './routes/organization.route.js'
import bugMetricsRoutes from './routes/bugs-metrics.route.js'
import cors from 'cors';

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use(cors());
app.use('/api', [metricsRoutes, organizationRoutes, bugMetricsRoutes])

app.listen(port, () => {
  console.log(`Server running on ${port}`)
})
