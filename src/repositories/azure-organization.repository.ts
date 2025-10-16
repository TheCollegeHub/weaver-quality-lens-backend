import { azureClient } from '../utils/azure-client.js';
import { AxiosError } from 'axios';
import { AzureApiError, AzureErrorHandler, ErrorCodes } from '../utils/azure-error-handler';

const AZURE_API_VERSION = process.env.AZURE_API_VERSION;
const ADO_PROJECT = process.env.ADO_PROJECT;

export async function fetchAreaNodes(path = '') {
  // Validate environment variables
  AzureErrorHandler.validateEnvironment({
    ADO_PROJECT,
    AZURE_API_VERSION
  });

  const url = `/${ADO_PROJECT}/_apis/wit/classificationnodes/areas${path}?$depth=10&api-version=${AZURE_API_VERSION}`;
  const context = `fetchAreaNodes(${path || 'root'})`;
  
  try {
    const response = await azureClient.get(url);
    
    // Validate response structure
    if (!response.data) {
      throw AzureErrorHandler.handleDataError('Empty response from Azure DevOps API', ErrorCodes.EMPTY_RESPONSE);
    }
    
    return response.data;
  } catch (error) {
    if (error instanceof AzureApiError) {
      throw error;
    }
    
    if (error instanceof AxiosError) {
      throw AzureErrorHandler.handleAxiosError(error, context);
    }
    
    // Handle network/timeout errors
    throw AzureErrorHandler.handleNetworkError(error, context);
  }
}

export async function fetchTeamIterations() {
  const url = `/${ADO_PROJECT}/_apis/work/teamsettings/iterations?api-version=${AZURE_API_VERSION}`;
   const { data } = await azureClient.get(url);
   return data
}

