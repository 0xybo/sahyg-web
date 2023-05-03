const nodemailer = require("nodemailer");
const pug = require("pug");

class Mail {
	constructor(Web) {
		this.Web = Web;
		this.logger = Web.loggerStore.new("Mails");
	}
	async init() {
		try {
			this.mailAuth = await this.Web.db.models.Gmail_OAuth2.findOne({ user: this.Web.config.get("env.GMAIL_ADDRESS") });
			this.transporter =
				this.mailAuth &&
				nodemailer.createTransport({
					host: "smtp.gmail.com",
					port: 465,
					transportMethod: "SMTP",
					secureConnection: true,
					secure: true,
					auth: {
						type: "OAuth2",
						user: this.mailAuth.user,
						clientId: this.mailAuth.clientId,
						clientSecret: this.mailAuth.clientSecret,
						refreshToken: this.mailAuth.refreshToken,
						expires: this.mailAuth.expires,
					},
				});
		} catch (e) {
			this.logger.error(e);
		}
		if (!this.transporter)
			this.logger.error("Mail transporter failed to initialize" + (!this.mailAuth ? ", enable to find authorization keys" : ""));

		return this;
	}
	send({ content, target, subject, locale }) {
		if (!this.transporter) this.logger.error("Mail transporter not initialized");

		if (!locale) locale = this.Web.config.get("i18n.defaultLocale");

		subject = subject || this.Web.config.get("mail.defaultSubject");
		if (subject.startsWith("i18n:")) subject = this.Web.i18n.__({ phrase: subject.substring(5), locale: locale || "en-GB" });

		return new Promise((resolve, reject) => {
			try {
				this.transporter.sendMail(
					{
						html: content,
						from: `SAHYG <${this.Web.config.get("env.GMAIL_ADDRESS")}>`,
						to: target,
						subject,
					},
					function () {
						this.logger.info(`Mail sent to ${target} with subject "${subject}"`);
						resolve();
					}.bind(this)
				);
			} catch (e) {
				this.logger.error(e);
				reject(e);
			}
		});
	}
	sendFile({ filename, target, subject, locale, mail }) {
		if (!locale) locale = this.Web.config.get("i18n.defaultLocale");

		return this.send({ content: this.renderHtml(filename, locale, mail), target, subject, locale });
	}
	renderHtml(filename, locale, mail) {
		if (!locale) locale = this.Web.config.get("i18n.defaultLocale");

		return pug.renderFile(this.Web.config.get("mail.paths.pug") + filename + ".pug", {
			Web: this.Web,
			i18n: (phrase) => this.Web.i18n.__({ phrase, locale }),
			locale,
			mail,
		});
	}
}

module.exports = Mail;
