const fs = require("node:fs");
function record(browser, event) {
	fs.appendFileSync(
		process.env.CTRF_JOURNAL,
		JSON.stringify({ pid: process.pid, sessionId: browser.sessionId, event }) +
			"\n",
	);
}
module.exports = {
	before(browser) {
		browser
			.navigateTo(process.env.CTRF_FIXTURE_URL)
			.perform(() => record(browser, "one-before"));
	},
	"pass ✓"(browser) {
		browser.assert.titleEquals("CTRF fixture");
	},
	"controlled outcome"(browser) {
		browser.perform(() => record(browser, "attempt"));
		const scenario = process.env.CTRF_FIXTURE_SCENARIO;
		const count = fs
			.readFileSync(process.env.CTRF_JOURNAL, "utf8")
			.trim()
			.split("\n")
			.map(JSON.parse)
			.filter((e) => e.event === "attempt").length;
		const pass =
			[
				"workers",
				"defaults",
				"shard-one",
				"shard-two",
				"custom-identity",
				"runtime-error",
			].includes(scenario) ||
			(scenario === "retry-recovery" && count >= 1);
		browser.assert.equal(pass, true, "controlled outcome");
	},
	"after outcome"(browser) {
		browser.assert.equal(1, 1);
	},
	...(process.env.CTRF_FIXTURE_SCENARIO === "runtime-error"
		? {
				async "runtime error"() {
					throw new Error("controlled runtime error");
				},
			}
		: {}),
	after(browser) {
		browser.end();
	},
};
