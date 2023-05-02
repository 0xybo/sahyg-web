const uid = require("uid-safe");

const Page = require("../lib/page");

class Signup extends Page {
	constructor(/** @type {import('../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.setGet(["/signup"], this.get.bind(this));
		this.setPost(["/signup"], this.post.bind(this));

		this.setGet(["/confirm_email"], this.confirm.bind(this));
	}
	async get(req, res, next) {
		if (req.WebRequest.userExists) {
			let redirect = req.query?.redirect || "/";
			if (redirect.includes("/login")) redirect = "/";
			return res.redirect(redirect);
		}
		res.WebResponse.render("signup");
	}
	async post(req, res, next) {
		try {
			if (
				!(
					/^[a-z0-9_]{3,10}$/.test(req.body.username) &&
					this.Web.utils.isEmail(req.body.email) &&
					this.Web.utils.isValidPassword(req.body.password)
				)
			) {
				res.WebResponse.error("EMAIL_PASSWORD_USERNAME_INVALID");
				return false;
			}
			if (
				(await this.Web.db.User({ username: req.body.username }, true)) ||
				this.Web.config.get("db.reservedUsername").includes(req.body.username)
			) {
				res.WebResponse.error("USERNAME_ALREADY_EXISTS");
				return false;
			}
			if (await this.Web.db.User({ email: req.body.email }, true)) {
				res.WebResponse.error("EMAIL_ALREADY_EXISTS");
				return false;
			}
			let userInfo = {
				username: req.body.username,
				email: req.body.email,
				password: req.body.password,
				loginHistory: [
					{
						date: new Date(Date.now()),
						ip: req.ip,
					},
				],
				allowedIps: [req.ip],
				locale: req.cookies?.locale || req.getLocale(),
			};
			if (req.body.firstname) userInfo.firstname = req.body.firstname;
			if (req.body.lastname) userInfo.lastname = req.body.lastname;

			let user = await this.Web.db.User(userInfo, { create: true });

			await user.save();

			let mail = await this.Web.db.Mail({
				user: user._id,
				type: "signup",
				target: user.email,
				locale: req.WebRequest.locale,
				subject: req.__("MAIL_ACCOUNT_CREATED_SUBJECT"),
				content: {
					type: "html",
					filename: "signup",
				},
				data: {
					confirm: await uid(64),
					confirmed: false,
				},
			});
			await mail.save();
			mail.send();

			req.session.user = user._id;
			res.WebResponse.send();
		} catch (e) {
			this.logger.error(e);
			res.WebResponse.error();
		}
	}
	async confirm(req, res, next) {
		let id = req.query.id;
		if (!id) return res.WebResponse.renderError("NOT_FOUND");

		let mail = await this.Web.db.Mail({ "data.confirm": id, "data.confirmed": false }, { create: false });

		if (!mail) return res.WebResponse.renderError("NOT_FOUND");

		let user = await this.Web.db.User({ _id: mail.user });

		if (!user) return res.WebResponse.renderError("NOT_FOUND");

		user.confirmed = true;
		user.group = (await this.Web.db.Group({ name: "USER" }))._id;
		mail.data = {
			...mail.data,
			confirmed: true,
		};
		await mail.save();
		await user.save();

		return res.WebResponse.render("confirm_email");
	}
}

module.exports = Signup;
