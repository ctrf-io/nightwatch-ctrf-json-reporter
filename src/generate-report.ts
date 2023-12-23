import fs = require('fs')
import path = require('path')
import { type NightwatchOptions } from 'nightwatch'
import {
  type CtrfEnvironment,
  type CtrfReport,
  type CtrfTest,
  type CtrfTestState,
} from '../types/ctrf.d'
import {
  type NightwatchModule,
  type NightwatchModuleWithCompleted,
  type NightwatchResult,
} from '../types/nightwatch.d'

interface ReporterConfigOptions {
  outputFile?: string
  outputDir?: string
  appName?: string | undefined
  appVersion?: string | undefined
  osPlatform?: string | undefined
  osRelease?: string | undefined
  osVersion?: string | undefined
  buildName?: string | undefined
  buildNumber?: string | undefined
}

class GenerateCtrfReport {
  private readonly ctrfReport: CtrfReport
  readonly ctrfEnvironment: CtrfEnvironment
  private reporterOptions: ReporterConfigOptions
  readonly reporterName = 'cypress-ctrf-json-reporter'
  readonly defaultOutputFile = 'ctrf-report.json'
  readonly defaultOutputDir = 'ctrf'
  filename = this.defaultOutputFile

  constructor() {
    this.reporterOptions = {}
    this.ctrfReport = {
      results: {
        tool: {
          name: 'nightwatch.js',
        },
        summary: {
          tests: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          skipped: 0,
          other: 0,
          start: Date.now(),
          stop: 0,
        },
        tests: [],
      },
    }

    this.ctrfEnvironment = {}

    if (this.reporterOptions?.outputFile !== undefined)
      this.setFilename(this.reporterOptions.outputFile)

    if (
      !fs.existsSync(this.reporterOptions.outputDir ?? this.defaultOutputDir)
    ) {
      fs.mkdirSync(this.reporterOptions.outputDir ?? this.defaultOutputDir, {
        recursive: true,
      })
    }
  }

  write(
    results: NightwatchResult,
    options: NightwatchOptions,
    done: () => void
  ): void {
    this.reporterOptions = {
      outputFile: options.globals?.ctrf?.outputFile ?? this.defaultOutputFile,
      outputDir: options.globals?.ctrf?.outputDir ?? this.defaultOutputDir,
      appName: options.globals?.ctrf?.appName ?? undefined,
      appVersion: options.globals?.ctrf?.appVersion ?? undefined,
      osPlatform: options.globals?.ctrf?.osPlatform ?? undefined,
      osRelease: options.globals?.ctrf?.osRelease ?? undefined,
      osVersion: options.globals?.ctrf?.osVersion ?? undefined,
      buildName: options.globals?.ctrf?.buildName ?? undefined,
      buildNumber: options.globals?.ctrf?.buildNumber ?? undefined,
    }

    this.setEnvironmentDetails(this.reporterOptions ?? {})
    if (this.hasEnvironmentDetails(this.ctrfEnvironment)) {
      this.ctrfReport.results.environment = this.ctrfEnvironment
    }

    if (this.reporterOptions?.outputFile !== undefined)
      this.setFilename(this.reporterOptions.outputFile)

    this.ctrfReport.results.summary.stop = Date.parse(results.startTimestamp)
    this.ctrfReport.results.summary.start = Date.parse(results.endTimestamp)

    this.getTestsFromResults(results)
    this.getTestTotals(this.ctrfReport.results.tests)
    this.writeReportToFile(this.ctrfReport)

    done()
  }

  private setFilename(filename: string): void {
    if (filename.endsWith('.json')) {
      this.filename = filename
    } else {
      this.filename = `${filename}.json`
    }
  }

  getTestsFromResults(results: NightwatchResult): void {
    let tests: CtrfTest[] = []
    for (const moduleName in results.modules) {
      tests = tests.concat(
        this.getTestsFromModule(results.modules[moduleName], moduleName)
      )
    }
    this.ctrfReport.results.tests = tests
  }

  getTestsFromModule(
    module: NightwatchModuleWithCompleted,
    moduleName: string
  ): CtrfTest[] {
    let tests: CtrfTest[] = []

    if (this.isTestSkipped(module)) {
      tests.push({
        name: moduleName,
        status: 'skipped',
        duration: 0,
      })
    } else {
      for (const testName in module.completed) {
        const test = module.completed[testName]
        tests.push({
          name: testName,
          status: this.mapStatus(test.status),
          duration: test.timeMs,
        })
      }
    }

    tests = tests.concat(this.getSkippedAtRuntimeTests(module))

    return tests
  }

  getSkippedAtRuntimeTests(module: NightwatchModule): CtrfTest[] {
    return module.skippedAtRuntime.map((skippedTestName: string) => ({
      name: skippedTestName,
      status: 'skipped',
      duration: 0,
    }))
  }

  isTestSkipped(module: { completed: Record<string, unknown> }): boolean {
    return Object.keys(module.completed).length === 0
  }

  getTestTotals(tests: CtrfTest[]): void {
    this.ctrfReport.results.summary = {
      ...this.ctrfReport.results.summary,
      tests: tests.length,
      passed: tests.filter(
        (test: { status: string }) => test.status === 'passed'
      ).length,
      failed: tests.filter(
        (test: { status: string }) => test.status === 'failed'
      ).length,
      pending: tests.filter(
        (test: { status: string }) => test.status === 'pending'
      ).length,
      skipped: tests.filter(
        (test: { status: string }) => test.status === 'skipped'
      ).length,
      other: tests.filter((test: { status: string }) => test.status === 'other')
        .length,
    }
  }

  private mapStatus(nightwatchStatus: string): CtrfTestState {
    switch (nightwatchStatus) {
      case 'pass':
        return 'passed'
      case 'fail':
        return 'failed'
      case 'skipped':
        return 'skipped'
      case 'pending':
        return 'pending'
      default:
        return 'other'
    }
  }

  setEnvironmentDetails(reporterConfigOptions: ReporterConfigOptions): void {
    if (reporterConfigOptions.appName !== undefined) {
      this.ctrfEnvironment.appName = reporterConfigOptions.appName
    }
    if (reporterConfigOptions.appVersion !== undefined) {
      this.ctrfEnvironment.appVersion = reporterConfigOptions.appVersion
    }
    if (reporterConfigOptions.osPlatform !== undefined) {
      this.ctrfEnvironment.osPlatform = reporterConfigOptions.osPlatform
    }
    if (reporterConfigOptions.osRelease !== undefined) {
      this.ctrfEnvironment.osRelease = reporterConfigOptions.osRelease
    }
    if (reporterConfigOptions.osVersion !== undefined) {
      this.ctrfEnvironment.osVersion = reporterConfigOptions.osVersion
    }
    if (reporterConfigOptions.buildName !== undefined) {
      this.ctrfEnvironment.buildName = reporterConfigOptions.buildName
    }
    if (reporterConfigOptions.buildNumber !== undefined) {
      this.ctrfEnvironment.buildNumber = reporterConfigOptions.buildNumber
    }
  }

  hasEnvironmentDetails(environment: CtrfEnvironment): boolean {
    return Object.keys(environment).length > 0
  }

  private writeReportToFile(data: CtrfReport): void {
    const filePath = path.join(
      this.reporterOptions.outputDir ?? this.defaultOutputDir,
      this.reporterOptions.outputFile ?? this.defaultOutputFile
    )
    const str = JSON.stringify(data, null, 2)
    try {
      fs.writeFileSync(filePath, str + '\n')
      console.log(
        `${this.reporterName}: successfully written ctrf json to %s/%s`,
        this.reporterOptions.outputDir,
        this.reporterOptions.outputFile
      )
    } catch (error) {
      console.error(`Error writing ctrf json report:, ${String(error)}`)
    }
  }
}

export default GenerateCtrfReport
