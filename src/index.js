const dotenv = require("dotenv");
const { readdir, unlink, stat } = require("fs/promises");
const path = require("path");
const { I18n } = require("i18n");
dotenv.config();

const Utils = require("./lib/utils");
const Config = require("./lib/config");
const LoggerStore = require("./lib/logger");
const API = require("./lib/api");
const Server = require("./lib/server");
const DB = require("./lib/db");
const Mail = require("./lib/mail");

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
		this.responseLogger = this.loggerStore.new("Response");

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

		// delete all uploaded file 
		let uploadsDirectory = this.config.get("paths.uploads");
		try {
			let files = await readdir(uploadsDirectory);
			if (files)
				for (const file of files) {
					let err = await unlink(path.join(uploadsDirectory, file));
					if (err) this.logger.error(err);
					else this.logger.debug(`Uploaded file '${file}' deleted successfully`);
				}
		} catch (e) {
			console.log(e);
			this.logger.error("Unable to locate upload directory");
		}

		// delete all log files older than one month
		let logDirectory = this.config.get("paths.logs");
		let maxAge = this.config.get("maxLogAge");
		try {
			let files = await readdir(logDirectory);
			if (files)
				for (const file of files) {
					let stats = await stat(path.join(logDirectory, file));
					if (!stats.isDirectory()) {
						if (stats.birthtime < new Date(Date.now() - maxAge)) {
							let err = await unlink(path.join(logDirectory, file));
							if (err) this.logger.error(err);
							else this.logger.debug(`Log file '${file}' deleted successfully`);
						}
					}
				}
		} catch (e) {
			console.log(e);
			this.logger.error("Unable to locate log directory");
		}

		this.db = new DB(this);
		await this.db.init();

		this.api = new API(this);
		await this.api.init();

		this.mail = new Mail(this);
		await this.mail.init();

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
