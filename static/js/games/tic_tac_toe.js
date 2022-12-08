$(() => {
	SAHYG.Classes.TicTacToe = class TicTacToe {
		constructor(element) {
			this.appElement = element;
			this.gridElement = element.find(".grid");
			this.currentPlayerElement = element.find(".interactive-panel .current");
			this.newGameButton = element.find("#new-game");
			this.editOpponentButton = element.find("#edit-opponent");
			this.changeOpponentSelect = element.find("#change-opponent");
			this.firstPlayerSelect = element.find("#first-player");
			this.historyBodyElement = $(".history .body");
			this.games = [];
			this.onPlay = false;

			this.player0 = $("header .account .username").html();
			this.player1 = null;
			this.opponent = "player";
			this.firstPlayer = "0";

			SAHYG.on("click", ".history .body .row .cell.moves .commands .previous", function (event) {
				let btn = $(this);
				let grid = btn.closest(".cell.moves").children(".grid");
				let move = Number(grid.attr("data-move"));
				if (move > 0) grid.attr("data-move", move - 1);
				if (move <= grid.children("[data-index]").length - 1) {
					btn.closest(".commands").children(".next").removeClass("disabled");
					btn.closest(".commands").children(".end").removeClass("disabled");
				}
				if (move <= 1) {
					btn.addClass("disabled");
					btn.closest(".commands").children(".start").addClass("disabled");
				} else btn.removeClass("disabled");
			});
			SAHYG.on("click", ".history .body .row .cell.moves .commands .next", function (event) {
				let btn = $(this);
				let grid = btn.closest(".cell.moves").children(".grid");
				let move = Number(grid.attr("data-move"));
				if (move < grid.children("[data-index]").length - 1) grid.attr("data-move", move + 1);
				if (move >= 0) {
					btn.closest(".commands").children(".previous").removeClass("disabled");
					btn.closest(".commands").children(".start").removeClass("disabled");
				}
				if (move >= grid.children("[data-index]").length - 2) {
					btn.addClass("disabled");
					btn.closest(".commands").children(".end").addClass("disabled");
				} else btn.removeClass("disabled");
			});
			SAHYG.on("click", ".history .body .row .cell.moves .commands .start", function (event) {
				let btn = $(this);
				let grid = btn.closest(".cell.moves").children(".grid");
				grid.attr("data-move", "0");
				btn.addClass("disabled");
				btn.closest(".commands").children(".previous").addClass("disabled");
				btn.closest(".commands").children(".next").removeClass("disabled");
				btn.closest(".commands").children(".end").removeClass("disabled");
			});
			SAHYG.on("click", ".history .body .row .cell.moves .commands .end", function (event) {
				let btn = $(this);
				let grid = btn.closest(".cell.moves").children(".grid");
				grid.attr("data-move", grid.children("[data-index]").length - 1);
				btn.addClass("disabled");
				btn.closest(".commands").children(".next").addClass("disabled");
				btn.closest(".commands").children(".previous").removeClass("disabled");
				btn.closest(".commands").children(".start").removeClass("disabled");
			});

			this.init();
		}

		async init() {
			if (!SAHYG.Utils.user.isConnected()) {
				if (localStorage.tic_tac_toe_history) {
					try {
						let history = JSON.parse(localStorage.tic_tac_toe_history);
						if (history instanceof Array) history.forEach(this.addHistoryEntry.bind(this));
					} catch (e) {
						SAHYG.Components.toast.Toast.warning({ message: await SAHYG.translate("HISTORY_IMPORTATION_ERROR") }).show();
					}
				}
			}

			this.grid = Array(9).fill();
			this.gridElement.children().each((index, cell) => {
				this.grid[~~(index / 3) * 3 + (index % 3)] = { element: $(cell), content: null, row: ~~(index / 3), column: index % 3 };
			});

			this.grid.forEach((cell) => SAHYG.on("click", cell.element, this.clickCell.bind(this, cell)));
			SAHYG.on("click", this.newGameButton, this.reset.bind(this));
			SAHYG.on("click", this.editOpponentButton, this.editOpponent.bind(this));
			SAHYG.on("input", this.changeOpponentSelect, this.changeOpponent.bind(this));
			SAHYG.on("input", this.firstPlayerSelect, this.changeFirstPlayer.bind(this));

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
				cell.element.text("");
				cell.element.attr("data-player", "");
				cell.content = null;
			});

			this.editOpponentButton.removeClass("disabled");

			this.appElement.attr("status", "playing");
			this.onPlay = true;

			if (this.firstPlayer == "0") this.currentPlayer = 0;
			else if (this.firstPlayer == "1") this.currentPlayer = 1;
			else this.currentPlayer = +(Math.random() > 0.5);
			if (this.opponent == "computer" && this.currentPlayer == 1) this.compute();
		}
		clickCell(cell, event) {
			if (!this.onPlay) return;
			let elem = $(event.target);
			if (!elem.attr("data-player")) {
				this.place(cell);
			}
			if (this.gridElement.children("[data-player=0], [data-player=1]").length > 0) {
				this.editOpponentButton.addClass("disabled").off("click");
			}
		}
		async reset() {
			this.onPlay = false;
			this.initGame();
			SAHYG.Components.toast.Toast.info({ message: await SAHYG.translate("NEW_GAME_STARTED") }).show();
		}
		updateInformations() {
			this.currentPlayerElement.text(this.currentPlayer == 0 ? this.player0 : this.player1);
		}
		async checkWin() {
			let player;
			if (this.checkGrid(0)) player = this.player0;
			else if (this.checkGrid(1)) player = this.opponent == "computer" ? await SAHYG.translate("COMPUTER") : this.player1;
			if (player == undefined) {
				if (this.gridElement.children("[data-player=0], [data-player=1]").length == 9) {
					new SAHYG.Components.popup.Popup()
						.title(await SAHYG.translate("INFORMATION"))
						.content(await SAHYG.translate("GAME_DRAW", { player: player }))
						.button("reset", {
							callback: (popup, event) => {
								popup.close();
								this.reset();
							},
							text: await SAHYG.translate("PLAY_AGAIN"),
						})
						.button("ok", {
							callback: (popup, event) => {
								popup.close();
								this.appElement.attr("status", "stoped");
								this.onPlay = false;
							},
							text: await SAHYG.translate("OK"),
							style: "fullColor",
						})
						.closed((popup, event) => {
							this.appElement.attr("status", "stoped");
							this.onPlay = false;
						})
						.show();
					this.winner = null;
				} else return false;
			} else {
				this.winner = player;
				this.appElement.attr("status", "pending");
				new SAHYG.Components.popup.Popup()
					.title(await SAHYG.translate("INFORMATION"))
					.content(await SAHYG.translate("PLAYER_WIN", { player: player }))
					.button("reset", {
						callback: async (popup, event) => {
							await popup.close();
							this.reset();
						},
						text: await SAHYG.translate("PLAY_AGAIN"),
					})
					.button("ok", {
						callback: (popup, event) => {
							popup.close();
							this.appElement.attr("status", "stoped");
							this.onPlay = false;
						},
						text: await SAHYG.translate("OK"),
						style: "fullColor",
					})
					.closed((popup, event) => {
						this.appElement.attr("status", "stoped");
						this.onPlay = false;
					})
					.show();
			}
			if ($("html").attr("connected") == "") this.saveParty();
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

			let row = SAHYG.createElement(
				"div",
				{ class: "row" },
				SAHYG.createElement("div", {
					class: "cell win " + (winner == null ? "draw" : winner == player0 ? "victory" : "defeat"),
				}),
				SAHYG.createElement("div", { class: "cell opponent" }, opponent == "computer" ? await SAHYG.translate("COMPUTER") : player1),
				SAHYG.createElement(
					"div",
					{ class: "cell moves" },
					SAHYG.createElement(
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
							let index = moves.findIndex((cell) => cell.row == row && cell.column == column);
							let dataIndex = index == -1 ? null : index;
							let player = moves[index]?.player ? (player0 == moves[index]?.player ? 0 : 1) : null;
							return SAHYG.createElement("div", {
								class: "cell",
								"data-index": dataIndex,
								"data-player": player,
								"data-row": row,
								"data-column": column,
							});
						})
					),
					SAHYG.createElement(
						"div",
						{ class: "commands" },
						SAHYG.createElement(
							"btn",
							{ class: "start disabled" },
							SAHYG.createElement("span", { class: "lafs" }, "&#xf04a;"),
							await SAHYG.translate("START")
						),
						SAHYG.createElement(
							"btn",
							{ class: "previous disabled" },
							SAHYG.createElement("span", { class: "lafs" }, "&#xf0d9;"),
							await SAHYG.translate("PREVIOUS")
						),
						SAHYG.createElement(
							"btn",
							{ class: "next" },
							await SAHYG.translate("NEXT"),
							SAHYG.createElement("span", { class: "lafs" }, "&#xf0da;")
						),
						SAHYG.createElement(
							"btn",
							{ class: "end" },
							await SAHYG.translate("END"),
							SAHYG.createElement("span", { class: "lafs" }, "&#xf04e;")
						)
					)
				)
			);
			if (this.historyBodyElement.children().length == 0) this.historyBodyElement.append(row);
			else row.insertBefore(this.historyBodyElement.children().first());
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
			SAHYG.Components.popup.Popup.input(await SAHYG.translate("EDIT_OPPONENT"), [
				{
					name: "name",
					label: `${await SAHYG.translate("NAME")} (${await SAHYG.translate("MAX_LETTERS", { max: 15 })})`,
					placeholder: await SAHYG.translate("NAME"),
					type: "text",
					defaultValue: this.player1,
				},
			]).then((data) => {
				if (data) this.player1 = data.name?.substring(0, 15);
			});
		}
		async saveParty() {
			$.post("/tic_tac_toe", {
				moves: this.moves,
				opponent: this.opponent == "computer" ? await SAHYG.translate("COMPUTER") : this.player1,
				win: this.winner == null ? "null" : this.winner == this.player0,
			});
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
			cell.element.attr("data-player", this.currentPlayer);
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
		changeOpponent(event, value) {
			this.opponent = value;
			this.reset();
		}
		changeFirstPlayer(event, value) {
			this.firstPlayer = value;
		}
	};
	SAHYG.Instances.TicTacToe = new SAHYG.Classes.TicTacToe($("app"));
});
