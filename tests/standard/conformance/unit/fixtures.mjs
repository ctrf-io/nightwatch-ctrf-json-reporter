import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { metadata, expectedReport } from "../expected.mjs";
const require = createRequire(import.meta.url);
export function nativeFixture() {
	const now = Date.now();
	return {
		startTimestamp: new Date(now).toISOString(),
		endTimestamp: new Date(now + 1).toISOString(),
		modules: {
			"nested/one": {
				completed: {
					"pass ✓": { status: "pass", timeMs: 17, errors: 0 },
					failure: {
						status: "fail",
						timeMs: 23,
						errors: 1,
						lastError: { message: "controlled failure" },
						stackTrace: "AssertionError: controlled failure",
					},
					pending: { status: "pending", timeMs: 0, errors: 0 },
					unknown: { status: "unknown", timeMs: 0, errors: 0 },
				},
				skippedAtRuntime: ["runtime skipped"],
			},
			"nested/two": {
				completed: { "pass ✓": { status: "pass", timeMs: 0, errors: 0 } },
				skippedAtRuntime: [],
			},
			disabled: { completed: {}, skippedAtRuntime: [] },
		},
	};
}
export function emitSample(name, native, options = {}) {
	const scratch = mkdtempSync(path.join(tmpdir(), "ctrf-nightwatch-unit-"));
	try {
		const Reporter = require("../../../../dist/index.cjs").constructor;
		const reporter = new Reporter();
		let callbacks = 0;
		reporter.write(
			native,
			{
				globals: {
					ctrf: {
						...options,
						outputDir: scratch,
						outputFile: "report.json",
						...(options.customIdentity
							? {
									testIdResolver: ({ name, suite }) =>
										`custom:${suite[0]}:${name}`,
								}
							: {}),
					},
				},
			},
			() => {
				callbacks++;
			},
		);
		assert.equal(callbacks, 1);
		const bytes = readFileSync(path.join(scratch, "report.json"));
		return {
			name,
			bytes,
			report: JSON.parse(bytes),
			expected: expectedReport(native, options),
			native,
			options,
		};
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}
export function unitContext() {
	const native = nativeFixture();
	const samples = [
		emitSample("full", native, metadata),
		emitSample("repeated", native, metadata),
		emitSample("defaults", native),
		emitSample("minimal", native, { ...metadata, minimal: true }),
		emitSample("empty", { ...native, modules: {} }),
		emitSample("empty-run-id", native, { runId: "" }),
		emitSample(
			"custom-identity",
			{
				...native,
				modules: {
					one: {
						completed: { case: { status: "pass", timeMs: 1, errors: 0 } },
						skippedAtRuntime: [],
					},
				},
			},
			{ customIdentity: true },
		),
		emitSample("fractional-build-number", native, { buildNumber: 1.5 }),
		emitSample("nonfinite-build-number", native, { buildNumber: Infinity }),
		emitSample("zero-build-number", native, { buildNumber: 0 }),
	];
	for (const [index, shardId] of ["one", "two"].entries())
		samples.push(
			emitSample(
				`shard-${shardId}`,
				{
					...native,
					modules: Object.fromEntries([Object.entries(native.modules)[index]]),
				},
				{ ...metadata, shardId },
			),
		);
	return {
		samples,
		repeated: samples.slice(0, 2),
		shards: samples.filter((s) => s.name.startsWith("shard-")),
		warnings: [],
	};
}
