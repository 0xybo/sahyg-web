const Page = require("../../lib/page");

class GameOfLife extends Page {
	constructor(/** @type {import('../../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.setGet(["/gameoflife", "/game_of_life", "/game-of-life"], this.get.bind(this));
	}

	async get(req, res, next) {
		return res.WebResponse.render("games/game_of_life");
	}
}

module.exports = GameOfLife;
