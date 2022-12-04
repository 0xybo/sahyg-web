const dotenv = require("dotenv");
const { readdir, unlink} = require("fs");
const path = require("path");
const { I18n } = require("i18n");
dotenv.config();

const Utils = require("./lib/utils");
const Config = require("./lib/config");
const LoggerStore = require("./lib/logger");
const API = require("./lib/api");
const Server = require("./lib/server");
const DB = require("./lib/db");
const Errors = require("./lib/errors");

class Web {
	constructor() {
		this.utils = new Utils();
		this.config = new Config(["web.json"]);
		this.loggerStore = new LoggerStore({
			logPath: this.config.get("paths.logs"),
			maxNameLength: this.config.get("logging.maxNameLength"),
			maxTypeLength: this.config.get("logging.maxNameLength"),
		});
		this.logger = this.loggerStore.new("Main");
		this.requestLogger = this.loggerStore.new("Request");

		this.logger.custom(
			[
				`╔════════════════════════════════════════════════════╗`,
				`║                      SAHYG Web                     ║`,
				`║                     By Alban G.                    ║`,
				`╠════════════════════════════════════════════════════╝`,
				`║   Version : ${this.config.package.version}`,
				`║   Environment : ${this.config.dev ? "development" : "production"}`,
				`╚`,
			].join("\n"),
			{
				name: "Infos",
				colors: ["cyan", "bold"],
			}
		);

		this.init();
	}
	async init() {
		this.i18n = new I18n(this.config.get("i18n"));

		let uploadsDirectory = this.config.get("paths.uploads");
		readdir(uploadsDirectory, (err, files) => {
			if (err) this.logger.error(err);
			else
				for (const file of files) {
					unlink(path.join(uploadsDirectory, file), (err) => {
						if (err) this.logger.error(err);
						else this.logger.debug(`Uploaded file '${file}' deleted successfully`);
					});
				}
		});
		this.db = new DB(this);
		await this.db.init();

		this.api = new API(this);
		await this.api.init();

		this.server = new Server(this);
		await this.server.init();

		await this.start();
	}
	async start() {
		await this.server.launch();
	}
	async stop() {} // TODO stop
	async restart() {} // TODO restart
	async status() {} // TODO status
}

new Web();

module.exports = Web;
