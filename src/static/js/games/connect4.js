SAHYG.Classes.Connect4 = class Connect4 {
	$grid = SAHYG.$0("container .grid");
	$preview = SAHYG.$0("container .piece-preview");
	$new = SAHYG.$0("container .commands .new");
	$currentPlayer = SAHYG.$0("container .current-player .value");
	$firstPlayer = SAHYG.$0("container .first-player sahyg-select");
	$opponent = SAHYG.$0("container .opponent sahyg-select");
	$rules = SAHYG.$0("container .commands .rules");
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

		SAHYG.$("container .grid [column]").on("mouseenter", this.showPreview.bind(this));
		SAHYG.$("container .grid [column]").on("click", this.playerClick.bind(this));

		this.$grid.on("mouseleave", this.hidePreview.bind(this));
		this.$new.on("click", this.init.bind(this));
		this.$firstPlayer.on(
			"input",
			function () {
				this.firstplayer = this.$firstPlayer.selected[0];
				this.firstplayer = this.firstplayer == "0" ? 0 : this.firstplayer == "1" ? 1 : this.firstplayer == "random" ? "random" : "random";
				this.init();
				return false;
			}.bind(this)
		);
		this.$opponent.on(
			"input",
			function () {
				this.opponent = this.$opponent.selected[0];
				this.init();
				return false;
			}.bind(this)
		);

		this.$rules.on(
			"click",
			async function () {
				SAHYG.createElement("sahyg-dialog", {
					content: await SAHYG.translate("CONNECT4_RULES"),
					header: await SAHYG.translate("RULES"),
				}).show();
			}.bind(this)
		);

		this.init();
	}
	init() {
		this.board = Array(this.boardWidth)
			.fill(null)
			.map(() => Array(this.boardHeight).fill(null));

		SAHYG.$("container .grid [row]").removeClass("animated").setAttribute("content", false);
		this.currentPlayer = this.firstplayer == 0 || this.firstplayer == 1 ? this.firstplayer : Math.round(Math.random());
		this.$currentPlayer.innerText = this.player[this.currentPlayer];
		this.playing = true;
		this.canPlace = true;
		this.previewEnabled = true;
		return false;
	}
	showPreview({ target }, forced) {
		if (forced ? false : (this.currentPlayer == 1 && this.opponent == "computer") || !this.playing || !this.previewEnabled) return true;
		let column = target.closest("[column]").getAttribute("column");
		this.$preview.setAttribute("column", column).setAttribute("content", this.currentPlayer);
		return false;
	}
	hidePreview({ target }) {
		if (!this.$grid == target || !this.previewEnabled) return true;
		this.$preview.setAttribute("content", false);
		return false;
	}
	async playerClick({ target }) {
		if (!this.playing || (this.opponent == "computer" && this.currentPlayer == 1) || !this.canPlace) return true;
		let x = Number(target.closest("[column]").getAttribute("column"));
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
			SAHYG.createElement("sahyg-dialog", {
				content: await SAHYG.translate("GAME_DRAW"),
				header: await SAHYG.translate("GAME_DRAW"),
			}).show();
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
			SAHYG.createElement("sahyg-dialog", {
				content: await SAHYG.translate("CONNECT4_WIN", { player: this.player[this.currentPlayer] }),
				header: await SAHYG.translate("WIN"),
			}).show();
			winLines.forEach((winLine) => {
				winLine.forEach((cell) => SAHYG.$0(`container .grid [column="${cell.x}"] [row="${cell.y}"]`).addClass("animated"));
			});
			this.playing = false;
		} else {
			this.currentPlayer = Number(!this.currentPlayer);
			this.$currentPlayer.innerText = this.player[this.currentPlayer];
			this.$preview.setAttribute("content", this.currentPlayer);
		}
	}
	wait(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
	async pieceAnimation(x, y) {
		this.previewEnabled = false;
		let currentPlayer = Number(this.currentPlayer);
		this.$preview.setAttribute("content", currentPlayer).setAttribute("column", x);

		await this.wait(100);
		this.$preview
			.addClass("animated")
			.setStyle(
				"transform",
				`translateY(calc( var(--grid-border) + var(--piece-width) + 1rem + (var(--piece-width) + var(--grid-gap)) * ${y}))`
			);

		await this.wait(200);

		this.$preview.removeClass("animated").setStyle("transform", "");
		this.showPreview({ target: SAHYG.$0(`container .grid [column="${x}"]`) }, true);
		this.$grid.$0(`[column="${x}"] [row="${y}"]`).setAttribute("content", currentPlayer);

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
SAHYG.onload(() => (SAHYG.Instances.Connect4 = new SAHYG.Classes.Connect4()));
