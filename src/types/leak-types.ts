export interface LeakEnvDetail {
    environment: string;
    total: number;
    severities: Array<{ severity: string; total: number }>;
  }
  
  export interface TeamLeakageEntry {
    areaPath: string;
    sprint: string;
    totalBugs: number;
    bugLeakagePct: string;
    environments: LeakEnvDetail[];
  }
  
  export interface SprintOverallEntry {
    sprint: string;
    totalBugs: number;
    prod: number;
    preProd: number;
    bugLeakagePct: string;
    environments: LeakEnvDetail[];
  }
  
  export interface BugLeakageBySprintResult {
    teams: TeamLeakageEntry[];
    sprintOverall: SprintOverallEntry[];
  }