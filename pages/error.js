const Page = require("../lib/page");

class Error extends Page {
	constructor(/** @type {import('../index.js')} */ Web) {
		super(Web);

		this.setGet("*", this.error404.bind(this));
	}
	error404(
		/** @type {import('express').Request}*/ req,
		/** @type {import('express').Response}*/ res,
		/** @type {import('express').NextFunction}*/ next
	) {
		this.logger.debug(`Request rejected : 404_NOT_FOUND (IP: ${req.ip})`);
		res.WebResponse.renderError("NOT_FOUND");
	}
}

module.exports = Error;
