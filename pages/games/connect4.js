const Page = require("../../lib/page");

class Connect4 extends Page {
	constructor(/** @type {import('../../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.setGet(["/connect4", "/connect_four", "/connectfour", "/connect-four"], this.get.bind(this));
	}

	async get(req, res, next) {
		return res.WebResponse.render("games/connect4");
	}
}

module.exports = Connect4;
