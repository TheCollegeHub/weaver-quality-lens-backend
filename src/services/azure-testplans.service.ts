import { AutomationMetricsResponse, PlanAutomationCoverage, PlanMetrics, SuiteAutomationCoverage, TeamTestPlans, TestCaseInfo } from "../interfaces/testplans-interface.js";
import { TestPlan } from '../interfaces/testplans-interface.js';
import { getEffectiveStatus, getEmptyPlanResponse } from "./utils.js";
import { AutomationStatus } from "../enums/automaton-status.js";
import { NewAutomatedTestsData } from "../interfaces/sprint-automation-metrics-interface.js";
import { fetchRecentTestRuns, fetchTestResultsByRun, fetchWiql, fetchWorkItemById, fetchWorkItemRevisions, fetchWorkItemsBatch, fetchWorkItemsByIds } from "../repositories/azure-workitems.repository.js";
import { fetchTestCasesFromSuite, fetchTestPlanSuites, fetchTestPointsFromSuite } from "../repositories/azure-testplans.repository.js";
import { AzureApiError, AzureErrorHandler, ErrorCodes } from '../utils/azure-error-handler.js';
import { AxiosError } from 'axios';
import _ from "lodash";

const ADO_ORGANIZATION = process.env.ADO_ORGANIZATION
const ADO_PROJECT = process.env.ADO_PROJECT!;

const ADO_AUTOMATION_STATUS_FIELD = process.env.ADO_AUTOMATION_STATUS_FIELD
const ADO_CUSTOM_AUTOMATION_STATUS_FIELD = process.env.ADO_CUSTOM_AUTOMATION_STATUS_FIELD
const ADO_TESTING_TYPE_FIELD = process.env.ADO_TESTING_TYPE_FIELD
const ADO_AUTOMATION_TOOLS_FIELD = process.env.ADO_AUTOMATION_TOOLS_FIELD

const CHUNK_SIZE = 200

export async function getTestPlansByAreaPaths(
  areaPaths: string[]
): Promise<TeamTestPlans[]> {
  // Input validation
  if (!areaPaths || areaPaths.length === 0) {
    throw new AzureApiError(
      'areaPaths parameter is required and must contain at least one area path',
      400,
      ErrorCodes.INVALID_CONFIG
    );
  }

  // Validate environment configuration
  if (!ADO_PROJECT) {
    throw new AzureApiError(
      'Azure DevOps project not configured. ADO_PROJECT environment variable is required.',
      500,
      ErrorCodes.MISSING_CONFIG
    );
  }

  // Sanitize and validate area paths
  const sanitizedAreaPaths = areaPaths.map(path => path.trim()).filter(Boolean);
  
  if (sanitizedAreaPaths.length === 0) {
    throw new AzureApiError(
      'No valid area paths provided after sanitization',
      400,
      ErrorCodes.INVALID_CONFIG
    );
  }

  const wiqlQuery = {
    query: `
      SELECT [System.Id], [System.Title], [System.AreaPath]
      FROM WorkItems
      WHERE [System.WorkItemType] = 'Test Plan'
      AND [System.AreaPath] IN (${sanitizedAreaPaths.map(path => `'${path.replace(/'/g, "''")}'`).join(',')})
      ORDER BY [System.CreatedDate] DESC
    `,
  };

  let attempts = 0;
  const maxRetries = 3;
  const retryDelay = 1000; // Start with 1 second

  while (attempts < maxRetries) {
    try {
      attempts++;
      console.log(`Attempting to fetch test plans (attempt ${attempts}/${maxRetries}) for area paths: ${sanitizedAreaPaths.join(', ')}`);

      const wiqlResponse = await fetchWiql(wiqlQuery);

      // Validate response structure
      if (!wiqlResponse || !wiqlResponse.data) {
        throw new AzureApiError(
          'Invalid response structure from Azure DevOps WIQL query',
          500,
          ErrorCodes.INVALID_RESPONSE
        );
      }

      const workItems = wiqlResponse.data.workItems || [];
      const ids = workItems.map((wi: any) => wi.id).filter(Boolean);

      console.log(`Found ${ids.length} test plan IDs from WIQL query`);

      // Return empty results if no test plans found
      if (ids.length === 0) {
        console.log('No test plans found for the specified area paths');
        return sanitizedAreaPaths.map(area => ({
          team: area,
          totalTestPlans: 0,
          testplans: [],
        }));
      }

      // Process in chunks to respect Azure DevOps API limits
      const idChunks = _.chunk(ids, CHUNK_SIZE);
      console.log(`Processing ${ids.length} test plans in ${idChunks.length} chunks`);

      const detailPromises = idChunks.map(async (chunkIds, index) => {
        try {
          console.log(`Fetching details for chunk ${index + 1}/${idChunks.length} (${chunkIds.length} items)`);
          return await fetchWorkItemsByIds(chunkIds.join(','), 'System.Id,System.Title,System.AreaPath');
        } catch (error) {
          console.error(`Error fetching chunk ${index + 1}:`, error);
          if (error instanceof AxiosError) {
            throw AzureErrorHandler.handleAxiosError(error, `fetchWorkItemsByIds chunk ${index + 1}`);
          }
          throw error;
        }
      });

      const detailResponses = await Promise.all(detailPromises);
      
      // Validate and process responses
      const rawPlans = detailResponses.flatMap((res: { data: { value: any[]; }; }) => {
        if (!res || !res.data || !Array.isArray(res.data.value)) {
          console.warn('Invalid response structure in work items batch');
          return [];
        }
        
        return res.data.value.map((item: any) => {
          if (!item || !item.fields) {
            console.warn('Invalid work item structure:', item);
            return null;
          }
          
          return {
            id: item.id,
            name: item.fields['System.Title'] || 'Untitled Test Plan',
            areaPath: item.fields['System.AreaPath'],
          };
        }).filter(Boolean);
      });

      console.log(`Successfully processed ${rawPlans.length} test plans`);

      // Debug: Log area paths for comparison
      console.log('Input area paths:', sanitizedAreaPaths);
      if (rawPlans.length > 0) {
        console.log('Sample Azure DevOps area paths:', [...new Set(rawPlans.map(p => p?.areaPath).filter(Boolean))].slice(0, 5));
      }

      // Normalize area paths for comparison (handle backslash escaping issues)
      const normalizeAreaPath = (path: string): string => {
        return path.replace(/\\\\/g, '\\'); // Convert double backslashes to single
      };

      // Create a map of normalized paths to original input paths
      const normalizedInputPaths = new Map<string, string>();
      sanitizedAreaPaths.forEach(path => {
        const normalized = normalizeAreaPath(path);
        normalizedInputPaths.set(normalized, path);
      });

      // Group by area path using normalized comparison
      const grouped: TeamTestPlans[] = sanitizedAreaPaths.map(area => {
        const normalizedArea = normalizeAreaPath(area);
        const plans = rawPlans.filter((p: any) => {
          if (!p || !p.areaPath) return false;
          const normalizedPlanArea = normalizeAreaPath(p.areaPath);
          return normalizedPlanArea === normalizedArea;
        });
        
        console.log(`Area path "${area}" (normalized: "${normalizedArea}") matched ${plans.length} test plans`);
        
        return {
          team: normalizedArea, // Return normalized path to avoid double backslashes
          totalTestPlans: plans.length,
          testplans: plans.map((p: any) => ({
            id: p.id,
            name: p.name,
          })),
        };
      });

      console.log(`Returning results for ${grouped.length} teams with total ${rawPlans.length} test plans`);
      return grouped;

    } catch (error: any) {
      console.error(`Attempt ${attempts} failed:`, error);

      // Handle specific Azure API errors
      if (error instanceof AzureApiError) {
        // Don't retry client errors (4xx) except for rate limiting
        if (error.statusCode >= 400 && error.statusCode < 500 && error.code !== ErrorCodes.RATE_LIMIT) {
          throw error;
        }
        
        // Retry server errors and rate limiting
        if (attempts < maxRetries && (error.isRetryable || error.statusCode >= 500)) {
          const delay = retryDelay * Math.pow(2, attempts - 1); // Exponential backoff
          console.log(`Retrying in ${delay}ms... (${maxRetries - attempts} attempts remaining)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }

      // Handle Axios errors
      if (error.isAxiosError) {
        const azureError = AzureErrorHandler.handleAxiosError(error as AxiosError, 'getTestPlansByAreaPaths');
        
        // Retry on server errors or rate limiting
        if (attempts < maxRetries && (azureError.isRetryable || azureError.statusCode >= 500)) {
          const delay = retryDelay * Math.pow(2, attempts - 1);
          console.log(`Retrying in ${delay}ms... (${maxRetries - attempts} attempts remaining)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw azureError;
      }

      // Handle other errors
      if (attempts < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempts - 1);
        console.log(`Unknown error, retrying in ${delay}ms... (${maxRetries - attempts} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Final attempt failed
      throw new AzureApiError(
        `Failed to fetch test plans after ${maxRetries} attempts: ${error.message}`,
        500,
        ErrorCodes.API_ERROR
      );
    }
  }

  // This should never be reached, but included for completeness
  throw new AzureApiError(
    'Unexpected error: retry loop completed without success or failure',
    500,
    ErrorCodes.UNKNOWN_ERROR
  );
}

export async function getAutomationMetricsForPlans(
  testPlans: TestPlan[],
  startDate?: string,
  endDate?: string
): Promise<AutomationMetricsResponse> {
  const testCaseToPlans = new Map<number, Set<number>>();
  const planNamesMap = new Map<number, string>();

  await Promise.all(testPlans.map(async ({ id: planId, name: planName }) => {
    planNamesMap.set(planId, planName);
    const suitesRes = await fetchTestPlanSuites(planId);
    await Promise.all(suitesRes.data.value.map(async (suite: any) => {
      const casesRes = await fetchTestCasesFromSuite(planId, suite.id)
      for (const testCase of casesRes.data.value) {
        const id = Number(testCase.testCase.id);
        const set = testCaseToPlans.get(id) || new Set<number>();
        set.add(planId);
        testCaseToPlans.set(id, set);
      }
    }));
  }));

  const allTestCaseIds = Array.from(testCaseToPlans.keys());
  if (!allTestCaseIds.length) return { overall: emptyOverall(), plans: [] };

  // CHUNKING: Azure DevOps allows until 200 IDs per request
  const chunks: number[][] = [];
  for (let i = 0; i < allTestCaseIds.length; i += CHUNK_SIZE) {
    chunks.push(allTestCaseIds.slice(i, i + CHUNK_SIZE));
  }

  const batchResults: any[] = [];
  for (const chunk of chunks) {
    const res = await fetchWorkItemsBatch({
        ids: chunk,
        fields: [
          ADO_CUSTOM_AUTOMATION_STATUS_FIELD!,
          ADO_AUTOMATION_STATUS_FIELD!,
          ADO_TESTING_TYPE_FIELD!,
          ADO_AUTOMATION_TOOLS_FIELD!
        ]
      })
    batchResults.push(...res.data.value);
  }

  const metricsMap = new Map<number, PlanMetrics>();
  const overallLinks = { manual: [] as string[], automated: [] as string[] };
  const overallCategoryMap = new Map<string, { manual: number; automated: number }>();
  const overallToolMap = new Map<string, number>();
  const overallNewAutomatedLinks: string[] = [];
  let overallManual = 0, overallAutomated = 0;
  let overallToBeExecuted = 0, overallNotExecuted = 0;
  let overallNewAutomated = 0;

  for (const item of batchResults) {
    const id = Number(item.id);
    const status: AutomationStatus = getEffectiveStatus(item.fields);
    const category = item.fields[ADO_TESTING_TYPE_FIELD!] || 'Uncategorized';
    const tool = item.fields[ADO_AUTOMATION_TOOLS_FIELD!] || 'UnknownTool';
    const link = `https://dev.azure.com/${process.env.ADO_ORGANIZATION}/${ADO_PROJECT}/_workitems/edit/${id}`;

    if (!overallCategoryMap.has(category)) {
      overallCategoryMap.set(category, { manual: 0, automated: 0 });
    }

    const cat = overallCategoryMap.get(category)!;
    if (status === AutomationStatus.Automated) {
      overallAutomated++;
      overallLinks.automated.push(link);
      cat.automated++;
    } else {
      overallManual++;
      overallLinks.manual.push(link);
      cat.manual++;
    }

    overallToolMap.set(tool, (overallToolMap.get(tool) || 0) + 1);

    for (const planId of testCaseToPlans.get(id)!) {
      if (!metricsMap.has(planId)) {
        metricsMap.set(planId, emptyPlan(planId, planNamesMap.get(planId)!));
      }

      const pm = metricsMap.get(planId)!;

      if (status === AutomationStatus.Automated) {
        pm.automated++;
        pm.links.automated.push(link);
      } else {
        pm.manual++;
        pm.links.manual.push(link);
      }

      pm.categories = upsertCategory(pm.categories, category, status);
      pm.tools = upsertTool(pm.tools, tool);
    }
  }

  const plans: PlanMetrics[] = [];
  await Promise.all(Array.from(metricsMap.values()).map(async pm => {
    pm.total = pm.manual + pm.automated;
    pm.automationCoverage = pm.total ? ((pm.automated / pm.total) * 100).toFixed(2) : '0.00';

    const results: string[] = [];
    const suitesRes = await fetchTestPlanSuites(pm.planId);
    await Promise.all(suitesRes.data.value.map(async (suite: any) => {
      const pointsRes = await fetchTestPointsFromSuite(pm.planId,suite.id);
      pointsRes.data.value.forEach((p: any) => results.push(p.outcome));
    }));

    const passedCount = results.filter(o => o === 'Passed').length;
    const notExecutedCount = results.filter(o => o === 'Unspecified').length;
    const executedResults = results.filter(o => o !== 'Unspecified').length;

    pm.executionCoverage = results.length ? parseFloat(((executedResults / results.length) * 100).toFixed(2)) : 0.00;
    pm.passRate = executedResults
      ? parseFloat(((passedCount / executedResults) * 100).toFixed(2))
      : 0.00;

    pm.totalToBeExecuted = results.length;
    pm.totalNotExecuted = notExecutedCount;
    overallToBeExecuted += results.length;
    overallNotExecuted += notExecutedCount;

    if (startDate && endDate) {
      const newAutomatedData: NewAutomatedTestsData = await countNewAutomatedInPlan(pm.planId, new Date(startDate), new Date(endDate));
      pm.newAutomated = newAutomatedData;
      overallNewAutomatedLinks.push(...newAutomatedData.links);
      pm.automationGrowth = pm.automated
        ? parseFloat(((newAutomatedData.count / pm.total) * 100).toFixed(2))
        : 0.00;
      overallNewAutomated += newAutomatedData.count;
    }

    plans.push(pm);
  }));

  const overallTotal = overallManual + overallAutomated;
  const categories = Array.from(overallCategoryMap, ([name, v]) => ({ name, ...v }));
  const tools = Array.from(overallToolMap, ([name, total]) => ({ name, total }));
  const overalAutomationGrowth = overallNewAutomated
    ? parseFloat(((overallNewAutomated / overallTotal) * 100).toFixed(2))
    : 0.00;

  return {
    overall: {
      manual: overallManual,
      automated: overallAutomated,
      total: overallTotal,
      totalToBeExecuted: overallToBeExecuted,
      totalNotExecuted: overallNotExecuted,
      automationCoverage: overallTotal ? ((overallAutomated / overallTotal) * 100).toFixed(2) : '0.00',
      passRate: plans.length ? parseFloat((plans.reduce((sum, p) => sum + p.passRate, 0) / plans.length).toFixed(2)) : 0.00,
      executionCoverage: plans.length ? parseFloat((plans.reduce((sum, p) => sum + p.executionCoverage, 0) / plans.length).toFixed(2)) : 0.00,
      ...(startDate && endDate
        ? {
            newAutomated: { count: overallNewAutomated, links: overallNewAutomatedLinks },
            automationGrowth: overalAutomationGrowth,
          }
        : {}),
      categories,
      tools,
      links: overallLinks,
    },
    plans
  };
}

export async function getAutomationCoveragePerSuite(
  testPlans: TestPlan[]
): Promise<PlanAutomationCoverage[]> {
  const coverage: PlanAutomationCoverage[] = [];

  for (const { id: planId, name: planName } of testPlans) {
    const suitesRes = await fetchTestPlanSuites(planId);

    const suites: SuiteAutomationCoverage[] = [];
    let totalManual = 0;
    let totalAutomated = 0;
    const uniqueTestCaseIds = new Set<number>();

    for (const suite of suitesRes.data.value) {
      const casesRes = await fetchTestCasesFromSuite(planId, suite.id);
      const testCaseIds: number[] = casesRes.data.value.map((tc: any) => Number(tc.testCase.id));
      const newTestCaseIds = testCaseIds.filter(id => !uniqueTestCaseIds.has(id));

      if (!newTestCaseIds.length) continue;

      const chunkedIds = _.chunk(newTestCaseIds, CHUNK_SIZE);
      let suiteManual = 0;
      let suiteAutomated = 0;

      for (const idChunk of chunkedIds) {

        const batchRes = await fetchWorkItemsBatch({
            ids: idChunk,
            fields: [
              ADO_AUTOMATION_STATUS_FIELD!,
              ADO_CUSTOM_AUTOMATION_STATUS_FIELD!
            ]
          })

        for (const item of batchRes.data.value) {
          const status: AutomationStatus = getEffectiveStatus(item.fields);
          uniqueTestCaseIds.add(item.id);

          if (status === AutomationStatus.Automated) {
            suiteAutomated++;
          } else {
            suiteManual++;
          }
        }
      }

      const suiteTotal = suiteManual + suiteAutomated;
      const automationCoverage = suiteTotal
        ? parseFloat(((suiteAutomated / suiteTotal) * 100).toFixed(2))
        : 0.00;

      suites.push({
        suiteId: suite.id,
        suiteName: suite.name,
        manual: suiteManual,
        automated: suiteAutomated,
        total: suiteTotal,
        automationCoverage
      });

      totalManual += suiteManual;
      totalAutomated += suiteAutomated;
    }

    const totalTests = totalManual + totalAutomated;
    const totalCoverage = totalTests
      ? parseFloat(((totalAutomated / totalTests) * 100).toFixed(2))
      : 0.00;

    coverage.push({
      planId,
      planName,
      totalManual,
      totalAutomated,
      totalTests,
      totalCoverage,
      suites
    });
  }

  return coverage;
}

export async function countNewAutomatedInPlan(
  planId: number,
  startDate: Date,
  endDate: Date
): Promise<NewAutomatedTestsData> {
  const suitesRes = await fetchTestPlanSuites(planId);
  const suites: any[] = suitesRes.data.value;

  const allTestCaseIds = new Set<number>();

  await Promise.all(
    suites.map(async (suite) => {
      const casesRes = await fetchTestCasesFromSuite(planId, suite.id)
      for (const tc of casesRes.data.value) {
        allTestCaseIds.add(Number(tc.testCase.id));
      }
    })
  );

  const automatedTestCaseIds: number[] = [];

  await Promise.all(
    Array.from(allTestCaseIds).map(async (testCaseId) => {
      const wiRes = await fetchWorkItemById(testCaseId,`${ADO_AUTOMATION_STATUS_FIELD},${ADO_CUSTOM_AUTOMATION_STATUS_FIELD}`)
      const fields = wiRes.data.fields;
      const status: AutomationStatus = getEffectiveStatus(fields);

      if (status === AutomationStatus.Automated) {
        automatedTestCaseIds.push(testCaseId);
      }
    })
  );

  let count = 0;
  const links: string[] = [];

  await Promise.all(
    automatedTestCaseIds.map(async (testCaseId) => {
      const revRes = await fetchWorkItemRevisions(testCaseId);
      const revisions = revRes.data.value;

      for (let i = 1; i < revisions.length; i++) {
        const prevStatus = getEffectiveStatus(revisions[i - 1].fields);
        const currStatus = getEffectiveStatus(revisions[i].fields);
        const changedAt = new Date(revisions[i].fields['System.ChangedDate']);

        if (
          changedAt >= startDate &&
          changedAt <= endDate &&
          prevStatus !== AutomationStatus.Automated &&
          currStatus === AutomationStatus.Automated
        ) {
          count++;
          links.push(`https://dev.azure.com/${ADO_ORGANIZATION}/${ADO_PROJECT}/_workitems/edit/${testCaseId}`);
          break;
        }
      }
    })
  );

  return { count, links };
}

export async function getTestPlanData(areaPath: string, iterationPath: string) {
  const wiql = {
    query: `
      SELECT [System.Id]
      FROM workitems
      WHERE
        [System.TeamProject] = '${decodeURIComponent(ADO_PROJECT!)}'
        AND [System.WorkItemType] = 'Test Plan'
        AND [System.AreaPath] UNDER '${areaPath}'
        AND [System.IterationPath] = '${iterationPath}'
      ORDER BY [System.ChangedDate] DESC
    `,
  };

  const wiqlRes = await fetchWiql(wiql)

  const workItemIds: number[] = wiqlRes.data.workItems?.map((w: any) => w.id) ?? [];

  if (workItemIds.length === 0) {
    return getEmptyPlanResponse();
  }

  const allWorkItems: any[] = [];

  for (let i = 0; i < workItemIds.length; i += CHUNK_SIZE) {
    const chunk = workItemIds.slice(i, i + CHUNK_SIZE);
    const res = await fetchWorkItemsByIds(chunk.join(','), 'System.Title')
    allWorkItems.push(...res.data.value);
  }

  const testPlans: TestPlan[] = allWorkItems.map(wi => ({
    id: wi.id,
    name: wi.fields['System.Title'],
  }));

  if (testPlans.length === 0) {
    return getEmptyPlanResponse();
  }

  const responseTestPlanMetrics = await getAutomationMetricsForPlans(testPlans);

  return {
    plan: testPlans[0],
    metrics: responseTestPlanMetrics,
  };
}

export async function getReadyTestCasesByAreaPaths(areaPaths: string[]) {
  const allTestCaseIds: number[] = [];
  const allTestCases: any[] = [];

  const overallByTeam: {
    areaPath: string;
    total: number;
    manual: number;
    automated: number;
    automationCoverage: number;
  }[] = [];

  for (const area of areaPaths) {
    const wiqlQuery = {
      query: `
        SELECT [System.Id] FROM WorkItems
        WHERE
          [System.WorkItemType] = 'Test Case'
          AND [System.State] <> 'Closed'
          AND [System.AreaPath] UNDER '${area}'
      `
    };

    const result = await fetchWiql(wiqlQuery);
    const testCaseIds = result.data?.workItems?.map((item: any) => item.id) || [];

    if (testCaseIds.length === 0) {
      overallByTeam.push({
        areaPath: area,
        total: 0,
        automated: 0,
        manual: 0,
        automationCoverage: 0
      });
      continue;
    }

    const chunks: number[][] = [];
    for (let i = 0; i < testCaseIds.length; i += CHUNK_SIZE) {
      chunks.push(testCaseIds.slice(i, i + CHUNK_SIZE));
    }

    const areaTestCases: any[] = [];

    for (const chunk of chunks) {
      const res = await fetchWorkItemsBatch({
        ids: chunk,
        fields: [
          'System.Id',
          'System.Title',
          'System.State',
          'System.AreaPath',
          process.env.ADO_CUSTOM_AUTOMATION_STATUS_FIELD!,
          process.env.ADO_AUTOMATION_STATUS_FIELD!,
          process.env.ADO_TESTING_TYPE_FIELD!,
          process.env.ADO_AUTOMATION_TOOLS_FIELD!
        ]
      });

      areaTestCases.push(...res.data.value);
    }

    let automated = 0;

    for (const item of areaTestCases) {
      const status: AutomationStatus = getEffectiveStatus(item.fields);
      if (status === AutomationStatus.Automated) automated++;
    }

    const total = areaTestCases.length;
    const manual = total - automated;
    const automationCoverage = total > 0 ? Number(((automated / total) * 100).toFixed(2)) : 0;

    overallByTeam.push({
      areaPath: area,
      total,
      automated,
      manual,
      automationCoverage
    });

    allTestCaseIds.push(...testCaseIds);
    allTestCases.push(...areaTestCases);
  }

  const total = allTestCases.length;
  const automated = overallByTeam.reduce((sum, team) => sum + team.automated, 0);
  const manual = total - automated;
  const automationCoverage = total > 0 ? Number(((automated / total) * 100).toFixed(2)) : 0;

  return {
    testCases: allTestCases,
    overall: {
      total,
      automated,
      manual,
      automationCoverage
    },
    overallByTeam
  };
}



export async function getTestCaseUsageStatus(testCases: TestCaseInfo[]) {
  console.log()
  const recentRuns = await fetchRecentTestRuns();
  const usedTestCasesMap = new Map<number, string>();

  for (const run of recentRuns) {
    const results = await fetchTestResultsByRun(run.id);

    for (const result of results) {
      const testCaseId = Number(result.testCase?.id);
      const testCaseTitle = result.testCaseTitle;
      if (testCaseId && testCaseTitle) {
        usedTestCasesMap.set(testCaseId, testCaseTitle);
      }
    }
  }

  const used: TestCaseInfo[] = [];
  const unused: TestCaseInfo[] = [];

  for (const testCase of testCases) {
    if (usedTestCasesMap.has(testCase.id)) {
      used.push(testCase);
    } else {
      unused.push(testCase);
    }
  }

  return {
    used,
    unused,
    overall: {
      totalUsed: used.length,
      totalUnused: unused.length,
      total: testCases.length
    }
  };
}


function emptyOverall(): AutomationMetricsResponse['overall'] {
  return { manual: 0, automated: 0, total: 0, totalToBeExecuted: 0, totalNotExecuted: 0, automationCoverage: '0.00', passRate: 0.00, executionCoverage: 0.00, newAutomated: {count: 0, links: []}, automationGrowth: 0.00, categories: [], tools: [], links: { manual: [], automated: [] } };
}

function emptyPlan(id: number, name: string): PlanMetrics {
  return { planId: id, planName: name, manual: 0, automated: 0, total: 0, totalToBeExecuted: 0, totalNotExecuted: 0, automationCoverage: '0.00', newAutomated: {count: 0, links: []}, automationGrowth: 0.00 , passRate: 0.00, executionCoverage: 0.00 , categories: [], tools: [], links: { manual: [], automated: [] } };
}

function upsertCategory(arr: any[], name: string, status: string) {
  let c = arr.find(x => x.name === name);
  if (!c) { c = { name, manual: 0, automated: 0 }; arr.push(c); }
  status === 'Automated' ? c.automated++ : c.manual++;
  return arr;
}

function upsertTool(arr: any[], name: string) {
  let t = arr.find(x => x.name === name);
  if (t) t.total++; else arr.push({ name, total: 1 });
  return arr;
}