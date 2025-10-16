/**
 * Common types and interfaces for Azure DevOps API integration
 */

export interface AreaNode {
  name: string;
  identifier?: string;
  children?: AreaNode[];
}

export interface AreaPath {
  id: string;
  name: string;
}

/**
 * Azure DevOps API response wrapper
 */
export interface AzureApiResponse<T> {
  value?: T[];
  count?: number;
}

/**
 * Configuration interface for Azure DevOps
 */
export interface AzureConfig {
  organization: string;
  project: string;
  personalAccessToken: string;
  apiVersion: string;
}

/**
 * Azure DevOps API endpoints
 */
export enum AzureApiEndpoints {
  CLASSIFICATION_NODES = '_apis/wit/classificationnodes',
  WORK_ITEMS = '_apis/wit/workitems',
  TEAMS = '_apis/work/teamsettings',
  TEST_PLANS = '_apis/test/plans'
}

/**
 * Retry configuration for API calls
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableStatusCodes: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};