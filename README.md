# Nightwatch JSON test results report

> Save a common JSON test report for nightwatch tests

![CTRF 0.2.0](https://img.shields.io/badge/0.1.0-red?label=ctrf&labelColor=green)

A nightwatch.js JSON test reporter to create test reports that follow the CTRF standard.

[Common Test Report Format](https://ctrf.io) ensures the generation of uniform JSON test reports, independent of programming languages or test framework in use.

## CTRF Open Standard

CTRF is a community-driven open standard for test reporting.

By standardizing test results, reports can be validated, merged, compared, and analyzed consistently across languages and frameworks.

- **CTRF Specification**: https://github.com/ctrf-io/ctrf  
  The official specification defining the format and semantics
- **Discussions**: https://github.com/orgs/ctrf-io/discussions  
  Community forum for questions, ideas, and support

> [!NOTE]  
> ⭐ Starring the **CTRF specification repository** (https://github.com/ctrf-io/ctrf)
> helps support the standard.

## Features

- Generate JSON test reports that are [CTRF](https://ctrf.io) compliant
- Straightforward integration with nightwatch

```json
{
  "results": {
    "tool": {
      "name": "nightwatch"
    },
    "summary": {
      "tests": 1,
      "passed": 1,
      "failed": 0,
      "pending": 0,
      "skipped": 0,
      "other": 0,
      "start": 1706828654274,
      "stop": 1706828655782
    },
    "tests": [
      {
        "name": "ctrf should generate the same report with any tool",
        "status": "passed",
        "duration": 100
      }
    ],
    "environment": {
      "appName": "MyApp",
      "buildName": "MyBuild",
      "buildNumber": 1
    }
  }
}
```

## Installation

```bash
npm install --save-dev nightwatch-ctrf-json-reporter
```

Run your nightwatch tests as you normally would:

```bash
npx nightwatch ./nightwatch --reporter=nightwatch-ctrf-json-reporter
```

You'll find a JSON file named `ctrf-report.json` in the `ctrf` directory.

## Reporter Options

The reporter supports several configuration options, add to nightwatch.conf.js:

```javascript
      globals: {
        ...
        ctrf: {
          outputFile: 'custom-name.json', // Optional: Output file name. Defaults to 'ctrf-report.json'.
          outputDir: 'custom-directory',  // Optional: Output directory path. Defaults to 'ctrf'.
          appName: 'MyApp',               // Optional: Specify the name of the application under test.
          appVersion: '1.0.0',            // Optional: Specify the version of the application under test.
          osPlatform: 'linux',            // Optional: Specify the OS platform.
          osRelease: '18.04',             // Optional: Specify the OS release version.
          osVersion: '5.4.0',             // Optional: Specify the OS version.
          buildName: 'MyApp Build',       // Optional: Specify the build name.
          buildNumber: 100,               // Optional: Specify the build number.
          buildUrl: "https://ctrf.io",    // Optional: Specify the build url.
          repositoryName: "ctrf-json",    // Optional: Specify the repository name.
          repositoryUrl: "https://gh.io", // Optional: Specify the repository url.
          branchName: "main",             // Optional: Specify the branch name.
          testEnvironment: "staging"      // Optional: Specify the test environment (e.g. staging, production).
        },
      }
```

## Test Object Properties

The test object in the report includes the following [CTRF properties](https://ctrf.io/docs/schema/test):

| Name       | Type   | Required | Details                                                                             |
| ---------- | ------ | -------- | ----------------------------------------------------------------------------------- |
| `name`     | String | Required | The name of the test.                                                               |
| `status`   | String | Required | The outcome of the test. One of: `passed`, `failed`, `skipped`, `pending`, `other`. |
| `duration` | Number | Required | The time taken for the test execution, in milliseconds.                             |
| `message`  | String | Optional | The failure message if the test failed.                                             |
| `trace`    | String | Optional | The stack trace captured if the test failed.                                        |

## What is CTRF?

CTRF is a universal JSON test report schema that addresses the lack of a standardized format for JSON test reports.

**Consistency Across Tools:** Different testing tools and frameworks often produce reports in varied formats. CTRF ensures a uniform structure, making it easier to understand and compare reports, regardless of the testing tool used.

**Language and Framework Agnostic:** It provides a universal reporting schema that works seamlessly with any programming language and testing framework.

**Facilitates Better Analysis:** With a standardized format, programatically analyzing test outcomes across multiple platforms becomes more straightforward.

## Identity and lineage

Reports include a UUID `reportId` for the emitted document, `runId` for the logical run, a stable `testId` for each logical test, and an `executionId` for each execution lifecycle. Retry history entries have distinct `attemptId` values; the final attempt is represented by the test result itself. Display names and runtime `extra` metadata remain independent of identity. Identity is included in minimal output.

Set reporter options `runId` and `shardId` to coordinate distributed runs: all shards of one run should share the same non-empty `runId` and have distinct `shardId` values. Otherwise a standalone run ID is generated. Generic identity values are opaque strings, not necessarily UUIDs.

Where the framework does not provide a stable logical identifier, IDs are derived from the available file, suite, test name and variant. For custom stability requirements, set `testIdResolver: (test) => "your-stable-id"`; its input exposes `name`, optional `filePath`, `suite` and `variant`. Choose an ID stable across runs and unique within your test namespace. Renaming or moving a test can change the default ID.
