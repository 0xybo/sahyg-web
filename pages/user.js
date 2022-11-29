const Page = require("../lib/page");
const md = require("marked").marked;

class User extends Page {
	constructor(/** @type {import('../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.setGet(["/profile"], function (req, res, next) {
			res.redirect("/user/" + req.WebRequest.user.username);
		});
		this.setGet(["/user/:username"], this.get.bind(this));
	}

	async get(req, res, next) {
		let username = req.params.username;
		let target = await this.Web.db.User({ username });
		if (!target) return res.WebResponse.renderError("NOT_FOUND")
		let targetGroup = await target.getGroup();
        return res.WebResponse.render("user", {target, targetGroup, md})
	}
}

module.exports = User;
