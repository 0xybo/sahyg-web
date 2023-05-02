const Page = require("../lib/page");
const fs = require("fs");

class Settings extends Page {
	constructor(/** @type {import('../index')} */ Web) {
		super(Web);
		this.Web = Web;
		this.settings = this.Web.config.get("settings");

		let processSetting = (settingsProperties, [settingName, settingValue]) => {
			if (settingValue.customProcess) return settingsProperties;

			if (settingValue.type !== "section") settingsProperties[settingName] = settingValue;
			else Object.entries(settingValue.content).forEach(processSetting.bind(null, settingsProperties));

			return settingsProperties;
		};
		this.settingsProperties = Object.entries(this.settings).reduce(processSetting, {});

		this.shareableUserProperties = this.Web.config.get("shareableUserProperties");

		// this.setPost(["/settings"], this.Web.server.upload.fields([{ name: "avatar", maxCount: 1 }]), this.post.bind(this));
		this.setGet(["/settings", "/user/:user/settings"], this.page.bind(this));
		this.setGet(["/settings/list", "/user/:user/settings/list"], this.list.bind(this));
		this.setPost(["/settings/set", "/user/:user/settings/set"], this.setSettings.bind(this));
	}

	async post(req, res, next) {
		try {
			let settingsConfig = this.Web.config.get("settings");
			for (let [key, value] of Object.entries(req.body)) {
				if (key == "avatar") {
					fs.unlinkSync(`${this.Web.config.get("paths.avatar")}/${req.WebRequest.user._id}`);
					req.WebRequest.user.avatar = false;
				} else if (key == "shared") {
					value = value.split(",");
					if (value[0] == "") value = [];
					let shareable = this.Web.config.get("shareableUserProperties");
					if (
						!value.every((val) => {
							if (val.includes(".")) {
								return shareable.includes(val.split(".")[0] + ".*");
							} else return shareable.includes(val);
						})
					)
						return res.WebResponse.error("INVALID_SETTING_VALUE", { details: { key, value } });
					req.WebRequest.user.shared = value;
				} else {
					if (!(key in settingsConfig)) return res.WebResponse.error("INVALID_SETTING_NAME", { details: { key, value } });
					if (!(await req.WebRequest.user.checkPermissions(settingsConfig[key].edit)))
						return res.WebResponse.error("UNAUTHORIZED_SETTING_EDITION", { details: { key, value } });
					req.WebRequest.user[key] = value;
				}
			}
			let avatar = req.files?.avatar?.[0];
			if (avatar) {
				if (avatar.size > this.Web.config.get("maxAvatarSize")) return res.WebResponse.error("AVATAR_SIZE_EXCEEDED");
				fs.copyFileSync(avatar.path, `${this.Web.config.get("paths.avatar")}/${req.WebRequest.user._id}`);
				fs.unlinkSync(avatar.path);
				req.WebRequest.user.avatar = true;
			}
			await req.WebRequest.user.save();
			return res.WebResponse.send();
		} catch (e) {
			this.logger.error(e);
		}
	}

	async page(req, res, next) {
		let user = await this.getTarget(req, res);
		let tabs = [
			{
				text: req.__("GENERAL"),
				id: "general",
			},
			{
				text: req.__("PROFILE"),
				id: "profile",
			},
			{
				text: req.__("SECURITY"),
				id: "security",
			},
			{
				text: req.__("CONFIDENTIALITY"),
				id: "confidentiality",
			},
		];
		let settings = Object.fromEntries(
			await Promise.all(
				Object.entries(this.Web.config.get("settings")).map(async ([id, properties]) => {
					return [
						id,
						{
							display: await user.checkPermissions(properties.display),
							edit: await user.checkPermissions(properties.edit),
						},
					];
				})
			)
		);
		if (user.username != "guest") {
		}
		res.WebResponse.render("settings", { tabs, settings, maxAvatarSize: this.Web.config.get("maxAvatarSize") });
	}
	async processSetting(target, req, name, properties) {
		if (!(await req.WebRequest.user.checkPermissions(properties.display))) return null;
		let setting = {
			id: name,
			editable: await req.WebRequest.user.checkPermissions(properties.edit),
			type: properties.type,
			description: this.i18n(req, properties.description),
			title: this.i18n(req, properties.title),
			category: properties.category,
			needReload: !!properties.needReload,
		};
		switch (properties.type) {
			case "selectOne":
			case "select": {
				setting.options = Object.fromEntries(Object.entries(properties.options).map(([id, text]) => [id, this.i18n(req, text)]));
				break;
			}
			case "text": {
				setting.validator = properties.validator;
				break;
			}
			case "inputArray": {
				setting.columns = properties.columns;
				break;
			}
			case "section": {
				let content = [];
				for (let [contentSettingName, contentSettingProperties] of Object.entries(properties.content)) {
					let contentSetting = await this.processSetting(target, req, contentSettingName, contentSettingProperties);
					if (contentSetting) content.push(contentSetting);
				}
				setting.content = content;
				break;
			}
		}
		switch (name) {
			default: {
				setting.value = target[name];
			}
		}
		return setting;
	}
	async list(req, res) {
		let target = await this.getTarget(req, res);

		let settings = [];
		for (let [name, properties] of Object.entries(this.Web.config.get("settings"))) {
			let setting = await this.processSetting(target, req, name, properties);
			if (setting) settings.push(setting);
		}

		res.WebResponse.setContent(settings).send();
	}
	i18n(req, text) {
		if (!text) return "";
		return text.startsWith("@raw>") ? text.substring(5) : req.__(text);
	}
	async setSettings(req, res, next) {
		try {
			let target = await this.getTarget(req, res);

			if (!target) return res.WebResponse.error("USER_NOT_FOUND");

			let settings = req.body;

			if (!settings || !Object.keys(settings).length) return res.WebResponse.error("MISSING_PARAMETER");

			// To store settings that are not correct
			let notEnoughPermissions = [],
				notFound = [],
				invalidValue = [],
				settingsQuantity = Object.keys(settings).length;

			for (let [settingName, settingValue] of Object.entries(settings)) {
				settingName = settingName.toLowerCase();
				let settingProperties = this.settingsProperties[settingName];

				// Check if setting exists
				if (!settingProperties) {
					notFound.push(settingName);
					continue;
				}

				// Check if user has enough permissions to edit this setting
				if (!req.WebRequest.user.checkPermissions(settingProperties.edit)) {
					notEnoughPermissions.push(settingName);
					continue;
				}

				// Check if setting has a validator and if its value respects it
				if (settingProperties.validator) {
					if (!this.valid(settingValue, settingProperties.validator)) {
						invalidValue.push(settingName);
						continue;
					}
				} else
					switch (settingProperties.type) {
						case "selectOne": {
							if (!this.settingsProperties[settingName].options?.[settingValue]) {
								invalidValue.push(settingName);
								continue;
							}
							break;
						}
						case "inputArray": {
							if (!(settingValue instanceof Array)) {
								invalidValue.push(settingName);
								continue;
							}
							for (let row of settingValue) {
								for (let [key, value] of Object.entries(row)) {
									key = key.toLowerCase();
									let column = settingProperties.columns.find((column) => column.id === key);
									if (!column || !column.validator || !this.valid(value, column.validator)) {
										invalidValue.push(settingName);
										continue;
									}
								}
							}
							break;
						}
					}

				target[settingName] = settingValue;
			}
			if (notEnoughPermissions.length === settingsQuantity) {
				return res.WebResponse.error("UNAUTHORIZED", { details: { settings: notEnoughPermissions } });
			} else if (notFound.length === settingsQuantity) {
				return res.WebResponse.error("NOT_FOUND", { details: { settings: notFound } });
			} else if (invalidValue.length === settingsQuantity) {
				return res.WebResponse.error("INVALID_VALUE", { details: { settings: invalidValue } });
			} else if (notEnoughPermissions.length + notFound.length + invalidValue.length === settingsQuantity) {
				return res.WebResponse.error("BAD_REQUEST", {
					details: { notFound: notFound, invalidValues: invalidValue, unauthorized: notEnoughPermissions },
				});
			}

			await target.save();
			return res.WebResponse.send();
		} catch (e) {
			return res.WebResponse.error("SERVER_ERROR");
		}
	}
	valid(value, validator) {
		if (typeof validator === "function") {
			// Validator is a function
			if (!validator(value)) return false;
		} else if (typeof validator === "string") {
			// Validator is a RegExp as string
			let { exp, flags } = /^(?:\/)(?<exp>.+)(?:\/)(?<flags>g?m?i?y?u?s?d?)$/g.exec(validator)?.groups || {};
			if (!exp || !new RegExp(exp, flags).test(value)) return false;
		} else if (validator instanceof RegExp) {
			// Validator is a RegExp
			return validator.test(value);
		}
		return true;
	}
	async getTarget(req, res) {
		let target = req.WebRequest.user;
		if (req.params.user) {
			let user = await this.Web.db.User({ username: req.params.user });
			if (!user) return void res.WebResponse.error("NOT_FOUND");
			if (target._id != user._id && !(await target.checkPermissions(["WEB_ADMIN_SETTINGS_PAGE"])))
				return void res.WebResponse.error("UNAUTHORIZED");
			target = user;
		}
		return target;
	}
}

module.exports = Settings;
