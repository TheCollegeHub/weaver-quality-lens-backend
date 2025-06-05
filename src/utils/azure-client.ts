import axios from 'axios';
import https from 'https';
import axiosRetry from 'axios-retry';

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10
});

export const azureClient = axios.create({
  baseURL: `https://dev.azure.com/${process.env.ADO_ORGANIZATION}`,
  timeout: 20000,
  httpsAgent,
  headers: {
    Authorization: `Basic ${Buffer.from(':' + process.env.ADO_PERSONAL_ACCESS_TOKEN).toString('base64')}`,
  }
});

axiosRetry(azureClient, {
  retries: 3,
  retryCondition: (error) =>
    error.code === 'ECONNRESET' || axiosRetry.isNetworkError(error),
  retryDelay: axiosRetry.exponentialDelay,
});
