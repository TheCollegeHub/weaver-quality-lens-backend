import { azureClient } from "../utils/azure-client";
const AZURE_API_VERSION = process.env.AZURE_API_VERSION;
const ADO_PROJECT = process.env.ADO_PROJECT

export async function fetchTestPlanSuites(planId: number) {
  const response = await azureClient.get(
      `/${ADO_PROJECT}/_apis/testplan/plans/${planId}/suites?api-version=${AZURE_API_VERSION}`
    );
  return response;
}

export async function fetchTestCasesFromSuite(planId: number, suiteId: number) {
 const response = await azureClient.get(
        `/${ADO_PROJECT}/_apis/test/plans/${planId}/suites/${suiteId}/testcases?api-version=${AZURE_API_VERSION}`
      );

  return response;
}

export async function fetchTestPointsFromSuite(planId: number, suiteId: number) {
 const response = await azureClient.get(
        `/${ADO_PROJECT}/_apis/test/plans/${planId}/suites/${suiteId}/points?api-version=${AZURE_API_VERSION}`
      );
  return response;
}




