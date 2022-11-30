const Page = require("../lib/page");
const fs = require("fs");

class Settings extends Page {
	constructor(/** @type {import('../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.setPost(["/settings"], this.Web.server.upload.fields([{ name: "avatar", maxCount: 1 }]), this.post.bind(this));
		this.setGet(["/settings"], this.get.bind(this));
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
				if (avatar.size > 1000000) return res.WebResponse.error("AVATAR_SIZE_EXCEEDED");
				fs.copyFileSync(avatar.path, `${this.Web.config.get("paths.avatar")}/${req.WebRequest.user._id}`);
				fs.unlinkSync(avatar.path);
				req.WebRequest.user.avatar = true;
			}
			await req.WebRequest.user.save();
			return res.send({ success: true, status: 200, details: null, error: null });
		} catch (e) {
			this.logger.error(e);
		}
	}

	async get(req, res, next) {
		let user = req.WebRequest?.user || (await this.Web.db.User());
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

		res.WebResponse.render("settings", { settings });
	}
}

module.exports = Settings;
