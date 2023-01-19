const Page = require("../lib/page");
const fs = require("fs");

class Download extends Page {
	pathRegexp = /{{[^{}]+}}/gm;
	constructor(/** @type {import('../index.js')} */ Web) {
		super(Web);

		this.setGet("/download/:name", this.download.bind(this));
	}
	async download(req, res, next) {
		let name = req.params.name;

		let downloadConfig = await this.Web.db.Download({ name });

		if (!downloadConfig) return res.WebResponse.renderError("NOT_FOUND");

		/** @type {String} */
		let path = downloadConfig.file;
		let matchs = path.matchAll(this.pathRegexp);

		for (let match = matchs.next(); !match.done; match = matchs.next()) {
			path = path.replace(match.value[0], this.Web.config.get(["paths", match.value[0].match(/[^{}]+/)[0]]));
		}

		if (!fs.existsSync(path)) return res.WebResponse.renderError("NOT_FOUND");

		if (!req.WebRequest.user.checkPermissions(downloadConfig.permissions)) {
			if (req.WebRequest.userExists) return res.WebResponse.renderError("UNAUTHORIZED");
			else return res.redirect("/login?redirect=" + req.path);
		}

		return res.download(path, downloadConfig.filename || path.match(/[^/\\}]+$/gm)?.[0]);
	}
}

module.exports = Download;
