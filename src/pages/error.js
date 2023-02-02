const Page = require("../lib/page");

class Error extends Page {
	constructor(/** @type {import('../index.js')} */ Web) {
		super(Web);

		this.setGet("*", this.error404.bind(this));
		this.setPost("*", this.post404.bind(this));
	}
	error404(req, res) {
		req.WebRequest.log({ message: "NOT_FOUND", success: false });
		if (/^\/[a-z0-9\.\-_\/]+\.[0-9a-z]+(#[^?#]*|\?[^?#]*)*$/gm.test(req.path)) return res.status(404).send();
		res.WebResponse.renderError("NOT_FOUND");
	}
	post404(req, res) {
		return res.status(404).send();
	}
}

module.exports = Error;
