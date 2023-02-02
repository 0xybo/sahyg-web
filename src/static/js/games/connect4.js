$(function () {
	SAHYG.Classes.Connect4 = class Connect4 {
		$grid = $("container .grid");
		$preview = $("container .piece-preview");
		$new = $("container .commands .new");
		$currentPlayer = $("container .current-player .value");
		$firstPlayer = $("container .first-player c-select");
		$opponent = $("container .opponent c-select");
		currentPlayer = 0;
		firstplayer = 0;
		opponent = "player";
		playing = true;
		previewEnabled = true;
		canPlace = true;
		victoryLineLength = 4;
		boardWidth = 7;
		boardHeight = 6;
		player = ["Player 0", "Player 1"];
		constructor() {
			if (SAHYG.Utils.user.isConnected()) this.player[0] = SAHYG.Utils.user.username();

			SAHYG.on("mouseenter", "container .grid [column]", this.showPreview.bind(this));
			SAHYG.on("mouseleave", this.$grid, this.hidePreview.bind(this));
			SAHYG.on("click", "container .grid [column]", this.playerClick.bind(this));

			SAHYG.on("click", this.$new, this.init.bind(this));
			SAHYG.on(
				"input",
				this.$firstPlayer,
				function () {
					this.firstplayer = this.$firstPlayer.attr("data-value");
					this.firstplayer = this.firstplayer == "0" ? 0 : this.firstplayer == "1" ? 1 : this.firstplayer == "random" ? "random" : "random";
					this.init();
					return false;
				}.bind(this)
			);
			SAHYG.on(
				"input",
				this.$opponent,
				function () {
					this.opponent = this.$opponent.attr("data-value");
					this.init();
					return false;
				}.bind(this)
			);

			SAHYG.on(
				"click",
				$("container .commands .rules"),
				async function () {
					new SAHYG.Components.popup.Popup({
						title: await SAHYG.translate("RULES"),
						content: await SAHYG.translate("CONNECT4_RULES"),
					}).show();
				}.bind(this)
			);

			this.init();
		}
		init() {
			this.board = Array(this.boardWidth)
				.fill(null)
				.map(() => Array(this.boardHeight).fill(null));

			$("container .grid [row]").removeClass("animated").attr("content", false);
			this.currentPlayer = this.firstplayer == 0 || this.firstplayer == 1 ? this.firstplayer : Math.round(Math.random());
			this.$currentPlayer.text(this.player[this.currentPlayer]);
			this.playing = true;
			this.canPlace = true;
			this.previewEnabled = true;
			return false;
		}
		showPreview({ target }, forced) {
			if (forced ? false : (this.currentPlayer == 1 && this.opponent == "computer") || !this.playing || !this.previewEnabled) return true;
			let column = $(target).closest("[column]").attr("column");
			this.$preview.attr("column", column).attr("content", this.currentPlayer);
			return false;
		}
		hidePreview({ target }) {
			if (!this.$grid.is(target) || !this.previewEnabled) return true;
			this.$preview.attr("content", false);
			return false;
		}
		async playerClick({ target }) {
			if (!this.playing || (this.opponent == "computer" && this.currentPlayer == 1) || !this.canPlace) return true;
			let x = Number($(target).closest("[column]").attr("column"));
			let y = this.getPiecePosition(x);

			if (y == -1) return true;
			this.canPlace = false;

			await this.placePiece(x, y);

			if (await this.checkDraw()) return false;

			if (this.playing && this.opponent == "computer") {
				await this.computer();

				if (await this.checkDraw()) return false;
			}
			this.canPlace = true;

			return false;
		}
		async checkDraw() {
			if (!this.board.flat().includes(null)) {
				new SAHYG.Components.popup.Popup()
					.title(await SAHYG.translate("GAME_DRAW"))
					.content(await SAHYG.translate("GAME_DRAW"))
					.show();
				this.previewEnabled = false;
				this.playing = false;
				this.canPlace = false;
				return true;
			}
			return false;
		}
		async placePiece(x, y) {
			if (!this.playing) return;
			this.board[x][y] = this.currentPlayer;

			await this.pieceAnimation(x, y);

			let winLines = this.checkWin();
			if (winLines) {
				new SAHYG.Components.popup.Popup()
					.title(await SAHYG.translate("WIN"))
					.content(await SAHYG.translate("CONNECT4_WIN", { player: this.player[this.currentPlayer] }))
					.show();
				winLines.forEach((winLine) => {
					winLine.forEach((cell) => $(`container .grid [column=${cell.x}] [row=${cell.y}]`).addClass("animated"));
				});
				this.playing = false;
			} else {
				this.currentPlayer = Number(!this.currentPlayer);
				this.$currentPlayer.text(this.player[this.currentPlayer]);
				this.$preview.attr("content", this.currentPlayer);
			}
		}
		wait(ms) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}
		async pieceAnimation(x, y) {
			this.previewEnabled = false;
			let currentPlayer = Number(this.currentPlayer);
			this.$preview.attr("content", currentPlayer).attr("column", x);
			
			await this.wait(100);

			this.$preview.addClass("animated").css({
				transform: `translateY(calc( var(--grid-border) + var(--piece-width) + 1rem + (var(--piece-width) + var(--grid-gap)) * ${y}))`,
			});

			await this.wait(200);

			this.$preview.removeClass("animated").css({ transform: "" });
			this.showPreview({ target: $("container .grid [column]:hover") }, true);
			this.$grid.find(`[column=${x}] [row=${y}]`).attr("content", currentPlayer);

			// await this.wait(100);

			this.previewEnabled = true;

			return;
		}
		getPiecePosition(x) {
			for (let y = 0; y < 6; y++) {
				if (this.board[x][y] !== null) return y - 1;
			}
			return 5;
		}
		checkWin() {
			let lines = this.getLines();
			let winLines = [];
			for (let line of lines) {
				if (this.checkLine(line)) winLines.push(line);
			}
			if (winLines.length) return winLines;
			return false;
		}
		getLines(board) {
			if (!board) board = this.board;
			let lines = [];
			for (let x = 0; x < this.boardWidth; x++) {
				for (let y = 0; y < this.boardHeight; y++) {
					let top = y - this.victoryLineLength >= 0,
						right = x + this.victoryLineLength < this.boardWidth,
						bottom = y + this.victoryLineLength < this.boardHeight,
						left = x - this.victoryLineLength >= 0;
					if (top) lines.push(this.getLine(x, y, 0, -1, board));
					if (top && right) lines.push(this.getLine(x, y, 1, -1, board));
					if (right) lines.push(this.getLine(x, y, 1, 0, board));
					if (right && bottom) lines.push(this.getLine(x, y, 1, 1, board));
					if (bottom) lines.push(this.getLine(x, y, 0, 1, board));
					if (bottom && left) lines.push(this.getLine(x, y, -1, 1, board));
					if (left) lines.push(this.getLine(x, y, -1, 0, board));
					if (left && top) lines.push(this.getLine(x, y, -1, -1, board));
				}
			}
			return lines;
		}
		getLine(x, y, x_, y_, board) {
			let line = [];
			for (let pos = 0; pos < this.victoryLineLength; pos++) {
				line.push({ x: x + x_ * pos, y: y + y_ * pos, player: board[x + x_ * pos][y + y_ * pos] });
			}
			return line;
		}
		checkLine(line, fixedPlayer) {
			let player = fixedPlayer || line[0].player;
			if (player === null) return false;
			return line.every((cell) => cell.player === player);
		}
		async computer() {
			if (this.currentPlayer != 1) return;
			for (let x = 0; x < this.boardWidth; x++) {
				let y = this.getPiecePosition(x);
				if (y == -1) continue;
				let board = JSON.parse(JSON.stringify(this.board));
				board[x][y] = 1;
				let lines = this.getLines(board);
				let winLine = lines.find((line) => this.checkLine(line, 1));
				if (winLine) {
					await this.placePiece(x, y);
					return;
				}
				board[x][y] = 0;
				lines = this.getLines(board);
				winLine = lines.find((line) => this.checkLine(line, 0));
				if (winLine) {
					await this.placePiece(x, y);
					return;
				}
			}
			let x = Math.round(Math.random() * (this.boardWidth - 1));
			let y = this.getPiecePosition(x);
			while (y == -1) {
				x = Math.round(Math.random() * (this.boardWidth - 1));
				y = this.getPiecePosition(x);
			}
			await this.placePiece(x, y);
			return;
		}
	};
	SAHYG.Instances.Connect4 = new SAHYG.Classes.Connect4();
});
