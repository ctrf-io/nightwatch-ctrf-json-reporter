import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { identityValue, testIdentity } from "../src/identity";

describe("identity semantics", () => {
	it("normalizes paths but preserves suite component boundaries", () => {
		const a = {
			name: "same",
			suite: ["a/b", "c"],
			filePath: "tests\\example.ts",
		};
		expect(testIdentity("runner", a)).toBe(
			testIdentity("runner", { ...a, filePath: "tests/example.ts" }),
		);
		expect(testIdentity("runner", a)).not.toBe(
			testIdentity("runner", { ...a, suite: ["a", "b/c"] }),
		);
		expect(testIdentity("runner", a)).not.toBe(
			testIdentity("runner", { ...a, filePath: "tests/other.ts" }),
		);
	});
	it("includes only explicitly supplied run identity", () => {
		const reporter = new Reporter();
		const directory = fs.mkdtempSync(
			path.join(os.tmpdir(), "ctrf-nightwatch-run-"),
		);
		try {
			for (const runId of [undefined, "", "coordinated-run"]) {
				reporter.write(
					{
						startTimestamp: "2026-10-10T10:00:00Z",
						endTimestamp: "2026-10-10T10:00:01Z",
						modules: {},
					} as never,
					{ globals: { ctrf: { runId, outputDir: directory } } } as never,
					() => {},
				);
				expect(JSON.parse(JSON.stringify(reporter.ctrfReport)).runId).toBe(
					runId || undefined,
				);
			}
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
		expect(() => identityValue(" ", "shardId")).toThrow();
	});
	it("supports an explicit case resolver without allowing empty identity", () => {
		expect(
			testIdentity(
				"runner",
				{ name: "duplicate" },
				{ testIdResolver: () => "stable-case" },
			),
		).toBe("stable-case");
		expect(() =>
			testIdentity(
				"runner",
				{ name: "duplicate" },
				{ testIdResolver: () => "" },
			),
		).toThrow();
	});
});

import Reporter from "../src/generate-report";
it("gives skipped placeholders a distinct identity scope", () => {
	const reporter = new Reporter();
	const placeholder = reporter.getTestsFromModule(
		{ completed: {}, skippedAtRuntime: [] } as never,
		"case",
	)[0];
	const runtime = reporter.getSkippedAtRuntimeTests(
		{ skippedAtRuntime: ["case"] } as never,
		"case",
	)[0];
	expect(placeholder.testId).not.toBe(runtime.testId);
	expect(placeholder.executionId).toBeTruthy();
	expect(runtime.executionId).toBeTruthy();
});
