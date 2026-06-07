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

		expect(tests).toEqual([
			{
				name: "passes test",
				status: "passed",
				duration: 12,
			},
			{
				name: "fails test",
				status: "failed",
				duration: 34,
				message: "expected true to be false",
				trace: "AssertionError: expected true to be false",
			},
			{
				name: "runtime skipped test",
				status: "skipped",
				duration: 0,
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
});
