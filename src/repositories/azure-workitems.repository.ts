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

 


 