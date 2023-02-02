const Page = require("../lib/page");

class Home extends Page {
	constructor(/** @type {import('../index.js')} */ Web) {
		super(Web);

		this.setGet(["/", "/home"], this.home.bind(this));
	}
	async home(
		/** @type {import('express').Request}*/ req,
		/** @type {import('express').Response}*/ res,
		/** @type {import('express').NextFunction}*/ next
	) {
		let apps = [];
		let configApps = this.Web.config.get("pages.home.apps");
		for (const app of configApps) {
			if (await req.WebRequest.user.checkPermissions(app.permissions)) apps.push(app);
		}
		res.WebResponse.render("home", { apps });
	}
}

module.exports = Home;
