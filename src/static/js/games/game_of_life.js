SAHYG.Classes.GameOfLife = class GameOfLife {
	$canvasContainer = SAHYG.$0("container .canvas");
	$$canvasContainer = SAHYG.$0("container .canvas");
	$debug = SAHYG.$0("container .debug");
	$columnCountValue = SAHYG.$0("container .column-count .value");
	$columnCount = SAHYG.$0("container .column-count input");
	$speedValue = SAHYG.$0("container .speed .value span");
	$speed = SAHYG.$0("container .speed input");
	$resume = SAHYG.$0("container .resume");
	$pause = SAHYG.$0("container .pause");
	$next = SAHYG.$0("container .next");
	$share = SAHYG.$0("container .share");
	$clear = SAHYG.$0("container .clear");
	$rules = SAHYG.$0("container .rules");
	$generation = SAHYG.$0("container .generation .value");
	speed = 50;
	minInterval = 10;
	maxInterval = 1000;
	columnCount = 10;
	generation = 0;
	cells = null;
	debug = SAHYG.Constants.environment == "development";
	interval = null;
	constructor() {
		let params = SAHYG.Utils.url.getParams();

		if (params.board) {
			let decodedBoard = this.decodeBoard(params.board);
			this.cells = decodedBoard;
			if (!this.cells) {
				this.updateMatrix(this);
				SAHYG.Utils.url.removeLocationParam("board");
			}
			this.columnCount = this.cells.length;
			this.$columnCountValue.text(this.columnCount);
			this.$columnCount.setAttribute("value", this.columnCount);
		} else {
			let storedBoard = localStorage.getItem("game_of_life_board");
			if (storedBoard) {
				this.cells = JSON.parse(storedBoard);
				this.columnCount = this.cells.length;
				this.$columnCountValue.text(this.columnCount);
				this.$columnCount.setAttribute("value", this.columnCount);
			} else if (params.columns) {
				let columnCount = Number(params.columns);
				if (columnCount < 5) columnCount = 5;
				else if (columnCount > 100) columnCount = 100;
				this.columnCount = columnCount;
				this.$columnCountValue.text(this.columnCount);
				this.$columnCount.setAttribute("value", this.columnCount);
			}
		}

		if (params.speed) {
			let speed = Number(params.speed);
			if (speed >= 1 && speed <= 100) this.speed = speed;
			this.$speedValue.innerText = speed;
			this.$speed.setAttribute("value", speed);
		}

		// Add class GameOfLifeCanvas to custom element as canvas element
		customElements.define("gameoflife-canvas", SAHYG.Classes.GameOfLifeCanvas, { extends: "canvas" });

		/** @type {SAHYG.Classes.GameOfLifeCanvas} */
		this.$canvas = document.createElement("canvas", { is: "gameoflife-canvas" });
		this.$canvas.init(this);
		this.$canvasContainer.append(this.$canvas);

		this.$resume.on("click", () => {
			if (this.$resume.hasClass("disabled")) return;
			this.resume();
		});
		this.$next.on("click", () => {
			if (this.$next.hasClass("disabled")) return;
			this.next();
		});
		this.$pause.on("click", () => {
			if (this.$pause.hasClass("disabled")) return;
			this.pause();
		});
		this.$clear.on("click", () => {
			if (this.$clear.hasClass("disabled")) return;
			this.clear();
		});
		this.$share.on("click", () => {
			if (this.$share.hasClass("disabled")) return;
			this.share();
		});
		this.$rules.on("click", async () => {
			SAHYG.createElement("sahyg-dialog", {
				content: await SAHYG.translate("GAME_OF_LIFE_RULES"),
				title: await SAHYG.translate("RULES"),
			}).show();
		});
		this.$columnCount.on("input", (event) => {
			this.columnCount = Number(event.target.value);
			this.$columnCountValue.text(this.columnCount);
			this.$canvas.updateWidth(true);
			this.updateBoard();
		});
		this.$columnCount.on("change", () => SAHYG.Utils.url.setLocationParam("columns", this.columnCount));
		this.$speed.on("input", (event) => {
			this.speed = Number(event.target.value);
			this.$speedValue.text(this.speed);
		});
		this.$speed.on("change", () => SAHYG.Utils.url.setLocationParam("speed", this.speed));
	}
	share() {
		let url = SAHYG.Utils.url.setParams({
			speed: this.speed,
			cell_width: this.cellWidth(),
			board: this.encodeBoard(this.cells),
		});
		history.pushState({}, "", url);
		navigator.clipboard.writeText(url).then(async () => {
			SAHYG.createElement("sahyg-toast", { content: await SAHYG.translate("COPIED"), show: true, type: "ok" });
		});
	}
	encodeBoard(cells) {
		return cells
			.reduce((previousColumn, currentColumn, indexColumn) => {
				let column = currentColumn
					.reduce((previousCell, currentCell, indexCell) => {
						if (indexCell == 0) return ["1*" + currentCell];
						let [quantity, age] = previousCell.pop().split("*");
						if (Number(age) == currentCell) return previousCell.concat(`${Number(quantity) + 1}*${age}`);
						return previousCell.concat(`${quantity}*${age}`, `1*${currentCell}`);
					}, [])
					.join();

				if (indexColumn == 0) return [`1$${column}`];

				let [qte, previous] = previousColumn.pop().split("$");

				if (column == previous) return previousColumn.concat(`${Number(qte) + 1}$${previous}`);
				return previousColumn.concat(`${qte}$${previous}`, `1$${column}`);
			}, [])
			.join("|");
	}
	decodeBoard(string) {
		let columns = string.split("|");
		if (!columns) throw new Error("Invalid encoded board");
		let cells = columns.reduce((previousColumns, currentColumn) => {
			let [quantityColumn, column] = currentColumn.split("$");
			return previousColumns.concat(
				Array.from({ length: Number(quantityColumn) }, () =>
					column.split(",").reduce((previousCells, currentCell) => {
						let [quantityCell, cell] = currentCell.split("*");
						return previousCells.concat(...Array(Number(quantityCell)).fill(Number(cell)));
					}, [])
				)
			);
		}, []);
		if (!cells.every((column) => column.length === cells.length && column.every((cell) => cell >= 0 && cell <= 1))) {
			(async () =>
				SAHYG.createElement("sahyg-toast", {
					message: await SAHYG.translate("GAME_OF_LIFE_INVALID_ENCODED_BOARD"),
					type: "danger",
					show: true,
				}))();
			return this.cells;
		}
		return cells;
	}
	clear() {
		this.cells = null;
		this.$canvas.updateWidth(true);
		this.$canvas.renderGrid();
		localStorage.removeItem("game_of_life_board");
		SAHYG.Utils.url.removeLocationParam("board");
	}
	pause() {
		this.clearInterval();
		this.save();
	}
	next() {
		if (this.interval) return;
		this.step();
		this.save();
	}
	resume() {
		this.setInterval();
	}
	setInterval() {
		if (this.running) return;

		this.running = true;
		(function loop() {
			setTimeout(() => {
				this.step();
				if (this.running) loop.call(this);
			}, (this.maxInterval - this.minInterval) * ((100 - this.speed + 1) / 100));
		}.bind(this)());

		this.$resume.addClass("disabled");
		this.$pause.removeClass("disabled");
		this.$next.addClass("disabled");
		this.$share.addClass("disabled");
	}
	clearInterval() {
		if (!this.running) return;
		this.running = false;
		this.$pause.addClass("disabled");
		this.$resume.removeClass("disabled");
		this.$next.removeClass("disabled");
		this.$share.removeClass("disabled");
	}
	updateMatrix(clear = false) {
		this.cells = Array(this.columnCount)
			.fill(null)
			.map((val, x) =>
				Array(this.columnCount)
					.fill(null)
					.map((val, y) => (clear ? 0 : this.cells?.[x]?.[y] || 0))
			);

		this.generation = 0;
		this.updateGeneration();
	}
	updatePosition(e) {
		if (!this.debug) return;
		let rect = this.$canvas.getBoundingClientRect();
		let x = e.clientX - rect.left,
			y = e.clientY - rect.top;
		let realX = (x / this.$canvas.width) * this.$canvas.width,
			realY = (y / this.$canvas.height) * this.$canvas.height;
		let cellX = ~~(realX / this.cellWidth()),
			cellY = ~~(realY / this.cellWidth());
		this.$debug.innerHTML = [
			`clientX: ${x.toFixed(0)} / canvasX: ${realX.toFixed(0)}`,
			`clientY: ${y.toFixed(0)} / canvasY: ${realY.toFixed(0)}`,
			`cell: ${cellX}:${cellY}`,
		].join("</br>");
	}
	placeCell(e) {
		let rect = this.$canvas.getBoundingClientRect();
		let x = e.clientX - rect.left,
			y = e.clientY - rect.top;
		let { cell, x: cellX, y: cellY } = this.getCell(x, y);
		if (cell == 0) cell = 1;
		else cell = 0;
		this.cells[cellX][cellY] = cell;

		this.updateBoard();
		this.save();
	}
	getCell(x, y) {
		let realX = (x / this.$canvas.clientWidth) * this.$canvas.width,
			realY = (y / this.$canvas.clientHeight) * this.$canvas.height;
		let cellX = ~~(realX / this.cellWidth()),
			cellY = ~~(realY / this.cellWidth());
		if (cellX >= this.cells.length) cellX--;
		if (cellY >= this.cells[cellX].length) cellY--;

		return { cell: this.cells[cellX][cellY], x: cellX, y: cellY };
	}
	step() {
		let stepCells = JSON.parse(JSON.stringify(this.cells));
		for (let x = 0; x < this.cells.length; x++) {
			for (let y = 0; y < this.cells[x].length; y++) {
				let alivedNeighbours = this.alivedNeighbours(x, y);
				let cell = stepCells[x][y];
				if (cell != 0) {
					if (alivedNeighbours <= 1 || alivedNeighbours >= 4) cell = 0;
				} else if (alivedNeighbours == 3) cell = 1;
				stepCells[x][y] = cell;
			}
		}
		this.cells = stepCells;
		this.updateBoard();
		this.generation++;
		this.updateGeneration();
	}
	alivedNeighbours(x, y) {
		let neighbours = 0;
		let width = this.cells.length;

		// x-1 y-1
		if (x > 0 && y > 0 && this.cells[x - 1][y - 1]) neighbours++;
		// x   y-1
		if (y > 0 && this.cells[x][y - 1]) neighbours++;
		// x+1 y-1
		if (y > 0 && x + 1 < width && this.cells[x + 1][y - 1]) neighbours++;

		// x-1 y
		if (x > 0 && this.cells[x - 1][y]) neighbours++;
		// x+1 y
		if (x + 1 < width && this.cells[x + 1][y]) neighbours++;

		// x-1 y+1
		if (x > 0 && y + 1 < width && this.cells[x - 1][y + 1]) neighbours++;
		// x   y+1
		if (y + 1 < width && this.cells[x][y + 1]) neighbours++;
		// x+1 y+1
		if (x + 1 < width && y + 1 < width && this.cells[x + 1][y + 1]) neighbours++;

		return neighbours;
	}
	updateBoard() {
		this.$canvas.clearAll();
		for (let x = 0; x < this.cells.length; x++) {
			for (let y = 0; y < this.cells[x].length; y++) {
				this.$canvas.drawCell(x, y, this.cells[x][y]);
			}
		}
		this.$canvas.renderGrid();
	}
	updateGeneration() {
		this.$generation.text(this.generation);
	}
	save() {
		localStorage.setItem("game_of_life_board", JSON.stringify(this.cells));
	}
	cellWidth() {
		return ~~(Math.min(this.$$canvasContainer.clientHeight, this.$$canvasContainer.clientWidth) / this.columnCount);
	}
};
SAHYG.Classes.GameOfLifeCanvas = class GameOfLifeCanvas extends HTMLCanvasElement {
	constructor() {
		super();
		this.context = this.applyFonctionToContext(this.getContext("2d"));
		this.lineWidth = 0.75;
	}
	applyFonctionToContext(/** @type {CanvasRenderingContext2D}*/ ctx) {
		["beginPath", "moveTo", "lineTo", "stroke", "fillRect"].forEach((name) => {
			let fn = ctx[name].bind(ctx);
			Object.defineProperty(ctx, name, {
				value: function () {
					fn.call(ctx, ...arguments);
					return ctx;
				},
			});
		});
		return ctx;
	}
	/** @param {SAHYG.Classes.GameOfLife} GameOfLife*/
	init(GameOfLife) {
		this.GameOfLife = GameOfLife;

		this.on("mousemove", this.GameOfLife.updatePosition.bind(this.GameOfLife));
		this.on("click", this.GameOfLife.placeCell.bind(this.GameOfLife));

		this.updateWidth(true);
		if (this.GameOfLife.cells) this.GameOfLife.updateBoard();
		else this.renderGrid();
	}
	updateWidth(updateCells = false) {
		this.width = this.height = 0;

		if (updateCells) this.GameOfLife.updateMatrix();

		this.width = this.height = this.GameOfLife.columnCount * this.GameOfLife.cellWidth();
	}
	renderGrid() {
		let cellWidth = this.GameOfLife.cellWidth() || 1;
		this.context.strokeStyle = SAHYG.Utils.settings.theme.current() == "light" ? "#e0e9f4" : "#576b85";
		this.context.lineWidth = this.lineWidth;

		for (let x = 0; x <= this.width; x += cellWidth) {
			this.context.beginPath().moveTo(x, 0).lineTo(x, this.height).stroke();
		}
		for (let y = 0; y <= this.height; y += cellWidth) {
			this.context.beginPath().moveTo(0, y).lineTo(this.width, y).stroke();
		}
	}
	clearAll() {
		this.context.clearRect(0, 0, this.width, this.height);
	}
	drawCell(x, y, age) {
		let cellWidth = this.GameOfLife.cellWidth();
		this.context.fillStyle = `yellow`;
		this.context.globalAlpha = age;
		this.context.fillRect(x * cellWidth, y * cellWidth, cellWidth, cellWidth);
		this.context.globalAlpha = 1;
	}
};

SAHYG.onload(() => (SAHYG.Instances.GameOfLife = new SAHYG.Classes.GameOfLife()));
