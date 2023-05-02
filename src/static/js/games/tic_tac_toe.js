SAHYG.Classes.TicTacToe = class TicTacToe {
	constructor(element) {
		this.$appElement = element;
		this.$gridElement = element.$0(".grid");
		this.$currentPlayerElement = element.$0(".interactive-panel .current");
		this.$newGameButton = element.$0("#new-game");
		this.$editOpponentButton = element.$0("#edit-opponent");
		this.$changeOpponentSelect = element.$0("#change-opponent");
		this.$firstPlayerSelect = element.$0("#first-player");
		this.$historyBodyElement = SAHYG.$0(".history .body");
		this.games = [];
		this.onPlay = false;

		this.player0 = SAHYG.$0("header .account .username").innerText;
		this.player1 = null;
		this.opponent = "player";
		this.firstPlayer = "0";

		this.init();
	}

	async init() {
		if (!SAHYG.Utils.user.isConnected()) {
			if (localStorage.tic_tac_toe_history) {
				try {
					let history = JSON.parse(localStorage.tic_tac_toe_history);
					if (history instanceof Array) history.forEach(this.addHistoryEntry.bind(this));
				} catch (e) {
					SAHYG.createElement("sahyg-toast", { content: await SAHYG.translate("HISTORY_IMPORTATION_ERROR"), type: "error" }).show();
				}
			}
		}

		this.grid = Array(9).fill();
		this.$gridElement.children.forEach((cell, index) => {
			this.grid[~~(index / 3) * 3 + (index % 3)] = { element: cell, content: null, row: ~~(index / 3), column: index % 3 };
		});

		this.grid.forEach((cell) => cell.element.on("click", this.clickCell.bind(this, cell)));
		this.$newGameButton.on("click", this.reset.bind(this));
		this.$editOpponentButton.on("click", this.editOpponent.bind(this));
		this.$changeOpponentSelect.on("input", () => this.changeOpponent(this.$changeOpponentSelect.selected[0]));
		this.$firstPlayerSelect.on("input", () => this.changeFirstPlayer(this.$firstPlayerSelect.selected[0]));

		this.initGame();
	}
	async initGame() {
		if (!this.player0) this.player0 = (await SAHYG.translate("PLAYER")) + " 0";
		if (!this.player1) this.player1 = (await SAHYG.translate("PLAYER")) + " 1";
		this.currentPlayer = 0;
		this.moves = [];
		this.winner = undefined;
		this.updateInformations();

		this.grid.forEach((cell) => {
			cell.element.innerText = "";
			cell.element.setAttribute("data-player", "");
			cell.content = null;
		});

		this.$editOpponentButton.removeClass("disabled");

		this.$appElement.setAttribute("status", "playing");
		this.onPlay = true;

		if (this.firstPlayer == "0") this.currentPlayer = 0;
		else if (this.firstPlayer == "1") this.currentPlayer = 1;
		else this.currentPlayer = +(Math.random() > 0.5);
		if (this.opponent == "computer" && this.currentPlayer == 1) this.compute();
	}
	clickCell(cell, event) {
		console.log(this.onPlay, event.target.getAttribute("data-player"));
		if (!this.onPlay) return;
		let player = event.target.getAttribute("data-player");
		if (player === true || !player) {
			this.place(cell);
		}
		if (this.$gridElement.$(`[data-player="0"], [data-player="1"]`)) {
			this.$editOpponentButton.addClass("disabled");
		}
	}
	async reset() {
		this.onPlay = false;
		this.initGame();
		SAHYG.createElement("sahyg-toast", { content: await SAHYG.translate("NEW_GAME_STARTED") }).show();
	}
	updateInformations() {
		this.$currentPlayerElement.innerText = this.currentPlayer == 0 ? this.player0 : this.player1;
	}
	async checkWin() {
		let player;
		if (this.checkGrid(0)) player = this.player0;
		else if (this.checkGrid(1)) player = this.opponent == "computer" ? await SAHYG.translate("COMPUTER") : this.player1;

		if (player == undefined) {
			if (this.$gridElement.$(`[data-player="0"], [data-player="1"]`)?.length == 9) {
				SAHYG.createElement("sahyg-dialog", {
					title: await SAHYG.translate("INFORMATION"),
					content: await SAHYG.translate("GAME_DRAW", { player: player }),
				})
					.addButton({
						callback: () => {
							this.$appElement.setAttribute("status", "stoped");
							this.onPlay = false;
						},
						text: await SAHYG.translate("OK"),
						options: { fullColor: true },
					})
					.addButton({
						callback: () => {
							this.reset();
						},
						text: await SAHYG.translate("PLAY_AGAIN"),
					})
					.on("closed", () => {
						this.$appElement.setAttribute("status", "stoped");
						this.onPlay = false;
					})
					.show();
				this.winner = null;
			} else return false;
		} else {
			this.winner = player;
			this.$appElement.setAttribute("status", "pending");
			SAHYG.createElement("sahyg-dialog", {
				title: await SAHYG.translate("INFORMATION"),
				content: await SAHYG.translate("PLAYER_WIN", { player: player }),
			})
				.addButton({
					callback: () => {
						this.$appElement.setAttribute("status", "stoped");
						this.onPlay = false;
					},
					text: await SAHYG.translate("OK"),
					options: { fullColor: true },
				})
				.addButton({
					callback: async () => {
						this.reset();
					},
					text: await SAHYG.translate("PLAY_AGAIN"),
				})
				.on("closed", () => {
					this.$appElement.setAttribute("status", "stoped");
					this.onPlay = false;
				})
				.show();
		}
		if (document.documentElement.getAttribute("connected") == "") this.saveParty();
		else {
			let history;
			try {
				history = JSON.parse(localStorage.tic_tac_toe_history);
			} catch (e) {
				history = [];
			}
			history.push({
				moves: this.moves,
				player0: this.player0,
				player1: this.player1,
				winner: this.winner,
				opponent: this.opponent,
			});
			localStorage.tic_tac_toe_history = JSON.stringify(history.slice(-20));
		}

		await this.addHistoryEntry();

		return true;
	}
	async addHistoryEntry({ moves, player0, player1, winner, opponent } = {}) {
		if (!moves) moves = this.moves;
		if (!player0) player0 = this.player0;
		if (!player1) player1 = this.player1;
		if (!winner) winner = this.winner;
		if (!opponent) opponent = this.opponent;

		let row = SAHYG.createElement("sahyg-tictactoe-history-row", {
			moves: JSON.stringify(moves),
			player0,
			player1,
			opponent,
			winner,
		});

		if (!this.$historyBodyElement.children) this.$historyBodyElement.append(row);
		else this.$historyBodyElement.prepend(row);
	}
	checkGrid(player) {
		return (
			this.grid.filter((cell) => cell.row == 0).every((cell) => cell.content == player) ||
			this.grid.filter((cell) => cell.row == 1).every((cell) => cell.content == player) ||
			this.grid.filter((cell) => cell.row == 2).every((cell) => cell.content == player) ||
			this.grid.filter((cell) => cell.column == 0).every((cell) => cell.content == player) ||
			this.grid.filter((cell) => cell.column == 1).every((cell) => cell.content == player) ||
			this.grid.filter((cell) => cell.column == 2).every((cell) => cell.content == player) ||
			this.grid.filter((cell) => cell.row == cell.column).every((cell) => cell.content == player) ||
			this.grid.filter((cell) => cell.row + cell.column == 2).every((cell) => cell.content == player)
		);
	}
	async editOpponent() {
		let data = await SAHYG.createElement("sahyg-input-dialog", {
			inputs: [
				{
					id: "name",
					title: `${await SAHYG.translate("NAME")} (${await SAHYG.translate("MAX_LETTERS", { max: 15 })})`,
					options: { placeholder: await SAHYG.translate("NAME"), clearIcon: true, borderBottom: true },
					type: "text",
					defaultValue: this.player1,
				},
			],
		})
			.show()
			.toPromise();
		if (data) this.player1 = data.name?.substring(0, 15);
	}
	async saveParty() {
		SAHYG.Api.post("/tic_tac_toe", {
			moves: this.moves,
			opponent: this.opponent == "computer" ? await SAHYG.translate("COMPUTER") : this.player1,
			win: this.winner == null ? "null" : this.winner == this.player0,
		}).catch(console.error);
	}
	compute() {
		let wonMoves, opponentWonMoves;
		if ((wonMoves = this.wonMoves(this.currentPlayer)).length) {
			this.place(this.grid.find((cell) => cell.row == wonMoves[0][0] && cell.column == wonMoves[0][1]));
		} else if ((opponentWonMoves = this.wonMoves(Number(!Boolean(this.currentPlayer)))).length) {
			this.place(this.grid.find((cell) => cell.row == opponentWonMoves[0][0] && cell.column == opponentWonMoves[0][1]));
		} else {
			let possibleMoves = this.grid.filter((cell) => cell.content == null);
			this.place(possibleMoves[Math.abs(Math.round(Math.random() * possibleMoves.length - 1))]);
		}
	}
	async place(cell) {
		if (!cell) return;
		cell.element.setAttribute("data-player", this.currentPlayer);
		cell.content = this.currentPlayer;
		this.moves.push({
			row: cell.row,
			column: cell.column,
			player: this.currentPlayer == 0 ? this.player0 : this.opponent == "computer" ? await SAHYG.translate("COMPUTER") : this.player1,
		});
		this.currentPlayer = Number(!Boolean(this.currentPlayer));
		this.updateInformations();
		if (!(await this.checkWin()) && this.opponent == "computer" && this.currentPlayer == 1) this.compute();
	}
	wonMoves(player) {
		let moves = [];
		this.grid
			.filter((cell) => cell.content == player)
			.forEach((cell) => {
				if (
					this.grid.filter((_cell) => _cell.row == cell.row && _cell.content == player).length == 2 &&
					this.grid.filter((_cell) => _cell.row == cell.row && _cell.content == null).length == 1
				) {
					let c = this.grid.find((_cell) => _cell.row == cell.row && _cell.content == null);
					if (!moves.find((e) => e[0] == c.row && e[1] == c.column)) moves.push([c.row, c.column]);
				}
				if (
					this.grid.filter((_cell) => _cell.column == cell.column && _cell.content == player).length == 2 &&
					this.grid.filter((_cell) => _cell.column == cell.column && _cell.content == null).length == 1
				) {
					let c = this.grid.find((_cell) => _cell.column == cell.column && _cell.content == null);
					if (!moves.find((e) => e[0] == c.row && e[1] == c.column)) moves.push([c.row, c.column]);
				}
				if (
					this.grid.filter((_cell) => _cell.row == _cell.column && cell.row == cell.column && _cell.content == player).length == 2 &&
					this.grid.filter((_cell) => _cell.row == _cell.column && cell.row == cell.column && _cell.content == null).length == 1
				) {
					let c = this.grid.find((_cell) => _cell.row == _cell.column && cell.row == cell.column && _cell.content == null);
					if (!moves.find((e) => e[0] == c.row && e[1] == c.column)) moves.push([c.row, c.column]);
				}
				if (
					this.grid.filter((_cell) => _cell.row + _cell.column == 2 && cell.row + cell.column == 2 && _cell.content == player).length ==
						2 &&
					this.grid.filter((_cell) => _cell.row + _cell.column == 2 && cell.row + cell.column == 2 && _cell.content == null).length == 1
				) {
					let c = this.grid.find((_cell) => _cell.row + _cell.column == 2 && cell.row + cell.column == 2 && _cell.content == null);
					if (!moves.find((e) => e[0] == c.row && e[1] == c.column)) moves.push([c.row, c.column]);
				}
			});
		return moves;
	}
	changeOpponent(value) {
		this.opponent = value;
		this.reset();
	}
	changeFirstPlayer(value) {
		this.firstPlayer = value;
	}
	µClickHistoryStart({ target }) {
		if (target.hasClass("disabled")) return;
		let grid = target.closest(".cell.moves").$0(".grid");
		grid.getAttribute("data-move", "0");
		target.addClass("disabled");
		target.closest(".commands").$0(".previous").addClass("disabled");
		target.closest(".commands").$0(".next").removeClass("disabled");
		target.closest(".commands").$0(".end").removeClass("disabled");
	}
	µClickHistoryPrevious({ target }) {
		if (target.hasClass("disabled")) return;
		let grid = target.closest(".cell.moves").$0(".grid");
		let move = Number(grid.getAttribute("data-move"));
		if (move > 0) grid.getAttribute("data-move", move - 1);
		if (move <= grid.$0("[data-index]") - 1) {
			target.closest(".commands").$0(".next").removeClass("disabled");
			target.closest(".commands").$0(".end").removeClass("disabled");
		}
		if (move <= 1) {
			target.addClass("disabled");
			target.closest(".commands").$0(".start").addClass("disabled");
		} else target.removeClass("disabled");
	}
	µClickHistoryNext({ target }) {
		console.log(target);
		if (target.hasClass("disabled")) return;
		let grid = target.closest(".cell.moves").$0(".grid");
		let move = Number(grid.getAttribute("data-move"));
		if (move < grid.$0("[data-index]") - 1) grid.getAttribute("data-move", move + 1);
		if (move >= 0) {
			target.closest(".commands").$0(".previous").removeClass("disabled");
			target.closest(".commands").$0(".start").removeClass("disabled");
		}
		if (move >= grid.$0("[data-index]").length - 2) {
			target.addClass("disabled");
			target.closest(".commands").$0(".end").addClass("disabled");
		} else target.removeClass("disabled");
	}
	µClickHistoryEnd({ target }) {
		if (target.hasClass("disabled")) return;
		let grid = target.closest(".cell.moves").$0(".grid");
		grid.getAttribute("data-move", grid.$0("[data-index]") - 1);
		target.addClass("disabled");
		target.closest(".commands").$0(".next").addClass("disabled");
		target.closest(".commands").$0(".previous").removeClass("disabled");
		target.closest(".commands").$0(".start").removeClass("disabled");
	}
};
SAHYG.registerCustomElement(
	"tictactoe-history-row",
	class Row extends HTMLElement {
		async connectedCallback() {
			this.moves = JSON.parse(this.getAttribute("moves"));
			this.player0 = this.getAttribute("player0");
			this.player1 = this.getAttribute("player1");
			this.winner = this.getAttribute("winner");
			this.opponent = this.getAttribute("opponent");

			this.append(
				SAHYG.createElement("div", {
					class: "cell win " + (this.winner == null ? "draw" : this.winner == this.player0 ? "victory" : "defeat"),
				}),
				SAHYG.createElement(
					"div",
					{ class: "cell opponent" },
					this.opponent == "computer" ? await SAHYG.translate("COMPUTER") : this.player1
				),
				SAHYG.createElement(
					"div",
					{ class: "cell moves" },
					(this.$grid = SAHYG.createElement(
						"div",
						{ class: "grid", "data-move": 0 },
						...[
							[0, 0],
							[0, 1],
							[0, 2],
							[1, 0],
							[1, 1],
							[1, 2],
							[2, 0],
							[2, 1],
							[2, 2],
						].map(([row, column]) => {
							let index = this.moves.findIndex((cell) => cell.row == row && cell.column == column);
							let dataIndex = index == -1 ? null : index;
							let player = this.moves[index]?.player ? (this.player0 == this.moves[index]?.player ? 0 : 1) : null;
							return SAHYG.createElement("div", {
								class: "cell",
								"data-index": dataIndex,
								"data-player": player,
								"data-row": row,
								"data-column": column,
							});
						})
					)),
					(this.commands = SAHYG.createElement(
						"div",
						{ class: "commands" },
						(this.$start = SAHYG.createElement(
							"btn",
							{ class: "start disabled" },
							SAHYG.createElement("span", { class: "lafs" }, "\uf04a"),
							await SAHYG.translate("START")
						).on("click", this.µClickHistoryStart.bind(this))),
						(this.$previous = SAHYG.createElement(
							"btn",
							{ class: "previous disabled" },
							SAHYG.createElement("span", { class: "lafs" }, "\uf0d9"),
							await SAHYG.translate("PREVIOUS")
						).on("click", this.µClickHistoryPrevious.bind(this))),
						(this.$next = SAHYG.createElement(
							"btn",
							{ class: "next" },
							await SAHYG.translate("NEXT"),
							SAHYG.createElement("span", { class: "lafs" }, "\uf0da")
						).on("click", this.µClickHistoryNext.bind(this))),
						(this.$end = SAHYG.createElement(
							"btn",
							{ class: "end" },
							await SAHYG.translate("END"),
							SAHYG.createElement("span", { class: "lafs" }, "\uf04e")
						).on("click", this.µClickHistoryEnd.bind(this)))
					))
				)
			);
		}
		µClickHistoryStart() {
			if (this.$previous.hasClass("disabled")) return;

			this.$grid.setAttribute("data-move", "0");

			this.$start.addClass("disabled");
			this.$previous.addClass("disabled");
			this.$next.removeClass("disabled");
			this.$end.removeClass("disabled");
		}
		µClickHistoryPrevious() {
			if (this.$previous.hasClass("disabled")) return;

			let move = Number(this.$grid.getAttribute("data-move"));
			if (move > 0) this.$grid.setAttribute("data-move", move - 1);
			if (move <= this.$grid.$("[data-index]")?.length - 1) {
				this.$next.removeClass("disabled");
				this.$end.removeClass("disabled");
			}
			if (move <= 1) {
				this.$previous.addClass("disabled");
				this.$start.addClass("disabled");
			} else this.$previous.removeClass("disabled");
		}
		µClickHistoryNext() {
			if (this.$next.hasClass("disabled")) return;

			let move = Number(this.$grid.getAttribute("data-move"));
			if (move < this.$grid.$("[data-index]")?.length - 1) this.$grid.setAttribute("data-move", move + 1);
			if (move >= 0) {
				this.$previous.removeClass("disabled");
				this.$start.removeClass("disabled");
			}
			if (move >= this.$grid.$0("[data-index]")?.length - 2) {
				this.$next.addClass("disabled");
				this.$end.addClass("disabled");
			} else this.$next.removeClass("disabled");
		}
		µClickHistoryEnd() {
			if (this.$end.hasClass("disabled")) return;

			this.$grid.setAttribute("data-move", this.$grid.$("[data-index]")?.length - 1);
			this.$end.addClass("disabled");
			this.$next.addClass("disabled");
			this.$previous.removeClass("disabled");
			this.$start.removeClass("disabled");
		}
	}
);

SAHYG.onload(() => (SAHYG.Instances.TicTacToe = new SAHYG.Classes.TicTacToe(SAHYG.$0("app"))));
