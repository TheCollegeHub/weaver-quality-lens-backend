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
  automationCoverage: string;
  passRate: string;
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
  automationCoverage: string;
  passRate: string;
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
