class Page {
	constructor(/** @type {import('../index.js')} */ Web) {
		this.Web = Web;
		this.express = Web.server.express;

		this.logger = this.Web.loggerStore.new("Page:" + this.constructor.name);
	}
	setGet(path, ...callback) {
		if (!(path instanceof Array)) path = [path];

		let roots = this.Web.config.get(["pages", this.constructor.name.toLocaleLowerCase(), "roots"]) || [];
		path = path.filter((p) => roots.find(root => root.paths.includes(p) && root.type == "GET" && root.enabled) || (this.logger.warn(`Path GET:${p} is disabled`), false));

		callback = callback.map((cb) => {
			return function (req, res, next, ...args) {
				try {
					cb(req, res, next, ...args);
				} catch (e) {
					this.logger.error(e);
					return res.WebResponse.renderError("SERVER_ERROR"); 
				}
			}.bind(this);
		});

		if (path.length) this.express.get(path, ...callback);
	}
	setPost(path, ...callback) {
		if (!(path instanceof Array)) path = [path];

		let roots = this.Web.config.get(["pages", this.constructor.name.toLocaleLowerCase(), "roots"]) || [];
		path = path.filter((p) => roots.find(root => root.paths.includes(p) && root.type == "POST" && root.enabled) || (this.logger.warn(`Path POST:${p} is disabled`), false));

		callback = callback.map((cb) => {
			return function (req, res, next, ...args) {
				try {
					cb(req, res, next, ...args);
				} catch (e) {
					this.logger.error(e);
					return res.WebResponse.error("SERVER_ERROR"); // TODO POST not GET
				}
			}.bind(this);
		});

		if (path.length) this.express.post(path, ...callback);
	}
}

module.exports = Page;
