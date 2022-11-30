const { pathToRegexp } = require("path-to-regexp");
const WebResponse = require("./web_response");

class WebRequest {
	page = null;
	authenticated = false;
	userFetched = false;
	userExists = null;
	userId = null;
	group = null;
	user = null;
	groupFetched = false;
	token = null;

	constructor(
		/** @type {import('../index')}*/ Web,
		/** @type {import('express').Request}*/ req,
		/** @type {import('express').Response}*/ res,
		/** @type {import('express').NextFunction}*/ next
	) {
		this.Web = Web;
		this.req = req;
		this.res = res;
		this.next = next;

		req.cookies = this.cookies = this.Web.utils.parseCookies(req.headers.cookies);
		this.locale = req.getLocale();
		this.theme = req.cookies.theme || "light";
		req.WebRequest = this;
	}
	async asyncConstructor() {
		this.fetchPage();
		if (!this.page) return void (await this.notFound());

		if (!(await this.validToken())) return;

		this.next();
	}
	async notFound() {
		new WebResponse(this.Web, this.req, this.res, this.next);
		await this.res.WebResponse.renderError("NOT_FOUND");
	}
	async notAuthorized() {
		new WebResponse(this.Web, this.req, this.res, this.next);
		await this.res.WebResponse.renderError("UNAUTHORIZED");
	}
	fetchPage() {
		return (this.page = Object.values(this.Web.server.pages).find(({ config }) =>
			config.roots.find((root) => root.paths.some(this.checkPath.bind(null, this.req.path)))
		));
	}
	checkPath(path, pageLink) {
		return pageLink == "*" || pathToRegexp(pageLink).test(path);
	}
	async fetchUser() {
		if (this.userFetched) return false;
		let user;
		if (this.userId) user = await this.Web.db.User({ _id: this.userId });
		if (user) {
			this.user = user;
			this.userFetched = true;
			this.userExists = true;
			if (this.user.theme) this.theme = this.user.theme;
			if (this.user.locale) this.req.setLocale((this.locale = this.user.locale));
		} else {
			this.user = await this.Web.db.User();
			this.userFetched = true;
			this.userExists = false;
		}
		return true;
	}
	async fetchGroup() {
		if (this.groupFetched) return false;

		await this.fetchUser();

		let group = await this.Web.api.Group({ _id: this.user._id });
		if (group) {
			this.group = group;
			this.groupFetched = true;
		} else {
			this.group = await this.Web.db.Group({ name: "guest" });
			this.groupFetched = true;
		}
		return true;
	}
	async checkPermissions() {
		if (!this.userFetched) await this.fetchUser();
		return this.user.checkPermissions(this.page.config.permissions);
	}
	async validToken() {
		let user = this.req.session?.user;
		if (user) {
			this.userId = user;

			if (!(await this.checkPermissions())) {
				this.page.page.logger.debug(`Request rejected : UNAUTHORIZED (IP: ${this.req.ip})`);
				return await this.notAuthorized(), false;
			}

			this.page.page.logger.debug(`Request accepted (IP: ${this.req.ip}, userID: ${this.userId}, token: null, source: ${this.tokenSource})`);
			return true;
		}

		if (await this.checkPermissions()) {
			this.page.page.logger.debug(`Request accepted (IP: ${this.req.ip}, user: 'guest', token: null, source: null)`);
			return true;
		}

		this.page.page.logger.debug(`Request rejected : UNAUTHORIZED (IP: ${this.req.ip})`);
		return await this.notAuthorized(), false;
	}
}

module.exports = WebRequest;
