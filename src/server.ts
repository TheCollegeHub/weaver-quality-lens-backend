import express from 'express'
import dotenv from 'dotenv'
import testplanMetricsRoutes from './routes/testplans.route.js'
import organizationRoutes from './routes/organization.route.js'
import teamsMetricsRoutes from './routes/teams.route.js'
import cors from 'cors';

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use(cors());
app.use('/api', [testplanMetricsRoutes, organizationRoutes, teamsMetricsRoutes])

app.listen(port, () => {
  console.log(`Server running on ${port}`)
})
