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
	renderError(statusCode = 500) {
		let errorCode = null;
		if (typeof statusCode == "number")
			({ errorCode, statusCode } = this.Web.config.get("errors").find((e) => e.statusCode == statusCode)?.[0] || {
				errorCode: "SERVER_ERROR",
				statusCode: 500,
			});
		else
			({ errorCode, statusCode } = this.Web.config.get("errors").find((e) => e.errorCode == statusCode.toUpperCase()) || {
				errorCode: "SERVER_ERROR",
				statusCode: 500,
			});

		this.render("errors/" + errorCode.toLowerCase(), {}, statusCode);
	}
	error(statusCode = 500, { details, message } = {}) {
		let errorCode = null;
		if (typeof statusCode == "number")
			({ errorCode, statusCode } = this.Web.config.get("errors").find((e) => e.statusCode == statusCode)?.[0] || {
				errorCode: "SERVER_ERROR",
				statusCode: 500,
			});
		else
			({ errorCode, statusCode } = this.Web.config.get("errors").find((e) => e.errorCode == statusCode.toUpperCase()) || {
				errorCode: "SERVER_ERROR",
				statusCode: 500,
			});

		if (details) this.details = details;
		if (message) this.message = message;

		this.setStatus(errorCode, statusCode).send();
	}
	async render(name, options, status = 200) {
		this.res.status(status).render(name, {
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
	setStatus(statusName, statusCode) {
		this.statusName = statusName;
		this.statusCode = statusCode;
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
