$(function () {
	SAHYG.Classes.Hangman = class Hangman {
		wordProperties = {};
		difficulty = "easy";
		constructor() {
			this.$hangman = $("#hangman");
			this.$usedLetters = $("#word .used-letters");
			this.$hiddenWord = $("#word .hidden-word");
			this.$keyboard = $("#keyboard");
			this.$abandon = $("#abandon");
			this.$newGame = $("#new-game");
			SAHYG.on("click", "#keyboard .letter:not(.disabled)", this.letterClicked.bind(this));
			SAHYG.on("click", "#abandon:not(.disabled)", this.abandon.bind(this));
			SAHYG.on("click", "#new-game:not(.disabled)", this.initGame.bind(this));

			this.init();
		}
		async init() {
			this.initGame();
		}
		async abandon() {
			let { word } = await SAHYG.Api.get("/hangman/word");
			this.$hiddenWord.children().each((i, hiddenLetter) => $(hiddenLetter).text(word[i]));
			this.$keyboard.children().addClass("disabled");
			this.$abandon.addClass("disabled");
			this.stage(10);
			SAHYG.Components.toast.Toast.info({ message: await SAHYG.translate("YOU_ABANDON") }).show();
		}
		async initGame() {
			this.$keyboard.children().each((key) => $(key).removeClass("disabled"));
			this.stage(0);
			this.$abandon.removeClass("disabled");
			this.$keyboard.children().removeClass("disabled");

			await this.getNewWord();
			this.$hiddenWord.children().remove();
			for (let i = 0; i < this.wordProperties.length; i++) {
				this.$hiddenWord.append(SAHYG.createElement("div", { class: "hidden-letter" }));
			}
		}
		async getNewWord() {
			this.wordProperties = await SAHYG.Api.get("/hangman/new_word/" + this.difficulty);
		}
		async letterClicked({ target }) {
			let letter = $(target).attr("letter");

			let { positions, stage, gameOver } = await SAHYG.Api.get("/hangman/letter/" + letter);

			this.stage(stage);
			positions.forEach((pos) => $(this.$hiddenWord.children()[pos]).text(letter.toUpperCase()));
			$(target).addClass("disabled");

			if (gameOver == "win") {
				SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("YOU_WIN") }).show();
				this.$keyboard.children().addClass("disabled");
				this.$abandon.addClass("disabled");
			} else if (gameOver == "lose") {
				SAHYG.Components.toast.Toast.info({ message: await SAHYG.translate("YOU_LOSE") }).show();
				this.$keyboard.children().addClass("disabled");
				this.$abandon.addClass("disabled");
			}
		}
		stage(stage) {
			if (stage == 0) return this.$hangman.attr("stage", "");

			let stageArray = [];
			for (let i = 1; i <= (stage >= 10 ? 10 : stage < 1 ? 1 : stage); i++) {
				stageArray.push(i);
			}
			this.$hangman.attr("stage", stageArray.join(" "));
		}
	};
	SAHYG.Instances.hangman = new SAHYG.Classes.Hangman();
});
