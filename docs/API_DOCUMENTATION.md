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

# Step 2: Get test plans for a specific team
curl -X GET "http://localhost:3000/api/v1/testplans?areaPaths=Kantar Automation Platform\Core"

# Step 3: Analyze automation metrics
curl -X POST "http://localhost:3000/api/v1/testplans/automation-metrics" \
  -H "Content-Type: application/json" \
  -d '[{"id": 12345, "name": "Sprint 15 Tests"}]'
```

### 2. Bug Analysis Workflow

```bash
# Get bug metrics for recent sprints
curl -X GET "http://localhost:3000/api/v1/teams/bugs-by-sprint?areaPaths=Kantar Automation Platform\Core&numSprints=5"

# Analyze bug leakage patterns
curl -X POST "http://localhost:3000/api/v1/teams/bug-leakage" \
  -H "Content-Type: application/json" \
  -d '{"areaPaths": ["Kantar Automation Platform\\Core"]}'
```

### 3. Code Quality Integration

```bash
# Search for components in SonarQube
curl -X GET "http://localhost:3000/api/v1/components/search?qualifiers=TRK&page=1&size=50"

# Get detailed metrics for a component
curl -X GET "http://localhost:3000/api/v1/measures/component?componentKey=my-project:main"
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