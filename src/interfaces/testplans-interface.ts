import { NewAutomatedTestsData } from "./sprint-automation-metrics-interface";

export interface TestPlan {
  id: number;
  name: string;
}
  
export interface TeamTestPlans {
  team: string;
  totalTestPlans: number;
  testplans: TestPlan[];
}

export interface TestPlan {
  id: number;
  name: string;
}

export interface PlanMetrics {
  planId: number;
  planName: string;
  manual: number;
  automated: number;
  total: number;
  totalToBeExecuted: number,
  totalNotExecuted: number,
  automationCoverage: string;
  passRate: number;
  executionCoverage: number
  newAutomated?: NewAutomatedTestsData,
  automationGrowth?: number
  categories: {
    name: string;
    manual: number;
    automated: number;
  }[];
  tools: {
    name: string;
    total: number;
  }[];
  links: {
    manual: string[];
    automated: string[];
  };
}

export interface OverallMetrics {
  manual: number;
  automated: number;
  total: number;
  totalToBeExecuted: number,
  totalNotExecuted: number,
  automationCoverage: string;
  passRate: number;
  executionCoverage: number
  newAutomated?: NewAutomatedTestsData,
  automationGrowth?: number
  categories: {
    name: string;
    manual: number;
    automated: number;
  }[];
  tools: {
    name: string;
    total: number;
  }[];
  links: {
    manual: string[];
    automated: string[];
  };
}

export interface AutomationMetricsResponse {
  overall: OverallMetrics;
  plans: PlanMetrics[];
}

export interface SuiteAutomationCoverage {
  suiteId: number;
  suiteName: string;
  manual: number;
  automated: number;
  total: number;
  automationCoverage: string;
}

export interface PlanAutomationCoverage {
  planId: number;
  planName: string;
  totalManual: number;
  totalAutomated: number;
  totalTests: number;
  totalCoverage: string;
  suites: SuiteAutomationCoverage[];
}

