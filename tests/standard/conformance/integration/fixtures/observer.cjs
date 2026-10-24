const fs = require("node:fs");
exports.write = (results) => {
	fs.writeFileSync(
		process.env.CTRF_NATIVE_RESULT,
		JSON.stringify(results, (_key, value) =>
			value instanceof Error
				? {
						...value,
						name: value.name,
						message: value.message,
						stack: value.stack,
					}
				: value,
		),
	);
};
