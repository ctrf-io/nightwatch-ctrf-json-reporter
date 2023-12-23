export interface NightwatchResult {
  passed: number
  failed: number
  errors: number
  skipped: number
  tests: number
  modules: Record<string, NightwatchModule>
  assertions: number
  errmessages: string[]
  elapsedTime: string
  startTimestamp: string
  endTimestamp: string
  lastError: NightwatchError
}

export interface NightwatchError {
  name: string
  message: string
  showDiff: boolean
  abortOnFailure: boolean
  waitFor: boolean
  stack: string
}

export interface NightwatchAssertionError {
  name: string
  message: string
  showDiff: boolean
  abortOnFailure: boolean
  namespace: string
  stack: string
}

export interface NightwatchCompletedTestCase {
  time: string
  assertions: NightwatchAssertionError[]
  commands: any[]
  passed: number
  errors: number
  failed: number
  skipped: number
  tests: number
  status: string
  startTimestamp: string
  httpOutput: any[]
  steps: any[]
  stackTrace: string
  lastError: NightwatchAssertionError
  timeMs: number
  endTimestamp: string
}

export type NightwatchCompleted = Record<string, NightwatchCompletedTestCase>

export interface NightwatchModule {
  reportPrefix: string
  assertionsCount: number
  lastError: NightwatchAssertionError
  skippedAtRuntime: string[]
  skippedByUser: string[]
  skipped: string[]
  time: string
  timeMs: number
  completed: Record<string, NightwatchCompletedTestCase>
}

export type NightwatchModuleWithCompleted = NightwatchModule & {
  completed: Record<string, NightwatchCompletedTestCase>
}
