const Page = require("../lib/page");
const fs = require("fs");

class Settings extends Page {
	constructor(/** @type {import('../index')} */ Web) {
		super(Web);
		this.Web = Web;

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
				text: req.__("SHARED"),
				id: "shared",
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

	async list(req, res, next) {
		let target = await this.getTarget(req, res);

		let settings = [];
		for (let [id, properties] of Object.entries(this.Web.config.get("settings"))) {
			if (!(await req.WebRequest.user.checkPermissions(properties.display))) continue;
			let setting = {
				id,
				editable: await req.WebRequest.user.checkPermissions(properties.edit),
				type: properties.type,
				description: this.i18n(req, properties.description),
				title: this.i18n(req, properties.title),
				category: properties.category,
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
				}
			}
			switch (id) {
				default: {
					setting.value = target[id];
				}
			}
			settings.push(setting);
		}

		res.WebResponse.setContent(settings).send();
	}
	i18n(req, text) {
		if (!text) return "";
		return text.startsWith("@raw>") ? text.substring(5) : req.__(text);
	}
	async setSettings(req, res, next) {}
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
