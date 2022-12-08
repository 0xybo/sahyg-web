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
	isStatic = /^\/(css|js|img|fonts)\//g;
	requestType;
	permissions = [];

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

		this.cookies = req.cookies = this.Web.utils.parseCookies(req.headers.cookie);
		req.setLocale((this.locale = this.cookies.locale || req.getLocale() || "fr-FR"));
		this.theme = req.cookies.theme || "light";
		this.logger = Web.requestLogger;

		req.WebRequest = this;
	}
	async asyncConstructor() {
		if (this.isStatic.test(this.req.path)) {
			this.requestType = "static";
			this.permissions = this.Web.config.get(["static", decodeURI(this.req.path)]) || ["OWNER_GROUP"];
		} else if (!this.fetchPage()) return void (await this.notFound());

		if (!(await this.validToken())) return;

		this.next();
	}
	async notFound() {
		new WebResponse(this.Web, this.req, this.res, this.next);
		if (this.requestType == "page") await this.res.WebResponse.renderError("NOT_FOUND");
		else this.res.WebResponse.error("NOT_FOUND");
	}
	async notAuthorized() {
		new WebResponse(this.Web, this.req, this.res, this.next);
		if (this.requestType == "page") await this.res.WebResponse.renderError("UNAUTHORIZED");
		else this.res.WebResponse.error("UNAUTHORIZED");
	}
	fetchPage() {
		this.page = Object.values(this.Web.server.pages).find(({ config }) =>
			config.roots.find((root) => root.paths.some(this.checkPath.bind(null, this.req.path)))
		);
		if (this.page) {
			this.logger = this.page.page.logger;
			this.permissions = this.page.config.permissions;
			this.requestType = "page";
		}
		return this.page;
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
		return this.user.checkPermissions(this.permissions);
	}
	async validToken() {
		let user = this.req.session?.user;
		if (user) {
			this.userId = user;
			this.token = this.req.sessionID;

			if (!(await this.checkPermissions())) {
				this.log({ message: "UNAUTHORIZED", success: false });

				return await this.notAuthorized(), false;
			}

			this.log();
			return true;
		}

		if (await this.checkPermissions()) {
			this.log();
			return true;
		}

		this.log({ message: "UNAUTHORIZED", success: false });

		return await this.notAuthorized(), false;
	}
	log({ type = "debug", message = "", success = true } = {}) {
		if (!this.Web.config.get("logging.logAllRequests")) return;
		if (this.requestType == "static" && !this.Web.config.get("logging.logStaticRequests")) return;
		this.logger[type](
			[
				`${success ? "✔️" : "❌"} [${this.req.method}]${this.req.path} : ${message}`,
				`IP: ${this.req.ip}, userID: ${this.userId}, token: ${this.token}`,
			].join("\n")
		);
	}
}

module.exports = WebRequest;
