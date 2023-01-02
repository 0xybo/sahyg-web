const nodemailer = require("nodemailer");
const pug = require("pug");

class Mail {
	constructor(Web) {
		this.Web = Web;
	}
	async init() {
		this.transporter = nodemailer.createTransport({
			host: "smtp.gmail.com",
			port: 465,
			transportMethod: "SMTP",
			secureConnection: true,
			secure: true,
			auth: {
				user: this.Web.config.get("env.GMAIL_ADDRESS"),
				pass: this.Web.config.get("env.GMAIL_PASSWORD"),
			},
		});

		return this;
	}
	send({ content, target, subject, locale }) {
		if (!locale) locale = this.Web.config.get("i18n.defaultLocale");

		subject = subject || this.Web.config.get("mail.defaultSubject");
		if (subject.startsWith("i18n:")) subject = this.Web.i18n.__({ phrase: subject.substring(5), locale: locale || "en-GB" });

		return new Promise((resolve, reject) => {
			this.transporter.sendMail(
				{
					html: content,
					from: `SAHYG <${this.Web.config.get("env.GMAIL_ADDRESS")}>`,
					to: target,
					subject,
				},
				resolve
			);
		});
	}
	sendFile({ filename, target, subject, locale, context, mail }) {
		if (!locale) locale = this.Web.config.get("i18n.defaultLocale");

		return this.send({ content: this.renderHtml(filename, locale, context, mail), target, subject, locale });
	}
	renderHtml(filename, locale, context = {}, mail) {
		if (!locale) locale = this.Web.config.get("i18n.defaultLocale");

		return pug.renderFile(this.Web.config.get("mail.paths.pug") + filename + ".pug", {
			Web: this.Web,
			i18n: (phrase) => this.Web.i18n.__({ phrase, locale }),
			locale,
			...context,
			mail,
		});
	}
}

module.exports = Mail;
