# Weaver Quality Lens API Documentation

## Overview

The Weaver Quality Lens API provides comprehensive analytics for Azure DevOps Test Plans, Bug Metrics, and SonarQube integration. This RESTful API helps teams track test automation progress, analyze bug patterns, and monitor code quality metrics.

## Getting Started

### Base URL
- **Development:** `http://localhost:3000/api`
- **Production:** `https://api.qualitylens.com/api`

### API Documentation
Interactive API documentation is available at:
- **Development:** `http://localhost:3000/api-docs`
- **Production:** `https://api.qualitylens.com/api-docs`

## Authentication

Currently, the API uses server-side authentication with Azure DevOps and SonarQube. No client-side authentication is required.

## API Endpoints Overview

### Organization Management
- `GET /v1/organization/areaPaths` - Get all available team area paths

### Test Plans
- `GET /v1/testplans` - Get test plans by area paths
- `POST /v1/testplans/automation-metrics` - Calculate automation metrics
- `POST /v1/testplans/new-automations` - Track newly automated tests
- `POST /v1/testplans/suites/coverage` - Get automation coverage per suite

### Test Cases
- `GET /v1/testcases` - Get ready test cases by area paths
- `POST /v1/testcases/usage` - Analyze test case usage

### Team Bug Metrics
- `GET /v1/teams/bugs-by-sprint` - Get bug metrics by sprints
- `POST /v1/teams/bug-details` - Get detailed bug information
- `POST /v1/teams/bug-leakage` - Analyze bug leakage patterns
- `GET /v1/teams/bug-leakage-sprint` - Get bug leakage by sprint

### Team Automation Metrics
- `GET /v1/teams/sprints/automation-metrics` - Get sprint automation metrics

### SonarQube Integration
- `GET /v1/components/search` - Search SonarQube components
- `GET /v1/measures/component` - Get component quality metrics

## Common Usage Patterns

### 1. Getting Started with a Team Analysis

```bash
# Step 1: Get available area paths
curl -X GET "http://localhost:3000/api/v1/organization/areaPaths"

# Response example:
# [
#   {"id": "1", "name": "MyProject"},
#   {"id": "2", "name": "MyProject\\Frontend"},
#   {"id": "3", "name": "MyProject\\Backend"},
#   {"id": "4", "name": "MyProject\\QA"}
# ]

# Step 2: Get test plans for specific teams
curl -X GET "http://localhost:3000/api/v1/testplans?areaPaths=MyProject\Frontend,MyProject\Backend"

# Step 3: Analyze automation metrics for multiple test plans
curl -X POST "http://localhost:3000/api/v1/testplans/automation-metrics" \
  -H "Content-Type: application/json" \
  -d '[
    {"id": 12345, "name": "Frontend Sprint 15 Tests"},
    {"id": 12346, "name": "Backend API Tests"},
    {"id": 12347, "name": "Integration Tests"}
  ]'
```

### 2. Bug Analysis Workflow

```bash
# Get bug metrics for recent sprints across multiple teams
curl -X GET "http://localhost:3000/api/v1/teams/bugs-by-sprint?areaPaths=MyProject\Frontend,MyProject\Backend&numSprints=5"

# Response example:
# {
#   "sprintMetrics": [
#     {
#       "sprintName": "Sprint 15",
#       "totalBugs": 12,
#       "criticalBugs": 2,
#       "resolvedBugs": 10
#     }
#   ]
# }

# Analyze bug leakage patterns with date range
curl -X POST "http://localhost:3000/api/v1/teams/bug-leakage" \
  -H "Content-Type: application/json" \
  -d '{
    "areaPaths": ["MyProject\\Frontend", "MyProject\\Backend", "MyProject\\QA"],
    "startDate": "2024-01-01",
    "endDate": "2024-03-31"
  }'

# Get detailed bug information for specific areas
curl -X POST "http://localhost:3000/api/v1/teams/bug-details" \
  -H "Content-Type: application/json" \
  -d '{
    "areaPaths": ["MyProject\\Mobile"],
    "severity": ["High", "Critical"],
    "state": ["Active", "New"]
  }'
```

### 3. Code Quality Integration

```bash
# Search for projects in SonarQube
curl -X GET "http://localhost:3000/api/v1/components/search?qualifiers=TRK&page=1&size=50"

# Response example:
# {
#   "components": [
#     {
#       "key": "my-frontend-app",
#       "name": "Frontend Application",
#       "qualifier": "TRK"
#     },
#     {
#       "key": "my-backend-api",
#       "name": "Backend API Service",
#       "qualifier": "TRK"
#     }
#   ]
# }

# Get detailed quality metrics for multiple components
curl -X GET "http://localhost:3000/api/v1/measures/component?componentKey=my-frontend-app&metricKeys=coverage,bugs,vulnerabilities,code_smells,duplicated_lines_density"

# Get metrics for a specific branch
curl -X GET "http://localhost:3000/api/v1/measures/component?componentKey=my-backend-api&branch=develop&metricKeys=coverage,reliability_rating,security_rating"
```

### 4. Advanced Test Management

```bash
# Get test cases ready for automation
curl -X GET "http://localhost:3000/api/v1/testcases?areaPaths=MyProject\QA&status=Ready"

# Analyze test case usage patterns
curl -X POST "http://localhost:3000/api/v1/testcases/usage" \
  -H "Content-Type: application/json" \
  -d '{
    "testPlanIds": [12345, 12346],
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-03-31"
    }
  }'

# Get automation coverage per test suite
curl -X POST "http://localhost:3000/api/v1/testplans/suites/coverage" \
  -H "Content-Type: application/json" \
  -d '{
    "testPlanId": 12345,
    "includeChildSuites": true
  }'
```

### 5. Sprint and Team Metrics

```bash
# Get comprehensive sprint automation metrics
curl -X GET "http://localhost:3000/api/v1/teams/sprints/automation-metrics?areaPaths=MyProject\Development&numSprints=3"

# Get bug leakage analysis by sprint
curl -X GET "http://localhost:3000/api/v1/teams/bug-leakage-sprint?areaPaths=MyProject\QA,MyProject\Development&numSprints=5"

# Track newly automated tests over time
curl -X POST "http://localhost:3000/api/v1/testplans/new-automations" \
  -H "Content-Type: application/json" \
  -d '{
    "testPlans": [
      {"id": 12345, "name": "Web UI Tests"},
      {"id": 12346, "name": "API Tests"}
    ],
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    }
  }'
```

## Data Models

### Key Concepts

- **Area Path**: Represents a team or organizational unit in Azure DevOps
- **Test Plan**: A collection of test cases grouped for execution
- **Sprint**: A time-boxed iteration in the development process
- **Bug Leakage**: Percentage of bugs found in production vs pre-production
- **Automation Coverage**: Percentage of automated vs manual test cases

### Common Parameters

- `areaPaths`: Comma-separated list of team area paths
- `numSprints`: Number of past sprints to analyze
- `startDate`/`endDate`: Date range for time-based analysis (YYYY-MM-DD format)

## Error Handling

The API uses standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (missing or invalid parameters)
- `500` - Internal Server Error

Error responses include a descriptive message:

```json
{
  "error": "areaPaths is required",
  "message": "The areaPaths parameter must be provided and contain at least one area path"
}
```

## Rate Limiting

The API implements reasonable rate limiting to ensure fair usage. If you encounter rate limiting issues, please contact the development team.

## Support

For questions or issues:
- Check the interactive API documentation at `/api-docs`
- Review the Swagger definitions for detailed parameter requirements
- Contact the Quality Lens development team

## Environment Variables

The following environment variables are required for the API to function:

### Azure DevOps Configuration
- `ADO_ORGANIZATION` - Azure DevOps organization name
- `ADO_PROJECT` - Azure DevOps project name
- `ADO_PERSONAL_ACCESS_TOKEN` - Personal access token for Azure DevOps
- `AZURE_API_VERSION` - Azure DevOps API version

### SonarQube Configuration
- `SONAR_DOMAIN` - SonarQube server URL
- `SONAR_ACCESS_TOKEN` - SonarQube access token
- `METRICS_KEY` - Comma-separated list of metrics to retrieve

### Additional Configuration
- `PORT` - Server port (default: 3000)
- `REDIS_URL` - Redis connection string for caching

## Changelog

### Version 1.0.0
- Initial release with full Azure DevOps and SonarQube integration
- Comprehensive test plan automation metrics
- Bug leakage analysis and aging statistics
- Interactive Swagger documentation