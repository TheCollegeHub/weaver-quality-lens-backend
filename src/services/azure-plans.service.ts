import { AutomationMetricsResponse, PlanAutomationCoverage, PlanMetrics, SuiteAutomationCoverage } from "../interfaces/testplans-interface";
import { azureClient } from '../utils/azureClient.js';
import { TestPlan } from '../interfaces/testplans-interface.js';
import { getEffectiveStatus } from "./utils.js";
import { AutomationStatus } from "../enums/automaton-status.js";
import { countNewAutomatedInPlan } from "./azure.service.js";
import { NewAutomatedTestsData } from "../interfaces/sprint-automation-metrics-interface.js";
const ADO_AUTOMATION_STATUS_FIELD = process.env.ADO_AUTOMATION_STATUS_FIELD
const ADO_CUSTOM_AUTOMATION_STATUS_FIELD = process.env.ADO_CUSTOM_AUTOMATION_STATUS_FIELD
const ADO_TESTING_TYPE_FIELD = process.env.ADO_TESTING_TYPE_FIELD
const ADO_AUTOMATION_TOOLS_FIELD = process.env.ADO_AUTOMATION_TOOLS_FIELD
const ADO_PROJECT = process.env.ADO_PROJECT!;
const AZURE_API_VERSION = process.env.AZURE_API_VERSION!;

export async function getAutomationMetricsForPlans(
  testPlans: TestPlan[],
  startDate?: string,
  endDate?: string
): Promise<AutomationMetricsResponse> {
  const testCaseToPlans = new Map<number, Set<number>>();
  const planNamesMap = new Map<number, string>();

  await Promise.all(testPlans.map(async ({ id: planId, name: planName }) => {
    planNamesMap.set(planId, planName);
    const suitesRes = await azureClient.get(
      `/${ADO_PROJECT}/_apis/testplan/plans/${planId}/suites?api-version=${AZURE_API_VERSION}`
    );
    await Promise.all(suitesRes.data.value.map(async (suite: any) => {
      const casesRes = await azureClient.get(
        `/${ADO_PROJECT}/_apis/test/plans/${planId}/suites/${suite.id}/testcases?api-version=${AZURE_API_VERSION}`
      );
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

  const batchRes = await azureClient.post(
    `/_apis/wit/workitemsbatch?api-version=${AZURE_API_VERSION}`,
    {
      ids: allTestCaseIds,
      fields: [
        ADO_CUSTOM_AUTOMATION_STATUS_FIELD,
        ADO_AUTOMATION_STATUS_FIELD,
        ADO_TESTING_TYPE_FIELD,
        ADO_AUTOMATION_TOOLS_FIELD
      ]
    }
  );

  const metricsMap = new Map<number, PlanMetrics>();
  const overallLinks = { manual: [] as string[], automated: [] as string[] };
  const overallCategoryMap = new Map<string, { manual: number; automated: number }>();
  const overallToolMap = new Map<string, number>();
  const overallNewAutomatedLinks: string[] = [];;
  let overallManual = 0, overallAutomated = 0;
  let overallToBeExecuted = 0, overallNotExecuted = 0;
  let overallNewAutomated = 0;

  for (const item of batchRes.data.value) {
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
    const suitesRes = await azureClient.get(
      `/${ADO_PROJECT}/_apis/testplan/plans/${pm.planId}/suites?api-version=${AZURE_API_VERSION}`
    );
    await Promise.all(suitesRes.data.value.map(async (suite: any) => {
      const pointsRes = await azureClient.get(
        `/${ADO_PROJECT}/_apis/test/plans/${pm.planId}/suites/${suite.id}/points?api-version=${AZURE_API_VERSION}`
      );
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
      overallNewAutomatedLinks.push(...newAutomatedData.links)
      pm.automationGrowth= pm.automated
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
            newAutomated: { count: overallNewAutomated , links: overallNewAutomatedLinks},
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
    const suitesRes = await azureClient.get(
      `/${ADO_PROJECT}/_apis/testplan/plans/${planId}/suites?api-version=${AZURE_API_VERSION}`
    );

    const suites: SuiteAutomationCoverage[] = [];
    let totalManual = 0;
    let totalAutomated = 0;
    const uniqueTestCaseIds = new Set<number>();

    for (const suite of suitesRes.data.value) {
      const casesRes = await azureClient.get(
        `/${ADO_PROJECT}/_apis/test/plans/${planId}/suites/${suite.id}/testcases?api-version=${AZURE_API_VERSION}`
      );

      const testCaseIds: number[] = casesRes.data.value.map((tc: any) => Number(tc.testCase.id));
      const newTestCaseIds = testCaseIds.filter(id => !uniqueTestCaseIds.has(id));

      if (!newTestCaseIds.length) continue;

      const batchRes = await azureClient.post(
        `/_apis/wit/workitemsbatch?api-version=${AZURE_API_VERSION}`,
        {
          ids: newTestCaseIds,
          fields: [
            ADO_AUTOMATION_STATUS_FIELD,
            ADO_CUSTOM_AUTOMATION_STATUS_FIELD
          ]
        }
      );

      let suiteManual = 0;
      let suiteAutomated = 0;

      for (const item of batchRes.data.value) {
        const status: AutomationStatus = getEffectiveStatus(item.fields);
        uniqueTestCaseIds.add(item.id);

        if (status === AutomationStatus.Automated) {
          suiteAutomated++;
        } else {
          suiteManual++;
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
      totalCoverage: totalCoverage,
      suites
    });
  }

  return coverage;
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