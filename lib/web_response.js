class WebResponse {
	success = true;
	statusName = "OK";
	statusCode = 200;
	details;
	content;
	description;

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
		res.setHeader("Cache-Control", "no-store");
	}
	async asyncConstructor() {
		this.next();
	}
	/**
	 * @param {String} name
	 */
	renderError(name) {
		let { code } = this.Web.config.get(["status", name?.toUpperCase() || (name = "SERVER_ERROR")]);

		this.render("errors/" + name.toLowerCase(), {}, code);
	}
	error(name, { details, description } = {}) {
		if (details) this.details = details;
		if (description) this.description = description;

		this.setStatus(name).send();
	}
	async render(name, options) {
		this.res.render(
			name,
			{
				WebResponse: this,
				WebRequest: this.WebRequest,
				Web: this.Web,
				i18n: this.req.__,
				conditionalI18n: this.conditionalI18n.bind(this),
				...(await this.mainOptions()),
				...options,
			},
			function (err, html) {
				if (err) {
					this.Web.responseLogger.error(err);
					this.renderError();
				} else this.res.send(html);
			}.bind(this)
		);
	}
	async mainOptions() {
		let headerLinks = [];
		for (let link of this.Web.config.get("mainPage.headerLinks")) {
			if (link.type == "dropdown") {
				let dropdown = [];
				for (let linkDropdown of link.dropdown) {
					if (await this.WebRequest.user.checkPermissions(linkDropdown.permissions)) dropdown.push(linkDropdown);
				}
				if (dropdown.length)
					headerLinks.push({
						text: link.text,
						dropdown,
						type: "dropdown",
					});
			} else {
				if (await this.WebRequest.user.checkPermissions(link.permissions)) headerLinks.push(link);
			}
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
		let status = this.Web.config.get(["status", statusName.toUpperCase()]);
		if (!status) {
			statusName = "OK";
			status = {
				code: 200,
				description: "",
				success: true,
			};
		}
		this.statusName = statusName;
		this.statusCode = status.code;
		this.success = status.success;
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
		this.res.send({
			success: this.success,
			status: this.statusName,
			statusCode: this.statusCode,
			description: this.description,
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
