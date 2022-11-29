const Page = require("../../lib/page");

class TicTacToe extends Page {
	constructor(/** @type {import('../../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.setGet(["/tic-tac-toe", "/tictactoe", "/tic_tac_toe"], this.get.bind(this));
		this.setPost(["/tic-tac-toe", "/tictactoe", "/tic_tac_toe"], this.post.bind(this));
	}

	async get(req, res, next) {
		return res.WebResponse.render("games/tic_tac_toe", req, res, next, {
			history: req.WebRequest.userExists ? await this.Web.db.TicTacToe({ user: req.WebRequest.user._id }, true, true) : null,
		});
	}

	async post(req, res, next) {
		if (!(req.bodyPolluted?.moves || req.body?.moves) || !req.body.opponent || !req.WebRequest.userExists || !req.body.win)
			return res.status(400).send();
		let user = req.WebRequest.user._id;
		let opponent = req.body.opponent.substring(0, 15);
		let moves = req.bodyPolluted?.moves || req.body?.moves;
		let win = req.body.win == "null" ? null : req.body.win == "true";
		if (req.body.opponent.startsWith("@"))
			opponent = (await this.Web.db.User({ username: opponent.substring(1) }, true)?._id) || opponent.substring(1);
		let game = await this.Web.db.TicTacToe({
			user,
			opponent,
			moves,
			win,
		});
		await game.save();
		res.status(200).send();
	}
}

module.exports = TicTacToe;
