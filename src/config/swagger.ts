import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Weaver Quality Lens API',
      version: '1.0.0',
      description: 'API for Quality Lens - Analytics for Azure DevOps Test Plans, Bug Metrics, and SonarQube Integration',
      contact: {
        name: 'Quality Lens Team',
        email: 'support@qualitylens.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server',
      },
      {
        url: 'https://api.qualitylens.com/api',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'System',
        description: 'System health and status endpoints',
      },
      {
        name: 'Organization',
        description: 'Azure DevOps organization and area path management',
      },
      {
        name: 'Test Plans',
        description: 'Test plan management and automation metrics',
      },
      {
        name: 'Test Cases',
        description: 'Test case analysis and usage tracking',
      },
      {
        name: 'Teams - Bug Metrics',
        description: 'Team bug metrics, leakage analysis, and aging statistics',
      },
      {
        name: 'Teams - Automation Metrics',
        description: 'Team automation metrics across sprints',
      },
      {
        name: 'SonarQube',
        description: 'SonarQube integration for code quality metrics',
      },
    ],
    components: {
      schemas: {
        // Common Types
        TestPlan: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'Test Plan ID from Azure DevOps',
              example: 12345,
            },
            name: {
              type: 'string',
              description: 'Test Plan name',
              example: 'Sprint 15 - Core Team Tests',
            },
          },
          required: ['id', 'name'],
        },
        
        // Test Plans Schemas
        TeamTestPlans: {
          type: 'object',
          properties: {
            team: {
              type: 'string',
              description: 'Team area path',
              example: 'Kantar Automation Platform\\Core',
            },
            totalTestPlans: {
              type: 'number',
              description: 'Total number of test plans for this team',
              example: 25,
            },
            testplans: {
              type: 'array',
              items: { $ref: '#/components/schemas/TestPlan' },
            },
          },
        },

        AutomationMetrics: {
          type: 'object',
          properties: {
            manual: {
              type: 'number',
              description: 'Number of manual test cases',
              example: 150,
            },
            automated: {
              type: 'number',
              description: 'Number of automated test cases',
              example: 75,
            },
            total: {
              type: 'number',
              description: 'Total number of test cases',
              example: 225,
            },
            totalToBeExecuted: {
              type: 'number',
              description: 'Total test cases to be executed',
              example: 200,
            },
            totalNotExecuted: {
              type: 'number',
              description: 'Total test cases not executed',
              example: 25,
            },
            automationCoverage: {
              type: 'string',
              description: 'Automation coverage percentage',
              example: '33.33',
            },
            passRate: {
              type: 'number',
              description: 'Pass rate percentage',
              example: 85.5,
            },
            executionCoverage: {
              type: 'number',
              description: 'Execution coverage percentage',
              example: 87.5,
            },
            categories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Functional' },
                  manual: { type: 'number', example: 50 },
                  automated: { type: 'number', example: 25 },
                },
              },
            },
            tools: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Selenium' },
                  total: { type: 'number', example: 45 },
                },
              },
            },
            links: {
              type: 'object',
              properties: {
                manual: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Links to manual test cases',
                },
                automated: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Links to automated test cases',
                },
              },
            },
          },
        },

        AutomationMetricsResponse: {
          type: 'object',
          properties: {
            overall: { $ref: '#/components/schemas/AutomationMetrics' },
            plans: {
              type: 'array',
              items: {
                allOf: [
                  { $ref: '#/components/schemas/AutomationMetrics' },
                  {
                    type: 'object',
                    properties: {
                      planId: { type: 'number', example: 12345 },
                      planName: { type: 'string', example: 'Sprint 15 Tests' },
                    },
                  },
                ],
              },
            },
          },
        },

        // Bug Metrics Schemas
        SprintData: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Sprint name',
              example: 'Sprint 15',
            },
            iterationPath: {
              type: 'string',
              description: 'Sprint iteration path',
              example: 'Project\\Team\\Sprint 15',
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              description: 'Sprint start date',
              example: '2024-01-01T00:00:00Z',
            },
            finishDate: {
              type: 'string',
              format: 'date-time',
              description: 'Sprint finish date',
              example: '2024-01-15T23:59:59Z',
            },
            timeFrame: {
              type: 'string',
              description: 'Sprint time frame',
              example: 'past',
            },
          },
        },

        BugMetric: {
          type: 'object',
          properties: {
            opened: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 12 },
                bugLinks: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Links to opened bugs',
                },
              },
            },
            closed: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 8 },
                bugLinks: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Links to closed bugs',
                },
              },
            },
            stillOpen: {
              type: 'string',
              description: 'Percentage of bugs still open',
              example: '33.33%',
            },
          },
        },

        BugAging: {
          type: 'object',
          properties: {
            averageDays: {
              type: 'string',
              nullable: true,
              description: 'Average days to close bugs',
              example: '5.5',
            },
            agingAboveThresholdLinks: {
              type: 'array',
              items: { type: 'string' },
              description: 'Links to bugs exceeding aging threshold',
            },
            bugAgingBySeverity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  severity: { type: 'string', example: 'High' },
                  count: { type: 'number', example: 3 },
                  averageDays: { type: 'string', example: '7.2' },
                },
              },
            },
          },
        },

        // SonarQube Schemas
        SonarComponent: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Component key in SonarQube',
              example: 'project:component',
            },
            qualifier: {
              type: 'string',
              description: 'Component qualifier',
              example: 'TRK',
            },
            name: {
              type: 'string',
              description: 'Component name',
              example: 'My Application',
            },
            project: {
              type: 'string',
              description: 'Project key',
              example: 'my-project',
            },
          },
        },

        SonarMetrics: {
          type: 'object',
          properties: {
            component: {
              type: 'object',
              properties: {
                key: { type: 'string', example: 'project:component' },
                name: { type: 'string', example: 'My Application' },
                qualifier: { type: 'string', example: 'TRK' },
                measures: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      metric: { type: 'string', example: 'coverage' },
                      value: { type: 'string', example: '85.5' },
                      bestValue: { type: 'boolean', example: false },
                    },
                  },
                },
              },
            },
          },
        },

        // Organization Schema
        AreaPath: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Area path ID',
              example: 'uuid-string',
            },
            name: {
              type: 'string',
              description: 'Area path name',
              example: 'Kantar Automation Platform\\Core',
            },
          },
        },

        // Error Schema
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
              example: 'Bad Request',
            },
            message: {
              type: 'string',
              description: 'Detailed error message',
              example: 'Missing required parameter: areaPaths',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/routes/**/*.ts'], // Path to the API routes
};

const specs = swaggerJsdoc(options);

export { specs, swaggerUi };