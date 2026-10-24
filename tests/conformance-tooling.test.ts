import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { test } from "vitest";
import {
	catalogue,
	disposition,
	checkEntry,
} from "./standard/conformance/shared/checks.mjs";
import {
	unitContext,
	nativeFixture,
	emitSample,
} from "./standard/conformance/unit/fixtures.mjs";
import { runConformance } from "./standard/conformance/expected-failures.mjs";
import { recordsFromRun } from "./reporters/vitest.mjs";
const context = unitContext();
const cloneContext = () => {
	const copy = structuredClone(context);
	for (const sample of copy.samples) sample.bytes = Buffer.from(sample.bytes);
	return copy;
};
const find = (name: string) => {
	const sample = context.samples.find((s) => s.name === name);
	assert.ok(sample, name);
	return sample;
};
test("Nightwatch tooling / reviewed shared snapshot is unchanged", () => {
	const base = new URL("./standard/", import.meta.url);
	const manifest = JSON.parse(
		readFileSync(new URL("shared-files.json", base), "utf8"),
	);
	for (const [file, hash] of Object.entries(manifest.files))
		assert.equal(
			createHash("sha256")
				.update(readFileSync(new URL(file, base)))
				.digest("hex"),
			hash,
			file,
		);
});
test("Nightwatch tooling / capabilities cover exactly the common inventory", () => {
	const m = JSON.parse(
		readFileSync(
			new URL("./standard/conformance/nightwatch.json", import.meta.url),
			"utf8",
		),
	);
	for (const entry of catalogue.entries) disposition(entry, m);
	assert.deepEqual(
		Object.keys(m.properties).sort(),
		catalogue.entries
			.filter((e) => e.kind === "property")
			.map((e) => e.path)
			.sort(),
	);
	assert.deepEqual(
		Object.keys(m.rules).sort(),
		catalogue.entries
			.filter((e) => e.kind === "report")
			.map((e) => e.rule)
			.sort(),
	);
});
for (const [label, mutate, rule] of [
	[
		"invalid duration",
		(r) => {
			r.results.tests[0].duration = "invalid";
		},
		"single-json-object",
	],
	[
		"invalid optional field",
		(r) => {
			r.results.tests[0].retries = -1;
		},
		"single-json-object",
	],
	[
		"wrong counter",
		(r) => {
			r.results.summary.passed++;
		},
		"summary-matches-final-results",
	],
	[
		"wrong declaration",
		(r) => {
			r.specVersion = "9.9.9";
		},
		"declares-supported-contract",
	],
] as const)
	test(`Nightwatch tooling / rejects ${label}`, () => {
		const report = structuredClone(find("full").report);
		mutate(report);
		assert.throws(() =>
			checkEntry(
				catalogue.entries.find((e) => e.rule === rule),
				{
					samples: [
						{
							name: "mutated",
							report,
							bytes: Buffer.from(JSON.stringify(report)),
						},
					],
					warnings: [],
				},
			),
		);
	});
test("Nightwatch tooling / independent source mapping rejects schema-valid renamed tests", () => {
	const sample = structuredClone(find("full"));
	sample.report.results.tests[0].name = "incorrect mapping";
	assert.throws(() =>
		checkEntry(
			catalogue.entries.find((e) => e.path === "results.tests[].name"),
			{ samples: [sample] },
		),
	);
});
for (const id of [
	"conformance/property/results.environment.buildNumber",
	"conformance/report/single-json-object",
]) {
	const entry = catalogue.entries.find((e) => e.id === id);
	test(`Nightwatch matcher / ${id} reproduces both exact defects`, () => {
		const result = runConformance(entry, context, "unit");
		assert.equal(result.issue, "invalid-build-number");
		assert.deepEqual(result.samples, [
			"fractional-build-number",
			"nonfinite-build-number",
		]);
	});
	test(`Nightwatch matcher / ${id} rejects a partial fix`, () => {
		const c = cloneContext();
		const sample = c.samples.find((s) => s.name === "fractional-build-number");
		sample.report.results.environment.buildNumber = 0;
		sample.expected.results.environment = { buildNumber: 0 };
		sample.bytes = Buffer.from(JSON.stringify(sample.report));
		assert.throws(() => runConformance(entry, c, "unit"), /Unexpected pass/);
	});
	test(`Nightwatch matcher / ${id} rejects changed violations`, () => {
		const c = cloneContext();
		const sample = c.samples.find((s) => s.name === "fractional-build-number");
		sample.report.results.environment.buildNumber = "wrong";
		sample.bytes = Buffer.from(JSON.stringify(sample.report));
		assert.throws(() => runConformance(entry, c, "unit"));
	});
	test(`Nightwatch matcher / ${id} requires every recorded sample`, () => {
		assert.throws(
			() =>
				runConformance(
					entry,
					{
						...context,
						samples: context.samples.filter(
							(s) => s.name !== "nonfinite-build-number",
						),
					},
					"unit",
				),
			/fixture missing/,
		);
	});
	test(`Nightwatch matcher / ${id} rejects unrelated sample failures`, () => {
		const c = cloneContext();
		const sample = c.samples.find((s) => s.name === "full");
		sample.report.results.environment.buildNumber = "wrong";
		sample.bytes = Buffer.from(JSON.stringify(sample.report));
		assert.throws(() => runConformance(entry, c, "unit"));
	});
}
test("Nightwatch behavior / zero build number is preserved", () =>
	assert.equal(
		find("zero-build-number").report.results.environment.buildNumber,
		0,
	));
test("Nightwatch behavior / empty runId is omitted", () =>
	assert.equal(Object.hasOwn(find("empty-run-id").report, "runId"), false));
test("Nightwatch behavior / suite identity separates duplicate native titles", () => {
	const tests = find("full").report.results.tests.filter(
		(t) => t.name === "pass ✓",
	);
	assert.equal(tests.length, 2);
	assert.notEqual(tests[0].testId, tests[1].testId);
});
test("Nightwatch behavior / no retry history is invented from final aggregates", () => {
	for (const t of find("full").report.results.tests)
		for (const key of ["retries", "retryAttempts", "flaky", "attemptId"])
			assert.equal(Object.hasOwn(t, key), false);
});
test("Nightwatch behavior / actual producer leaves native input intact", () => {
	const native = nativeFixture();
	const before = structuredClone(native);
	emitSample("unchanged", native);
	assert.deepEqual(native, before);
});
test("Reporter results / completed records retain pass, fail, pending and skip", () => {
	const modes = [
		{ mode: "run", state: "passed" },
		{ mode: "run", state: "failed" },
		{ mode: "todo", state: "pending" },
		{ mode: "skip", state: "skipped" },
	];
	const modules = [
		{
			moduleId: "fixture.test.ts",
			children: {
				allTests: () =>
					modes.map((m, i) => ({
						name: `case-${i}`,
						options: { mode: m.mode },
						result: () => ({ state: m.state }),
						diagnostic: () => ({ duration: 4 }),
					})),
			},
			errors: () => [],
		},
	];
	assert.deepEqual(
		recordsFromRun(modules, []).map((r) => r.status),
		["passed", "failed", "pending", "skipped"],
	);
});
test("Reporter results / module and unhandled errors remain failures", () => {
	const modules = [
		{
			moduleId: "broken.test.ts",
			children: { allTests: () => [] },
			errors: () => [{ message: "load failed" }],
		},
	];
	assert.deepEqual(
		recordsFromRun(modules, [{ message: "unhandled" }]).map((r) => r.status),
		["failed", "failed"],
	);
});

test("Nightwatch observer / preserves non-enumerable native Error fields", () => {
	const scratch = mkdtempSync(path.join(tmpdir(), "ctrf-nightwatch-observer-"));
	const previous = process.env.CTRF_NATIVE_RESULT;
	try {
		process.env.CTRF_NATIVE_RESULT = path.join(scratch, "native.json");
		const observer = createRequire(import.meta.url)(
			"./standard/conformance/integration/fixtures/observer.cjs",
		);
		const error = new Error("native failure");
		observer.write({ lastError: error });
		const native = JSON.parse(
			readFileSync(process.env.CTRF_NATIVE_RESULT, "utf8"),
		);
		assert.equal(native.lastError.message, "native failure");
		assert.equal(native.lastError.stack, error.stack);
	} finally {
		if (previous === undefined) delete process.env.CTRF_NATIVE_RESULT;
		else process.env.CTRF_NATIVE_RESULT = previous;
		rmSync(scratch, { recursive: true, force: true });
	}
});
