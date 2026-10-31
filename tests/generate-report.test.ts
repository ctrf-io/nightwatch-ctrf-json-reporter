import assert from "node:assert/strict";
import { validateStrict } from "ctrf";
import GenerateCtrfReport from "../src/generate-report";

describe("GenerateCtrfReport", () => {
	it("maps Nightwatch completed and skipped tests to CTRF results", () => {
		const reporter = new GenerateCtrfReport();
		const tests = reporter.getTestsFromModule(
			{
				completed: {
					"passes test": {
						status: "pass",
						timeMs: 12,
						errors: 0,
					},
					"fails test": {
						status: "fail",
						timeMs: 34,
						errors: 1,
						lastError: {
							message: "expected true to be false",
						},
						stackTrace: "AssertionError: expected true to be false",
					},
				},
				skippedAtRuntime: ["runtime skipped test"],
			} as never,
			"sample module",
		);

		expect(tests).toMatchObject([
			{
				name: "passes test",
				status: "passed",
				duration: 12,
				suite: ["sample module"],
			},
			{
				name: "fails test",
				status: "failed",
				duration: 34,
				suite: ["sample module"],
				message: "expected true to be false",
				trace: "AssertionError: expected true to be false",
			},
			{
				name: "runtime skipped test",
				status: "skipped",
				duration: 0,
				suite: ["sample module"],
			},
		]);
	});

	it("counts CTRF test totals by status", () => {
		const reporter = new GenerateCtrfReport();

		reporter.getTestTotals([
			{ name: "passed", status: "passed", duration: 1 },
			{ name: "failed", status: "failed", duration: 1 },
			{ name: "skipped", status: "skipped", duration: 1 },
			{ name: "pending", status: "pending", duration: 1 },
			{ name: "other", status: "other", duration: 1 },
		]);

		const { ctrfReport } = reporter as unknown as {
			ctrfReport: { results: { summary: Record<string, number> } };
		};

		expect(ctrfReport.results.summary).toMatchObject({
			tests: 5,
			passed: 1,
			failed: 1,
			skipped: 1,
			pending: 1,
			other: 1,
		});
	});

	it("produces a report that passes strict CTRF 0.2.0 validation", () => {
		const reporter = new GenerateCtrfReport();
		const ctrfReport = (
			reporter as unknown as { ctrfReport: Record<string, unknown> }
		).ctrfReport;

		expect(() => validateStrict(ctrfReport)).not.toThrow();
	});
});

describe("buildNumber configuration", () => {
	for (const [buildNumber, expected, warningCount] of [
		[0, 0, 0],
		[-1, -1, 0],
		[100, 100, 0],
		[Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 1, 0],
		[undefined, undefined, 0],
		[1.5, undefined, 1],
		[NaN, undefined, 1],
		[Infinity, undefined, 1],
		[-Infinity, undefined, 1],
	] as const) {
		it(`serializes ${String(buildNumber)} with ${warningCount} warning(s)`, () => {
			const warn = console.warn;
			const warnings: unknown[] = [];
			console.warn = (message) => warnings.push(message);
			try {
				const reporter = new GenerateCtrfReport();
				reporter.setEnvironmentDetails({ buildNumber });
				const state = reporter as unknown as {
					ctrfReport: { results: { environment: unknown } };
					ctrfEnvironment: unknown;
				};
				state.ctrfReport.results.environment = state.ctrfEnvironment;
				const report = JSON.parse(JSON.stringify(state.ctrfReport));
				assert.equal(report.results.environment?.buildNumber, expected);
				assert.equal(
					Object.hasOwn(report.results.environment ?? {}, "buildNumber"),
					expected !== undefined,
				);
				assert.equal(warnings.length, warningCount);
				if (warningCount)
					assert.equal(
						warnings[0],
						"[CTRF] buildNumber must be a finite integer; omitting invalid value.",
					);
				assert.doesNotThrow(() => validateStrict(report));
			} finally {
				console.warn = warn;
			}
		});
	}
});
