import { createRequire } from "node:module";
import reporter from "nightwatch-ctrf-json-reporter";

const require = createRequire(import.meta.url);

describe("package exports", () => {
	it("supports ESM default import from the package root", () => {
		expect(typeof reporter).toBe("object");
		expect(typeof reporter.write).toBe("function");
		expect(reporter.reporterName).toBe("nightwatch-ctrf-json-reporter");
	});

	it("supports CJS require from the package root", () => {
		const cjsReporter = require("nightwatch-ctrf-json-reporter");

		expect(typeof cjsReporter).toBe("object");
		expect(typeof cjsReporter.write).toBe("function");
		expect(cjsReporter.reporterName).toBe("nightwatch-ctrf-json-reporter");
	});
});
