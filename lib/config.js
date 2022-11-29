const Utils = new (require("./utils"))();

// For eval in config file
// const path = require("path");
// const mongoose = require("mongoose");
// const uid = require("uid-safe");

class Config {
	constructor(extras) {
		this.config_path = "../" + process.env.CONFIG_FOLDER;
		this.loadedModules = {};

		this.originConfig = {
			env: process.env,
			...this.importFile(process.env.MAIN_CONFIG),
		};

		for (const extra of extras) {
			this.originConfig = this.concatenate(this.originConfig, this.importFile(extra));
		}

		this.package = require("../package.json");

		this.dev = this.originConfig.env.NODE_ENV == "development";

		this.config = this.loadConfig(this.originConfig);
		this.config = this.replaceReferences(this.config);

		this.config = { ...this.config, package: this.package, releaseNotes: this.importFile("web_release_notes.json") };
	}
	concatenate(obj1, obj2) {
		if (obj1 === undefined || obj1 == null) return obj2;
		if (obj2 === undefined || obj2 == null) return obj1;
		if (!(obj2 instanceof obj1.constructor)) return obj2;
		if (typeof obj1 == "string") return obj2 || obj1;
		if (obj1 instanceof Array) return obj1.concat(obj2);
		if (obj1?.constructor?.name != "Object") return obj2;
		return {
			...Object.fromEntries(Object.entries(obj1).filter(([key, value]) => !(key in obj2))),
			...Object.fromEntries(Object.entries(obj2).filter(([key, value]) => !(key in obj1))),
			...Object.fromEntries(
				Object.entries(obj1)
					.filter(([key, value]) => key in obj2)
					.map(([key, value]) => [key, this.concatenate(value, obj2[key])])
			),
		};
	}
	loadConfig(configValue) {
		if (typeof configValue == "string") return this.replaceConfigCommand(configValue);
		if (configValue instanceof Array) return configValue.map((v, i) => this.loadConfig(v));
		if (configValue?.constructor?.name != "Object") return configValue;
		Object.keys(configValue).forEach((key) => {
			if (key.startsWith("@include>")) {
				delete configValue[key];
				configValue = { ...configValue, ...this.loadConfig(this.importFile(key.substring(9))) };
			}
			if (key == "@requiredModules") {
				for (const mod of configValue[key]) {
					if (!(mod in this.loadedModules)) this.loadedModules[mod] = require(mod);
				}
			}
		});
		if ((this.dev ? "@development" : "@production") in configValue)
			return this.loadConfig(configValue[this.dev ? "@development" : "@production"]);
		return Object.fromEntries(Object.entries(configValue).map(([k, v]) => [k, this.loadConfig(v)]));
	}
	matchCommand(value, matchPrefix = "@") {
		return new RegExp(`(?:(?<!\\\\)${matchPrefix})(?<key>[0-9a-z]*)(?:{)(?<value>(?:(?!${matchPrefix}[0-9a-z]*{).)*)(?<!})(?:})`).exec(value);
	}
	replaceConfigCommand(value) {
		if (typeof value != "string") return value;
		let [match, key, val] = this.matchCommand(value) || [];
		if (!match) return value;
		if (key == "eval") {
			let fn = Object.keys(this.loadedModules).length
				? "return " + val.replace(RegExp(Array.from(Object.keys(this.loadedModules)).join("|")), "this.$&")
				: (fn = "return " + val);
			let result = Function(fn).call(this.loadedModules);
			value = typeof result == "string" ? value.replace(match, result) : result;
		} else if (key == "include") {
			let result = this.loadConfig(this.importFile(val));
			value = typeof result == "string" ? value.replace(match, result) : result;
		} else if (key == "join") {
			let splitted = value.split(";");
			let separator = splitted.splice(0, 1);
			value = value.replace(match, splitted.join(separator));
		} else if (key == "ref") {
			value = value.replace(match, "$" + match.substring(1));
		}
		return this.replaceConfigCommand(value);
	}
	replaceReferences(value) {
		if (typeof value == "string") {
			let [match, key, val] = this.matchCommand(value, "\\$") || [];
			if (!match) return value;
			if (key == "ref") {
				let result = this.get(val);
				value = typeof result == "string" ? value.replace(match, result) : result;
			}
			return this.replaceReferences(value);
		}
		if (value instanceof Array) return value.map((v, i) => this.replaceReferences(v));
		if (value?.constructor?.name != "Object") return value;
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.replaceReferences(v)]));
	}
	importFile(path) {
		try {
			return require(this.config_path + "/" + path);
		} catch (e) {
			return {};
		}
	}
	/**
	 * ANCHOR get
	 *
	 * Returns the configuration value for the path.
	 * The path can be an array of strings or a string divisible by '.'.
	 * If the first element of the path is preceded by '#', it is used as the configuration file name.
	 * @param {String | Array} path
	 * @returns {any}
	 */
	get(name) {
		let pile = name instanceof Array ? name : name.split(".");
		let param = this.config;
		while (pile.length && param) {
			param = Object.entries(param).find(([k, v]) => k == pile[0])?.[1];
			pile.shift();
		}
		return param;
	}
}

module.exports = Config;
