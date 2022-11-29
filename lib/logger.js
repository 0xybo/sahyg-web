const safe = require("colors/safe");
const moment = require("moment");
const { createWriteStream } = require("fs");

class LoggerStore {
	constructor({ logPath, maxNameLength, maxTypeLength }) {
		this.maxNameLength = maxNameLength;
		this.maxTypeLength = maxTypeLength;
		this.logPath = logPath;
		this.filename = `${this.logPath}/${moment().format("DD-MM-YYYY_HH-mm-ss")}.log`;
		this.file = createWriteStream(this.filename, { flags: "a" });
		this.logger = new Logger(this, "Logger");
		this.store = [
			{
				name: "Logger",
				logger: this.logger,
				createdAt: Date.now(),
			},
		];
		this.logger.debug("Logger store initialized");
	}

	logFile(message) {
		this.file.write(message + "\n");
	}

	/**
	 * ANCHOR new
	 *
	 * Create a new logger
	 * @param {String} name
	 * @returns {Logger}
	 */
	new(name) {
		if (this.get(name)) {
			this.logger.warn(`Logger '${name}' already exists`);
			return this.get(name);
		}
		let logger = new Logger(this, name);
		this.store.push({
			name,
			logger,
			createdAt: Date.now(),
		});
		return logger;
	}
	/**
	 * ANCHOR get
	 *
	 * Get logger from the store
	 * @param {String} name
	 * @return {Logger?}
	 */
	get(name) {
		return this.store.find((logger) => logger.name === name);
	}
	/**
	 * ANCHOR delete
	 *
	 * Delete logger from the store
	 * @param {String} name
	 * @returns {Boolean}
	 */
	delete(name) {
		if (!this.get(name)) {
			this.logger.error(`Logger '${name}' not found`);
			return false;
		}
		this.store.splice(
			this.store.findIndex((logger) => logger.name === name),
			1
		);
		return true;
	}
}

class Logger {
	/**
	 * ANCHOR CONSTRUCTOR
	 *
	 * Initializes the logger.
	 * @param {String} name The name was display after the date/time and before the type of log
	 * @returns {Logger}
	 */
	constructor(loggerStore, name) {
		this.name = name;
		this.loggerStore = loggerStore;
		if (name != "Logger") this.loggerStore.logger.debug(`New Logger '${name}'`);
		else this.debug(`New Logger '${name}'`);
	}
	/**
	 * ANCHOR NEW
	 *
	 * Create new logger instance
	 * @param {String} name
	 * @returns {Logger}
	 */
	new(name) {
		return this.loggerStore.new(`${this.name}:${name}`);
	}
	/**
	 * ANCHOR ERROR
	 *
	 * Display an error in the console.
	 * @param {String | Error} message
	 * @returns {void}
	 */
	error(message) {
		let msg = "";
		if (message.stack) {
			msg = this._message(message.stack || message, "Error");
			console.log(safe.red(safe.bold(msg)));
			console.error(message);
		} else {
			msg = this._message(message, "Error");
			console.log(safe.red(safe.bold(msg)));
		}
		this.loggerStore.logFile(msg);
		return;
	}
	/**
	 * ANCHOR WARN
	 *
	 * Display a warn message in the console.
	 * @param {String} message
	 * @returns {void}
	 */
	warn = this._log.bind(
		this,
		"Warn",
		function (message) {
			return safe.yellow(safe.bold(message));
		},
		"warn"
	);
	/**
	 * ANCHOR INFO
	 *
	 * Display a information message in the console.
	 * @param {String} message
	 * @returns {void}
	 */
	info = this._log.bind(
		this,
		"Info",
		function (message) {
			return safe.gray(safe.bold(message));
		},
		"log"
	);
	/**
	 * ANCHOR OK
	 * Display a success message in the console.
	 * @param {String} message
	 * @returns {void}
	 */
	ok = this._log.bind(
		this,
		"OK",
		function (message) {
			return safe.cyan(safe.bold(message));
		},
		"log"
	);
	/**
	 * ANCHOR PROGRESS
	 *
	 * Display a progress message in the console.
	 * @param {String} message
	 * @returns {void}
	 */
	progress = this._log.bind(
		this,
		"Progress",
		function (message) {
			return safe.blue(safe.bold(message));
		},
		"log"
	);
	/**
	 * ANCHOR DEBUG
	 *
	 * Display a debug message in the console.
	 * @param {String} message
	 * @returns {void}
	 */
	debug = this._log.bind(
		this,
		"Debug",
		function (message) {
			return safe.gray(message);
		},
		"debug"
	);

	/**
	 * ANCHOR CUSTOM
	 *
	 * Send a custom message to the console
	 * @param {String} message
	 * @param {{name: String, colors: String[]}} param1
	 */
	custom(message, { name, colors }) {
		this._log(
			name || "Custom",
			(msg) => {
				colors.forEach((color) => {
					if (safe[color]) msg = safe[color](msg);
				});
				return msg;
			},
			"log",
			message
		);
	}

	_log(name, format, type, message) {
		let msg = this._message(message, name);
		this.loggerStore.logFile(msg);
		console[type](format(msg));
	}

	_message(msg, type) {
		let name = (this.name + " ".repeat(this.loggerStore.maxNameLength)).substring(0, this.loggerStore.maxNameLength);
		type = (type + " ".repeat(this.loggerStore.maxTypeLength)).substring(0, this.loggerStore.maxTypeLength);
		return `[${moment().format("DD-MM-YYYY HH:mm:ss.SSS")}][${name}][${type}] : ${msg.replace(
			/\n|\r/gm,
			"\n" + " ".repeat(32 + this.loggerStore.maxNameLength + this.loggerStore.maxTypeLength)
		)}`;
	}
}

module.exports = LoggerStore;
