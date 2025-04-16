import axios from 'axios';

export const azureClient = axios.create({
  baseURL: `https://dev.azure.com/${process.env.ADO_ORGANIZATION}`,
  headers: {
    Authorization: `Basic ${Buffer.from(':' + process.env.ADO_PERSONAL_ACCESS_TOKEN).toString('base64')}`,
  }
});