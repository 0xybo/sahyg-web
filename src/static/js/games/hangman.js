SAHYG.Classes.Hangman = class Hangman {
	wordProperties = {};
	difficulty = "easy";
	$hangman = SAHYG.$0("#hangman");
	$usedLetters = SAHYG.$0("#word .used-letters");
	$hiddenWord = SAHYG.$0("#word .hidden-word");
	$keyboard = SAHYG.$0("#keyboard");
	$abandon = SAHYG.$0("#abandon");
	$newGame = SAHYG.$0("#new-game");
	$errors = SAHYG.$0("#hangman .errors .value");
	$totalErrors = SAHYG.$0("#hangman .errors .total");
	constructor() {
		this.$abandon.on("click", () => {
			if (this.$abandon.hasClass("disabled")) return;
			this.abandon();
		});
		this.$newGame.on("click", () => {
			if (this.$newGame.hasClass("disabled")) return;
			this.initGame(this);
		});
		this.$keyboard.children.on("click", ({ target }) => {
			if (target.hasClass("disabled")) return;
			this.letterClicked({ target });
		});

		this.init();
	}
	async init() {
		this.initGame();
	}
	async abandon() {
		let { word } = await SAHYG.Api.get("/hangman/word");
		this.$hiddenWord.children.forEach((hiddenLetter, i) => hiddenLetter.text(word[i]));
		this.$keyboard.children.addClass("disabled");
		this.$abandon.addClass("disabled");
		this.stage(10);
		SAHYG.Components.toast.Toast.info({ message: await SAHYG.translate("YOU_ABANDON") }).show();
	}
	async initGame() {
		this.$keyboard.children.forEach((key) => key.removeClass("disabled"));
		this.stage(0);
		this.$abandon.removeClass("disabled");
		this.$keyboard.children.removeClass("disabled");

		await this.getNewWord();
		this.$hiddenWord.children.remove();
		for (let i = 0; i < this.wordProperties.length; i++) {
			this.$hiddenWord.append(SAHYG.createElement("div", { class: "hidden-letter" }));
		}
	}
	async getNewWord() {
		this.wordProperties = await SAHYG.Api.get("/hangman/new_word/" + this.difficulty);
	}
	async letterClicked({ target }) {
		let letter = target.getAttribute("letter");

		let { positions, stage, gameOver } = await SAHYG.Api.get("/hangman/letter/" + letter);

		this.stage(stage);
		positions.forEach((pos) => this.$hiddenWord.children[pos]?.text(letter.toUpperCase()));
		target.addClass("disabled");

		if (gameOver == "win") {
			SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("YOU_WIN") }).show();
			this.$keyboard.children.addClass("disabled");
			this.$abandon.addClass("disabled");
		} else if (gameOver == "lose") {
			SAHYG.Components.toast.Toast.info({ message: await SAHYG.translate("YOU_LOSE") }).show();
			this.$keyboard.children.addClass("disabled");
			this.$abandon.addClass("disabled");
		}
	}
	stage(stage) {
		this.$errors.text(stage);
		if (stage == 0) return this.$hangman.setAttribute("stage", "");

		let stageArray = [];
		for (let i = 0; i <= (stage >= 10 ? 10 : stage < 1 ? 1 : stage); i++) {
			stageArray.push(i);
		}
		this.$hangman.setAttribute("stage", stageArray.join(" "));
	}
};

SAHYG.onload(() => (SAHYG.Instances.hangman = new SAHYG.Classes.Hangman()));
