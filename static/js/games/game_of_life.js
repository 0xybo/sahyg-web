$(function () {
	SAHYG.Classes.GameOfLife = class GameOfLife {
		$canvasContainer = $("container .canvas");
		$$canvasContainer = $("container .canvas")[0];
		$debug = $("container .debug");
		$columnCountValue = $("container .column-count .value");
		$columnCount = $("container .column-count input");
		$speedValue = $("container .speed .value");
		$speed = $("container .speed input");
		$resume = $("container .resume");
		$pause = $("container .pause");
		$next = $("container .next");
		$share = $("container .share");
		speed = 50;
		minInterval = 10;
		maxInterval = 1000;
		columnCount = 10;
		cells = null;
		debug = false;
		interval = null;
		constructor() {
			let params = SAHYG.Utils.url.getParams();

			if (params.board) {
				let decodedBoard = this.decodeBoard(params.board);
				this.cells = decodedBoard;
				this.columnCount = decodedBoard.length;
				this.$columnCountValue.text(this.columnCount);
				this.$columnCount.attr("value", this.columnCount);
			} else {
				let storedBoard = localStorage.getItem("game_of_life_board");
				if (storedBoard) {
					this.cells = JSON.parse(storedBoard);
					this.columnCount = this.cells.length;
					this.$columnCountValue.text(this.columnCount);
					this.$columnCount.attr("value", this.columnCount);
				} else if (params.columns) {
					let columnCount = Number(params.columns);
					if (columnCount < 5) columnCount = 5;
					else if (columnCount > 100) columnCount = 100;
					this.columnCount = columnCount;
					this.$columnCountValue.text(this.columnCount);
					this.$columnCount.attr("value", this.columnCount);
				}
			}

			if (params.speed) {
				let speed = Number(params.speed);
				if (speed >= 1 && speed <= 100) this.speed = speed;
				this.$speedValue.text(speed);
				this.$speed.attr("value", speed);
			}

			this.canvas = document.createElement("canvas", { is: "gameoflife-canvas" });
			this.$canvas = $(this.canvas);
			this.canvas.init(this);
			this.$canvasContainer.append(this.canvas);

			SAHYG.on("click", "container .resume:not(.disabled)", this.resume.bind(this));
			SAHYG.on("click", "container .pause:not(.disabled)", this.pause.bind(this));
			SAHYG.on("click", "container .next:not(.disabled)", this.next.bind(this));
			SAHYG.on("click", "container .clear:not(.disabled)", this.clear.bind(this));
			SAHYG.on("click", "container .share:not(.disabled)", this.share.bind(this));

			SAHYG.on(
				"input",
				this.$columnCount,
				function (event) {
					this.cells = null;
					this.columnCount = Number($(event.target).val());
					this.$columnCountValue.text(this.columnCount);
					this.canvas.updateWidth();
					this.canvas.renderGrid();
				}.bind(this)
			);
			SAHYG.on("change", this.$columnCount, () => SAHYG.Utils.url.setLocationParam("columns", this.columnCount));
			SAHYG.on(
				"input",
				this.$speed,
				function (event) {
					this.speed = Number($(event.target).val());
					this.$speedValue.text(this.speed + "%");
					if (this.interval) this.updateInterval();
				}.bind(this)
			);
			SAHYG.on("change", this.$speed, () => SAHYG.Utils.url.setLocationParam("speed", this.speed));
		}
		share() {
			let url = SAHYG.Utils.url.setParams({
				speed: this.speed,
				cell_width: this.cellWidth(),
				board: this.encodeBoard(this.cells),
			});
			navigator.clipboard.writeText(url).then(async () => {
				SAHYG.Components.toast.Toast.success({
					message: await SAHYG.translate("COPIED"),
				}).show();
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
			return columns.reduce((previousColumns, currentColumn) => {
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
		}
		clear() {
			this.cells = null;
			this.canvas.updateWidth();
			this.canvas.renderGrid();
			localStorage.removeItem("game_of_life_board");
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
			if (this.interval) return;
			this.interval = setInterval(this.step.bind(this), (this.maxInterval - this.minInterval) * ((100 - this.speed + 1) / 100));
			this.$resume.addClass("disabled");
			this.$pause.removeClass("disabled");
			this.$next.addClass("disabled");
			this.$share.addClass("disabled");
		}
		clearInterval() {
			if (!this.interval) return;
			clearInterval(this.interval);
			this.interval = null;
			this.$pause.addClass("disabled");
			this.$resume.removeClass("disabled");
			this.$next.removeClass("disabled");
			this.$share.removeClass("disabled");
		}
		updateInterval() {
			if (!this.interval) return;
			this.clearInterval();
			this.setInterval();
		}
		updateMatrix() {
			this.cells = Array(this.columnCount)
				.fill(null)
				.map(() =>
					Array(this.columnCount)
						.fill(null)
						.map(() => 0)
				);
		}
		updatePosition(e) {
			if (!this.debug) return;
			let rect = this.canvas.getBoundingClientRect();
			let x = e.clientX - rect.left,
				y = e.clientY - rect.top;
			let realX = (x / this.$canvas.width()) * this.canvas.width,
				realY = (y / this.$canvas.height()) * this.canvas.height;
			let cellX = ~~(realX / this.cellWidth()),
				cellY = ~~(realY / this.cellWidth());
			this.$debug.html([`clientX: ${x} / canvasX: ${realX}`, `clientY: ${y} / canvasY ${realY}`, `cell: ${cellX}:${cellY}`].join("</br>"));
		}
		placeCell(e) {
			let rect = this.canvas.getBoundingClientRect();
			let x = e.clientX - rect.left,
				y = e.clientY - rect.top;
			let { cell, x: cellX, y: cellY } = this.getCell(x, y);
			if (cell == 0) cell = 1;
			else cell = 0;
			this.cells[cellX][cellY] = cell;

			this.canvas.updateCell(cellX, cellY, cell);

			this.save();
		}
		getCell(x, y) {
			let realX = (x / this.$canvas.width()) * this.canvas.width,
				realY = (y / this.$canvas.height()) * this.canvas.height;
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
			this.canvas.clearAll();
			for (let x = 0; x < this.cells.length; x++) {
				for (let y = 0; y < this.cells[x].length; y++) {
					this.canvas.drawCell(x, y, this.cells[x][y]);
				}
			}
			this.canvas.renderGrid();
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
			this.context = context(this.getContext("2d"));
			this.lineWidth = 2;
		}
		init(GameOfLife) {
			this.GameOfLife = GameOfLife;

			SAHYG.on("mousemove", this, this.GameOfLife.updatePosition.bind(this.GameOfLife));
			SAHYG.on("click", this, this.GameOfLife.placeCell.bind(this.GameOfLife));

			this.updateWidth();
			if (this.GameOfLife.cells) this.GameOfLife.updateBoard();
			else this.renderGrid();
		}
		updateWidth() {
			this.width = this.height = 0;

			if (!this.GameOfLife.cells) this.GameOfLife.updateMatrix();

			this.width = this.height = this.GameOfLife.columnCount * this.GameOfLife.cellWidth();
		}
		renderGrid() {
			let cellWidth = this.GameOfLife.cellWidth() || 1;
			this.context.strokeStyle = "#576b85";
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
		updateCell(x, y, age) {
			let cellWidth = this.GameOfLife.cellWidth();
			this.context.clearRect(x * cellWidth, y * cellWidth, cellWidth, cellWidth);

			this.drawCell(x, y, age);
			this.renderGrid();
		}
		drawCell(x, y, age) {
			let cellWidth = this.GameOfLife.cellWidth();
			this.context.fillStyle = `yellow`;
			this.context.globalAlpha = age;
			this.context.fillRect(x * cellWidth, y * cellWidth, cellWidth, cellWidth);
			this.context.globalAlpha = 1;
		}
	};
	function context(/** @type {CanvasRenderingContext2D}*/ ctx) {
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
	customElements.define("gameoflife-canvas", SAHYG.Classes.GameOfLifeCanvas, { extends: "canvas" });
	SAHYG.Instances.GameOfLife = new SAHYG.Classes.GameOfLife();
});
