const fs = require("node:fs");
module.exports = {
	before(browser) {
		browser.navigateTo(process.env.CTRF_FIXTURE_URL).perform(() =>
			fs.appendFileSync(
				process.env.CTRF_JOURNAL,
				JSON.stringify({
					pid: process.pid,
					sessionId: browser.sessionId,
					event: "two-before",
				}) + "\n",
			),
		);
	},
	"pass ✓"(browser) {
		browser.assert.titleEquals("CTRF fixture");
	},
	after(browser) {
		browser.end();
	},
};
