export interface SprintMetrics {
    sprintName: string;
    planName: string;
    totalTestCases: number;
    totalTestCasesBeExecuted: number;
    totalTestCasesExecuted: number;
    totalTestCasesNotExecuted: number;
    passRate: number;
    executionCoverage: number,
    manualTests: number;
    automatedTests: number;
};

export interface TeamMetrics {
areaPath: string;
sprints: SprintMetrics[];
};

export interface MetricsResponse {
teams: TeamMetrics[];
sprintsOverall: SprintMetrics[];
overall: SprintMetrics; 
};

export interface SprintTestPlanData {
    totalTestCases: number;
    totalTestCasesBeExecuted: number;
    totalTestCasesNotExecuted: number;
    passRate: number;
    manual: number;
};

export interface NewAutomatedTestsData{
    count: number; 
    links: string[]
}