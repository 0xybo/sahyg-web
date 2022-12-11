const Page = require("../../lib/page");

class Hangman extends Page {
	default_locale = "fr-FR";
	words = {};
	constructor(/** @type {import('../../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.setGet(["/hangman"], this.get.bind(this));
		this.setGet(["/hangman/new_word/:difficulty"], this.newWord.bind(this));
		this.setGet(["/hangman/letter/:letter"], this.letter.bind(this));
		this.setGet(["/hangman/word"], this.word.bind(this));
	}

	async get(req, res) {
		return res.WebResponse.render("games/hangman");
	}
	async newWord(req, res) {
		let locale = req.getLocale();
		locale = this.load(locale);

		let difficulty = req.params.difficulty || "random";
		let difficultyProperties =
			this.Web.config.get(["pages", "hangman", "difficulties", difficulty]) ||
			((difficulty = "random"), this.Web.config.get("pages.hangman.dificulties.random"));
		let words = this.words[locale].filter(
			(word) => word.length > difficultyProperties.wordLength[0] && word.length < difficultyProperties.wordLength[1]
		);
		let word = words[Math.round(Math.random() * (words.length - 1))];

		// Remove expired hangman session and hangman session with the same web session id
		await this.Web.db.Hangman({ $or: [{ session: req.sessionID }, { startedAt: { $lt: Date.now() - 3600000 } }] }, { remove: true });

		await this.Web.db.Hangman(
			{ session: req.sessionID, startedAt: new Date(), word, wordStatus: Array(word.length).fill("_"), difficulty },
			{ create: true }
		);

		res.WebResponse.setContent({ length: word.length }).send();
	}
	load(locale) {
		try {
			if (this.words[locale]) return this.words[locale];
			this.words[locale] = require(`../../resources/hangman/words.${locale}.json`);
			return locale;
		} catch {
			if (this.words[this.default_locale]) return this.words[this.default_locale];
			this.words[this.default_locale] = require(`../../resources/hangman/words.${this.default_locale}.json`);
			return this.default_locale;
		}
	}
	async letter(req, res) {
		let letter = req.params.letter.toUpperCase();
		let session = await this.Web.db.Hangman({ session: req.sessionID });
		if (!session) return res.WebResponse.setStatus("HANGMAN_GAME_NOT_FOUND").send();

		let lastPosition = session.word.indexOf(letter);
		let positions = [];
		while (lastPosition != -1) {
			positions.push(lastPosition);
			lastPosition = session.word.indexOf(letter, lastPosition + 1);
		}

		let difficultyProperties = this.Web.config.get(["pages", "hangman", "difficulties", session.difficulty]);
		let stage = Number(Object.entries(difficultyProperties.stages).find(([stage, stages]) => stages.includes(session.stage))?.[0] || 1);

		session.usedLetters.push(letter);
		if (!positions.length) {
			if (Object.keys(difficultyProperties.stages).length >= ++stage) session.stage = difficultyProperties.stages[stage].reverse()[0];
		}
		positions.forEach((pos) => (session.wordStatus[pos] = letter));
		await session.save();

		return res.WebResponse.setContent({
			positions,
			stage: session.stage,
			gameOver: session.stage == 10 ? "lose" : !session.wordStatus.includes("_") ? "win" : null,
		}).send();
	}
	async word(req, res) {
		let session = await this.Web.db.Hangman({ session: req.sessionID });
		if (!session) return res.WebResponse.setStatus("HANGMAN_GAME_NOT_FOUND").send();

		await this.Web.db.Hangman({ session: req.sessionID }, { remove: true });
		return res.WebResponse.setContent({ word: session.word }).send();
	}
}

module.exports = Hangman;
