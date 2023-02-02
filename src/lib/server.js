const express = require("express");
const expressSession = require("express-session");
const bodyParser = require("body-parser");
const multer = require("multer");
const hpp = require("hpp");
const helmet = require("helmet");
const cors = require("cors");
const http = require("http");
const https = require("https");
const path = require("path");
const recursive_readdir = require("recursive-readdir");
const { readFileSync } = require("fs");
const compression = require("compression");

const WebRequest = require("./web_request");
const WebResponse = require("./web_response");

class Express {
	constructor(/** @type {import("../index")} */ Web) {
		this.Web = Web;

		this.logger = Web.loggerStore.new("Express");
		this.secret = Web.config.get("SECRET");
		this.sessionCookieName = Web.config.get("expressSession.name");
	}
	async expressInit() {
		this.express = express();
		this.upload = multer({ dest: this.Web.config.get("paths.uploads") });

		this.express.set("view engine", "pug");
		this.express.set("views", this.Web.config.get("paths.views"));
		this.express.set("trust proxy", true);
		this.express.disable("x-powered-by");

		if (!this.Web.config.dev) this.express.use(compression());

		this.express.use(
			cors(this.Web.config.get("cors")),
			helmet(this.Web.config.get("helmet")),
			this.setHeaders(this.Web.config.get("headers")),
			expressSession({
				...this.Web.config.get("expressSession"),
				store: this.Web.db.sessionsMemoryStore,
			}),
			// (req, res, next) => (this.Web.config.dev ? console.log({ req, res }) : null, next()),
			this.Web.i18n.init,
			async (...args) => await new WebRequest(this.Web, ...args).asyncConstructor(),
			express.static(this.Web.config.get("paths.static")),
			bodyParser.urlencoded(this.Web.config.get("bodyParser")),
			// hpp(),
			async (...args) => await new WebResponse(this.Web, ...args).asyncConstructor()
		);

		await this.loadPages();
	}
	setHeaders(headers) {
		headers = Object.entries(headers);
		return function (
			/** @type {import('express').Request}*/ req,
			/** @type {import('express').Response}*/ res,
			/** @type {import('express').NextFunction}*/ next
		) {
			headers.forEach(([name, value]) => res.setHeader(name, value));
			next();
		};
	}
	async loadPages() {
		this.pages = {};
		let pagesDirectory = path.join(process.cwd(), this.Web.config.get("paths.pages"));
		(await recursive_readdir(pagesDirectory, ["error.js"])).forEach((link) => {
			try {
				let name = link.match(/(?<=^|\\|\/)[^\\\/]+(?=.js$)/gm)?.[0];
				if (!name) return void this.logger.warn(`Unable to load page from ${link}`);
				let pageConfig = this.Web.config.get(["pages", name]);
				if (!pageConfig) return void this.logger.warn(`Failed to get page '${name}' config.`);
				if (!pageConfig.enabled) return void this.logger.warn(`Page '${name}' is disabled`);
				let page = new (require(link))(this.Web);
				this.pages[name] = {
					link,
					page,
					config: pageConfig,
				};
				this.logger.info(`Page '${name}' loaded successfully`);
			} catch (e) {
				console.error(e);
				this.logger.warn(`Failed to load page from ${link}`);
			}
		});
		let pageConfig = this.Web.config.get("pages.error");
		let pageLink = path.join(pagesDirectory, "error.js");
		this.pages.error = {
			link: pageLink,
			page: new (require(pageLink))(this.Web),
			config: pageConfig,
		};
		this.logger.info(`Page 'error' loaded successfully`);
	}
}

class Server extends Express {
	constructor(/** @type {import('../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.logger = Web.loggerStore.new("Server");
	}
	async init() {
		await this.expressInit();

		this.https = https.createServer(
			{
				key: readFileSync(this.Web.config.get("certificates.key")),
				cert: readFileSync(this.Web.config.get("certificates.cert")),
			},
			this.express
		);
		this.http = http.createServer((req, res) => {
			res.writeHead(302, {
				location: `https://${req.headers.host.match(/[a-z0-9\._-]+/)[0]}:${this.Web.config.get("ports.https") || 443}${req.url}`,
			});
			res.end();
		});

		return;
	}
	async launch() {
		this.https.listen(this.Web.config.get("ports.https") || 443, () => {
			this.logger.ok(`Server https listening on ${this.Web.config.get("ports.https") || 443}`);
		});
		this.http.listen(this.Web.config.get("ports.http") || 80, () => {
			this.logger.ok(`Server http listening on ${this.Web.config.get("ports.http") || 80}`);
		});

		return;
	}
}

module.exports = Server;
