const Page = require("../lib/page");
const fs = require("fs");

class Resources extends Page {
	constructor(/** @type {import('../index.js')} */ Web) {
		super(Web);
		this.Web = Web;

		this.setGet(["/resources/translate", "/resources/i18n"], this.i18n.bind(this));
		this.setGet(["/resources/avatar/:user"], this.avatar.bind(this));
		this.setGet(["/resources/user/:user"], this.user.bind(this));
	}
	async i18n(req, res) {
		res.send(this.Web.i18n.getCatalog(req.body.locale || req.param.locale || req.cookies?.locale || req.getLocale()));
		return true;
	}
	async avatar(req, res) {
		let username = req.params.user;
		if (!username) res.WebResponse.status(400).send();
		let user = await this.Web.db.User({ username }, true);
		if (!user || !user.avatar) return res.status(404).end();
		let file = fs.readdirSync(this.Web.config.get("paths.storage") + "/avatar").find((file) => file.includes(user._id));
		if (!file) return res.WebResponse.status(404).send();
		res.sendFile(file, {
			root: process.cwd() + "/" + this.Web.config.get("paths.storage") + "/avatar",
		});
	}
	async user(req, res) {
		let username = req.params.user;
		if (!username) return await res.WebResponse.error("MISSING_PARAMETER");
		let user = await this.Web.db.User({ username });
		if (!user) return res.WebResponse.error("NOT_FOUND");
		let group = await user.getGroup();
		return res.WebResponse.setContent({
			username: user.username,
			avatarUrl: user.avatar ? "/resources/avatar/" + user.username : null,
			certified: user.certified,
			group: {
				name: group.name,
			},
			...Object.fromEntries(user.shared.map((key) => [key, user[key]])),
		}).send();
	}
}

module.exports = Resources;
