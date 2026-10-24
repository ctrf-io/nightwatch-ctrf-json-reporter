export const metadata = {
	runId: "controlled-run",
	shardId: "one",
	appName: "fixture",
	appVersion: "1.2.3",
	osPlatform: "linux",
	osRelease: "controlled",
	osVersion: "6",
	buildName: "build",
	buildNumber: 42,
	buildUrl: "https://example.com/build/42",
	repositoryName: "fixture",
	repositoryUrl: "https://example.com/repository",
	branchName: "main",
	testEnvironment: "test",
};
export function expectedReport(native, options) {
	const tests = Object.entries(native.modules).flatMap(
		([moduleName, module]) => {
			const completed = Object.entries(module.completed);
			const results = completed.length
				? completed.map(([name, t]) => ({
						name,
						status:
							{
								pass: "passed",
								fail: "failed",
								skipped: "skipped",
								pending: "pending",
							}[t.status] ?? "other",
						duration: t.timeMs,
						suite: [moduleName],
						...(t.errors > 0
							? { message: t.lastError.message, trace: t.stackTrace }
							: {}),
						...(options.customIdentity
							? { testId: `custom:${moduleName}:${name}` }
							: {}),
					}))
				: [
						{
							name: moduleName,
							status: "skipped",
							duration: 0,
							suite: [moduleName],
						},
					];
			return [
				...results,
				...module.skippedAtRuntime.map((name) => ({
					name,
					status: "skipped",
					duration: 0,
					suite: [moduleName],
				})),
			];
		},
	);
	const environment = Object.fromEntries(
		Object.entries(options).filter(
			([key]) => key in metadata && key !== "runId",
		),
	);
	// Invalid optional configuration must not produce schema-invalid output.
	if (
		environment.buildNumber !== undefined &&
		!Number.isInteger(environment.buildNumber)
	)
		delete environment.buildNumber;
	const summary = {
		tests: tests.length,
		start: Date.parse(native.startTimestamp),
		stop: Date.parse(native.endTimestamp),
	};
	for (const status of ["passed", "failed", "pending", "skipped", "other"])
		summary[status] = tests.filter((t) => t.status === status).length;
	return {
		reportFormat: "CTRF",
		specVersion: "0.2.0",
		generatedBy: "nightwatch-ctrf-json-reporter",
		...(options.runId ? { runId: options.runId } : {}),
		results: {
			tool: { name: "nightwatch.js" },
			summary,
			tests,
			...(Object.keys(environment).length ? { environment } : {}),
		},
	};
}
