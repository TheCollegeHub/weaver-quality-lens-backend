import axios from 'axios';
import https from 'https';
import axiosRetry from 'axios-retry';

const sonarToken = process.env.SONAR_ACCESS_TOKEN;
const auth = Buffer.from(`${sonarToken}:`).toString("base64");

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10
});

export const sonarClient = axios.create({
  baseURL: process.env.SONAR_DOMAIN,
  timeout: 20000,
  httpsAgent,
   headers: {
    Authorization: `Basic ${auth}`,
  },
});

axiosRetry(sonarClient, {
  retries: 3,
  retryCondition: (error) =>
    error.code === 'ECONNRESET' || axiosRetry.isNetworkError(error),
  retryDelay: axiosRetry.exponentialDelay,
});
