import express from 'express';
import dotenv from 'dotenv';
import metricsRouter from './routes/metrics.route.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/metrics', metricsRouter);

export default app;
