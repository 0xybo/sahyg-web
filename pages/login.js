const Page = require("../lib/page");

class Login extends Page {
	constructor(/** @type {import('../index.js')} */ Web) {
		super(Web);

		this.setGet(["/login"], this.page.bind(this));
		this.setPost(["/login"], this.login.bind(this));
		this.setGet(["/logout"], this.logout.bind(this));
	}
	async page(
		/** @type {import('express').Request}*/ req,
		/** @type {import('express').Response}*/ res,
		/** @type {import('express').NextFunction}*/ next
	) {
		if (req.WebRequest.userExists) return res.redirect(req.query?.redirect || "/");
		res.WebResponse.render("login");
	}
	async login(
		/** @type {import('express').Request}*/ req,
		/** @type {import('express').Response}*/ res,
		/** @type {import('express').NextFunction}*/ next
	) {
		if (typeof req.body.login != "string" || typeof req.body.password != "string")
			return res.WebResponse.setStatus("NO_LOGIN_INFORMATION").send();
		if (req.WebRequest.userExists) return res.WebResponse.setStatus("ALREADY_LOGGED_IN", 400).send();

		let user;
		if (req.body.login.includes("@")) user = await this.Web.db.User({ email: req.body.login });
		else user = await this.Web.db.User({ username: req.body.login });

		if (!user) return res.WebResponse.setStatus("USER_NOT_FOUND").send();
		if (!user.enabled) return res.WebResponse.setStatus("DISABLED_ACCOUNT").send();
		if (!(await user.checkPassword(req.body.password))) return res.WebResponse.setStatus("INVALID_PASSWORD").send();

		// TODO 2 authentication
		req.session.user = user._id;

		user.loginHistory.push({
			date: new Date(Date.now()),
			ip: req.ip,
		});
		user.save();

		let mail = await this.Web.db.Mail({
			content: { type: "html", filename: "login" },
			target: user.email,
			subject: req.__("MAIL_LOGIN_TITLE"),
			locale: user.locale,
			context: {},
		});
		await mail.save();
		await mail.send();

		return res.WebResponse.setStatus("LOGGED_IN").setContent({ token: req.sessionID }).send();
	}
	async logout(
		/** @type {import('express').Request}*/ req,
		/** @type {import('express').Response}*/ res,
		/** @type {import('express').NextFunction}*/ next
	) {
		if (!req.WebRequest.userExists) return res.redirect(req.query.redirect || "/");
		req.session.destroy((err) => {
			if (!err) return res.redirect(req.query.redirect || "/");
			return res.redirect("/error");
		});
	}
}

module.exports = Login;
