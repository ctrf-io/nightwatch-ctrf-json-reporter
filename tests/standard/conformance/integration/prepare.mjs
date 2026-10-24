import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { catalogue, checkEntry } from "../shared/checks.mjs";
import { metadata, expectedReport } from "../expected.mjs";
export function integrationContext(root, diagnostics) {
	const consumer = mkdtempSync(
		path.join(tmpdir(), "ctrf-nightwatch-consumer-"),
	);
	const env = {
		...process.env,
		CI: "true",
		FORCE_COLOR: "0",
		SE_CACHE_PATH:
			process.env.CTRF_BROWSER_CACHE ?? path.join(consumer, "browser-cache"),
	};
	delete env.NODE_OPTIONS;
	delete env.NODE_PATH;
	if (!env.CTRF_CHROME_BINARY && process.platform === "darwin")
		env.CTRF_CHROME_BINARY =
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
	const npm = process.platform === "win32" ? "npm.cmd" : "npm";
	const execute = (cmd, args, name, expected) => {
		const result = spawnSync(cmd, args, {
			cwd: consumer,
			env,
			encoding: "utf8",
			timeout: 240000,
			maxBuffer: 16 * 1024 * 1024,
		});
		if (diagnostics) {
			mkdirSync(diagnostics, { recursive: true });
			writeFileSync(
				path.join(diagnostics, `${name}.log`),
				`${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error ?? ""}`,
			);
		}
		assert.ifError(result.error);
		assert.equal(result.signal, null, name);
		if (expected !== undefined)
			assert.equal(
				result.status,
				expected,
				`${name}: ${result.stdout} ${result.stderr}`,
			);
		return result;
	};
	try {
		const pkg = JSON.parse(
			readFileSync(path.join(root, "package.json"), "utf8"),
		);
		const packed = JSON.parse(
			execute(npm, ["pack", root, "--json", "--ignore-scripts"], "pack", 0)
				.stdout,
		)[0];
		assert.ok(
			packed.files.every(
				(f) => !f.path.startsWith("tests/") && !f.path.startsWith("src/"),
			),
		);
		writeFileSync(
			path.join(consumer, "package.json"),
			JSON.stringify({ private: true }),
		);
		execute(
			npm,
			[
				"install",
				"--ignore-scripts",
				"--no-audit",
				"--no-fund",
				"--save-exact",
				`./${packed.filename}`,
				`nightwatch@${pkg.devDependencies.nightwatch}`,
			],
			"install",
			0,
		);
		cpSync(
			new URL("./fixtures/", import.meta.url),
			path.join(consumer, "fixtures"),
			{ recursive: true },
		);
		const scenarios = [
			{ name: "full", exit: 5 },
			{ name: "repeated", exit: 5 },
			{ name: "defaults", defaults: true, exit: 0 },
			{ name: "minimal", options: { minimal: true }, exit: 5 },
			{ name: "workers", exit: 0 },
			{ name: "runtime-error", exit: 5 },
			{ name: "runtime-skip", exit: 5 },
			{ name: "retry-recovery", retry: true, exit: 0 },
			{ name: "retry-exhaustion", retry: true, exit: 5 },
			{
				name: "fractional-build-number",
				options: { buildNumber: 1.5 },
				exit: 5,
			},
			{
				name: "nonfinite-build-number",
				options: { buildNumber: null },
				exit: 5,
			},
			{ name: "zero-build-number", options: { buildNumber: 0 }, exit: 5 },
			{ name: "shard-one", shard: 0, options: { shardId: "one" }, exit: 0 },
			{ name: "shard-two", shard: 1, options: { shardId: "two" }, exit: 0 },
			{ name: "custom-identity", options: { customIdentity: true }, exit: 0 },
		];
		const samples = [];
		for (const scenario of scenarios) {
			const folder = path.join(consumer, scenario.name);
			mkdirSync(folder);
			env.CTRF_NATIVE_OUTPUT = folder;
			env.CTRF_NATIVE_RESULT = path.join(folder, "native.json");
			env.CTRF_JOURNAL = path.join(folder, "journal.jsonl");
			env.CTRF_HTTP_LOG = path.join(folder, "http.json");
			env.CTRF_FIXTURE_SCENARIO = scenario.name;
			const options = {
				...(scenario.defaults ? {} : metadata),
				...scenario.options,
			};
			env.CTRF_FIXTURE_OPTIONS = JSON.stringify({
				...options,
				outputDir: folder,
				outputFile: "report.json",
			});
			const args = [
				"node_modules/nightwatch/bin/nightwatch",
				"--config",
				"fixtures/config.cjs",
				"--reporter",
				"nightwatch-ctrf-json-reporter,./fixtures/observer.cjs",
			];
			if (scenario.shard !== undefined)
				args.push(
					"--test",
					`fixtures/specs/${scenario.shard === 0 ? "one" : "two"}.js`,
				);
			if (scenario.retry) args.push("--retries", "1");
			const runWindow = [Math.floor(Date.now() / 1000) * 1000];
			const result = execute(
				process.execPath,
				["fixtures/launch.cjs", ...args],
				scenario.name,
				undefined,
			);
			runWindow.push(Date.now());
			const bytes = readFileSync(path.join(folder, "report.json"));
			const native = JSON.parse(readFileSync(env.CTRF_NATIVE_RESULT, "utf8"));
			if (diagnostics)
				for (const file of [
					"report.json",
					"native.json",
					"journal.jsonl",
					"http.json",
				])
					if (existsSync(path.join(folder, file)))
						cpSync(
							path.join(folder, file),
							path.join(diagnostics, `${scenario.name}-${file}`),
						);
			assert.equal(
				result.status,
				scenario.exit,
				`${scenario.name}: unexpected Nightwatch exit; see retained logs/native data`,
			);
			const journal = readFileSync(env.CTRF_JOURNAL, "utf8")
				.trim()
				.split("\n")
				.map(JSON.parse);
			assert.ok(
				journal.every(
					(e) => typeof e.sessionId === "string" && e.sessionId.length > 0,
				),
				"Actual Chrome sessions must exist",
			);
			if (scenario.name === "workers")
				assert.equal(
					new Set(journal.map((e) => e.pid)).size,
					2,
					"Two actual child workers",
				);
			if (scenario.retry)
				assert.equal(
					journal.filter((e) => e.event === "attempt").length,
					2,
					"Two actual testcase attempts",
				);
			const passScenarios = [
				"workers",
				"defaults",
				"shard-one",
				"shard-two",
				"custom-identity",
				"runtime-error",
				"retry-recovery",
			];
			for (const module of Object.values(native.modules))
				for (const [name, test] of Object.entries(module.completed)) {
					const fails =
						name === "runtime error" ||
						(name === "controlled outcome" &&
							!passScenarios.includes(scenario.name));
					assert.equal(
						test.status,
						fails ? "fail" : "pass",
						`${scenario.name}: independently planned native outcome for ${name}`,
					);
					if (name === "runtime error") {
						assert.ok(test.errors > 0);
						assert.match(test.lastError.message, /controlled runtime error/);
					} else {
						assert.equal(
							test.errors,
							0,
							`${scenario.name}: unexpected native error`,
						);
						if (fails)
							assert.match(test.lastError.message, /controlled outcome/);
					}
				}
			assert.ok(
				JSON.parse(readFileSync(env.CTRF_HTTP_LOG, "utf8")).length > 0,
				"Loopback HTTP requests must occur",
			);
			const completed = Object.values(native.modules).flatMap((m) =>
				Object.keys(m.completed),
			);
			const wanted =
				scenario.shard === 1
					? ["pass ✓"]
					: scenario.shard === 0
						? ["pass ✓", "controlled outcome", "after outcome"]
						: scenario.name === "runtime-skip"
							? ["pass ✓", "controlled outcome", "pass ✓"]
							: ["pass ✓", "controlled outcome", "after outcome", "pass ✓"];
			if (scenario.name === "runtime-error") wanted.push("runtime error");
			assert.deepEqual(
				completed.sort(),
				wanted.sort(),
				"Independent native test inventory",
			);
			if (scenario.name === "runtime-skip")
				assert.ok(
					Object.values(native.modules).some((m) =>
						m.skippedAtRuntime.includes("after outcome"),
					),
					"Native runtime skip must occur",
				);
			if (diagnostics)
				for (const file of [
					"report.json",
					"native.json",
					"journal.jsonl",
					"http.json",
				])
					cpSync(
						path.join(folder, file),
						path.join(diagnostics, `${scenario.name}-${file}`),
					);
			const expectedOptions =
				scenario.name === "nonfinite-build-number"
					? { ...options, buildNumber: Infinity }
					: options;
			samples.push({
				name: scenario.name,
				base64: bytes.toString("base64"),
				report: JSON.parse(bytes),
				native,
				expected: expectedReport(native, expectedOptions),
				options: expectedOptions,
				runWindow,
			});
		}
		const full = samples.find((sample) => sample.name === "full");
		const bytes = Buffer.from(full.base64, "base64");
		checkEntry(
			catalogue.entries.find((entry) => entry.rule === "single-json-object"),
			{ samples: [{ ...full, bytes }], warnings: [] },
		);
		for (const [rule, mutate] of [
			[
				"single-json-object",
				(r) => {
					r.results.tests[0].duration = "invalid";
				},
			],
			[
				"single-json-object",
				(r) => {
					r.results.tests[0].retries = -1;
				},
			],
			[
				"summary-matches-final-results",
				(r) => {
					r.results.summary.passed++;
				},
			],
			[
				"declares-supported-contract",
				(r) => {
					r.specVersion = "9.9.9";
				},
			],
		]) {
			const report = structuredClone(full.report);
			mutate(report);
			assert.throws(() =>
				checkEntry(
					catalogue.entries.find((e) => e.rule === rule),
					{
						samples: [
							{
								name: "corrupted installed output",
								report,
								bytes: Buffer.from(JSON.stringify(report)),
							},
						],
						warnings: [],
					},
				),
			);
		}
		return {
			samples,
			repeated: ["full", "repeated"],
			shards: ["shard-one", "shard-two"],
			warnings: [],
		};
	} finally {
		rmSync(consumer, { recursive: true, force: true });
	}
}
