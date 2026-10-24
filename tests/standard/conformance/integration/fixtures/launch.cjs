const http = require("node:http");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const requests = [];
const server = http.createServer((req, res) => {
	requests.push(req.url);
	res.setHeader("content-type", "text/html; charset=utf-8");
	res.end("<title>CTRF fixture</title><p>local fixture</p>");
});
server.listen(0, "127.0.0.1", () => {
	const child = spawn(process.execPath, process.argv.slice(2), {
		stdio: "inherit",
		env: {
			...process.env,
			CTRF_FIXTURE_URL: `http://127.0.0.1:${server.address().port}/`,
		},
	});
	child.on("error", (error) => {
		console.error(error);
		server.close(() => {
			process.exitCode = 2;
		});
	});
	child.on("close", (code) => {
		fs.writeFileSync(process.env.CTRF_HTTP_LOG, JSON.stringify(requests));
		server.close(() => {
			process.exitCode = code ?? 2;
		});
	});
});
