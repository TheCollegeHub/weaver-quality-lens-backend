import { azureClient } from '../utils/azure-client.js';
const AZURE_API_VERSION = process.env.AZURE_API_VERSION;
const ADO_PROJECT = process.env.ADO_PROJECT

export async function fetchWiql(wiqlQuery: { query: string }) {
  const response = await azureClient.post(`/${ADO_PROJECT}/_apis/wit/wiql?api-version=${AZURE_API_VERSION}`, wiqlQuery);
  return response;
}

export async function fetchWorkItemsBatch(batch: { ids: number[], fields: string[] }) {
  const response = await azureClient.post(`/_apis/wit/workitemsbatch?api-version=${AZURE_API_VERSION}`, batch);
  return response;
}

export async function fetchWorkItemsByIds(chunckStringIds: string, fields: string) {
  const response = await azureClient.get(
      `/_apis/wit/workitems?ids=${chunckStringIds}&fields=${fields}&api-version=${AZURE_API_VERSION}`
    );
  return response;
}

export async function fetchWorkItemById(workItemId: number, fields: string) {
  const response = await azureClient.get(
        `/${ADO_PROJECT}/_apis/wit/workitems/${workItemId}?fields=${fields}&api-version=${AZURE_API_VERSION}`
      );
  return response;
}

export async function fetchWorkItemRevisions(workItemId: number) {
  const response = await azureClient.get(
        `/${ADO_PROJECT}/_apis/wit/workitems/${workItemId}/revisions?api-version=${AZURE_API_VERSION}`
      );
  return response;
}

export async function fetchRecentTestRuns(days: number = 90) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  const runs: any[] = [];

  let current = new Date(start);
  while (current < now) {
    const next = new Date(current);
    next.setDate(next.getDate() + 7);
    if (next > now) next.setTime(now.getTime());

    const min = current.toISOString();
    const max = next.toISOString();

    const url = `/${ADO_PROJECT}/_apis/test/runs?minLastUpdatedDate=${min}&maxLastUpdatedDate=${max}&$top=100&api-version=7.1`;

    try {
      const response = await azureClient.get(url);
      runs.push(...response.data.value);
    } catch (err) {
      console.error(`Erro ao buscar runs entre ${min} e ${max}`, err);
    }

    current = next;
  }

  return runs;
}



export async function fetchTestResultsByRun(runId: number) {
  const url = `/${ADO_PROJECT}/_apis/test/runs/${runId}/results?api-version=${AZURE_API_VERSION}`;
  const response = await azureClient.get(url);
  return response.data.value;
}




 


 