class WebResponse {
	success = true;
	statusName = "OK";
	statusCode = 200;
	details = null;
	message = "";
	content = null;
	constructor(
		/** @type {import('../index')}*/ Web,
		/** @type {import('express').Request}*/ req,
		/** @type {import('express').Response}*/ res,
		/** @type {import('express').NextFunction}*/ next
	) {
		this.Web = Web;
		this.req = req;
		this.WebRequest = req.WebRequest;
		this.res = res;
		this.next = next;

		this.theme = this.user?.theme || req.cookies?.theme || null;
		this.locale = req.getLocale();
		this.loggedUser = req.WebRequest.user.username;
		this.loggedSource = req.WebRequest.tokenSource;

		res.WebResponse = this;
	}
	async asyncConstructor() {
		this.next();
	}
	renderError(code = 500) {
		if (typeof code == "number") code = this.Web.config.get("errors").find((e) => e.statusCode == code)?.[0];
		else if (!this.Web.config.get("errors").find((e) => e.errorCode == code.toUpperCase())) code = null;
		if (!code) code = "SERVER_ERROR";

		this.render("errors/" + code.toLowerCase());
	}
	error(code = 500, { details, message }) {
		if (typeof code == "number") code = this.Web.config.get("errors").find((e) => e.statusCode == code)?.[0];
		else if (!this.Web.config.get("errors").find((e) => e.errorCode == code.toUpperCase())) code = null;
		if (!code) code = "SERVER_ERROR";

		if (details) this.details = details;
		if (message) this.message = message;

		this.setStatus(code).send();
	}
	async render(name, options) {
		this.res.render(name, {
			WebResponse: this,
			WebRequest: this.WebRequest,
			Web: this.Web,
			i18n: this.req.__,
			conditionalI18n: this.conditionalI18n.bind(this),
			...(await this.mainOptions()),
			...options,
		});
	}
	async mainOptions() {
		let headerLinks = [];
		for (let category of this.Web.config.get("mainPage.headerLinks")) {
			let dropdown = category.dropdown.copyWithin() || [];
			category.dropdown = [];
			for (let link of dropdown) {
				if (await this.WebRequest.user.checkPermissions(link.permissions)) category.dropdown.push(link);
			}
			if (category.dropdown.length) headerLinks.push(category);
		}

		let accountMenu = [];
		for (let link of this.Web.config.get("mainPage.accountMenu")) {
			if (await this.WebRequest.user.checkPermissions(link.permissions)) accountMenu.push(link);
		}

		return { headerLinks, accountMenu };
	}
	conditionalI18n(txt) {
		return txt?.startsWith("i18n:") ? this.res.__(txt.substring(5)) : txt;
	}
	setStatus(statusName) {
		this.status = statusName;
		return this;
	}
	setContent(content) {
		this.content = content;
		return this;
	}
	setDetails(details) {
		this.details = details;
		return this;
	}
	setDetail(detailName, detailValue) {
		this.details = this.details || {};
		this.details[detailName] = detailValue;
		return this;
	}
	send() {
		this.res.status(this.statusCode).send({
			success: this.success,
			status: this.statusName,
			statusCode: this.statusCode,
			message: this.message,
			details: this.details,
			content: this.content,
			loggedWith: {
				name: this.loggedUser,
				source: this.loggedSource || undefined,
				token: this.WebRequest.token,
			},
		});
	}
}

module.exports = WebResponse;
