const path = require("node:path");
const options = JSON.parse(process.env.CTRF_FIXTURE_OPTIONS);
if (process.env.CTRF_FIXTURE_SCENARIO === "nonfinite-build-number")
	options.buildNumber = Infinity;
if (options.customIdentity)
	options.testIdResolver = ({ name, suite }) => `custom:${suite[0]}:${name}`;
module.exports = {
	src_folders: [path.join(__dirname, "specs")],
	output_folder: process.env.CTRF_NATIVE_OUTPUT,
	disable_colors: true,
	disable_error_log: false,
	output: true,
	detailed_output: true,
	test_workers:
		process.env.CTRF_FIXTURE_SCENARIO === "workers"
			? { enabled: true, workers: 2 }
			: false,
	use_child_process: true,
	test_settings: {
		default: {
			globals: { ctrf: options, retryAssertionTimeout: 0 },
			skip_testcases_on_fail:
				process.env.CTRF_FIXTURE_SCENARIO === "runtime-skip",
			end_session_on_fail: false,
			webdriver: {
				start_process: true,
				port: 0,
				log_path: process.env.CTRF_NATIVE_OUTPUT,
			},
			desiredCapabilities: {
				browserName: "chrome",
				"goog:chromeOptions": {
					...(process.env.CTRF_CHROME_BINARY
						? { binary: process.env.CTRF_CHROME_BINARY }
						: {}),
					args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
				},
			},
		},
	},
};
