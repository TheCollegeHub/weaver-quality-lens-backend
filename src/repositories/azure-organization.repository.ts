import { azureClient } from '../utils/azure-client.js';
const AZURE_API_VERSION = process.env.AZURE_API_VERSION;
const ADO_PROJECT = process.env.ADO_PROJECT

export async function fetchAreaNodes(path = '') {
  const url = `/${ADO_PROJECT}/_apis/wit/classificationnodes/areas${path}?$depth=10&api-version=${AZURE_API_VERSION}`;
  const response = await azureClient.get(url);
  return response.data;
}

export async function fetchTeamIterations() {
  const url = `/${ADO_PROJECT}/_apis/work/teamsettings/iterations?api-version=${AZURE_API_VERSION}`;
   const { data } = await azureClient.get(url);
   return data
}

