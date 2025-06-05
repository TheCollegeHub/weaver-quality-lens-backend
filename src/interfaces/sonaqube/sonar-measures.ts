export interface Measure {
  metric: string;
  value: string;
  bestValue?: boolean;
}

export interface ComponentMetrics {
  key: string;
  name: string;
  description?: string;
  qualifier: string;
  measures: Measure[];
}

export interface MetricsResponse {
  component: ComponentMetrics;
}