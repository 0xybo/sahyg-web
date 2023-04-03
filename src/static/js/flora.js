SAHYG.Classes.Flora = class Flora {
	history = [];
	constructor() {
		this.$previousButton = SAHYG.$0("app .actions .previous");
		this.$searchField = SAHYG.$0("#flora-search");
		this.$searchConfirmButton = SAHYG.$0("app [data-horizontal-tabs-id=search] .search-bar .confirm");
		this.$searchResultsContainer = SAHYG.$0("app [data-horizontal-tabs-id=search] .results");
		this.$searchCounter = SAHYG.$0("app [data-horizontal-tabs-id=search] .counter .value");
		this.$identificationTab = SAHYG.$0('app [data-horizontal-tabs-id="identification"]');
		this.$searchTab = SAHYG.$0('app [data-horizontal-tabs-id="search"]');
		this.$glossaryTab = SAHYG.$0('app [data-horizontal-tabs-id="glossary"]');

		SAHYG.Events.click.push(
			{ element: 'app [data-horizontal-tabs-id="identification"] .possibility', callback: this.click.bind(this) },
			{ element: 'app [data-horizontal-tabs-id="identification"] .actions .start', callback: this.start.bind(this) }
		); // TODO replace event click

		this.$searchField.on("keydown", (e) => ((e.which || e.keyCode) == 13 ? this.searchEvent(e) : null));
		this.$previousButton.on("click", this.previous.bind(this));
		this.$searchConfirmButton.on("click", this.searchEvent.bind(this));

		let id = SAHYG.Utils.url.getParams().identification;
		if (id) this.load(id).then(() => this.choice(id));
		let flora_search = SAHYG.Utils.url.getParams().flora_search;
		if (flora_search) {
			this.$searchField.value = flora_search;
			// this.searchConfirmButton.trigger("click");
		}
	}
	choice(target) {
		SAHYG.$("app .possibilities.visible").removeClass("visible");
		SAHYG.$(`app .possibilities[id="${target}"]`).addClass("visible");
		SAHYG.Utils.url.setLocationParams({ identification: target });
		if (Number(target) < Number(this.history[this.history.length - 1]) || this.history.length == 0) this.history = [target];
		else this.history.push(target);
		if (Number(target) <= 1) this.$previousButton.addClass("disabled");
		else this.$previousButton.removeClass("disabled");
		SAHYG.Utils.selection.clear();
	}
	async click(event) {
		let id = event.target.getAttribute("target");
		await this.load(id);
		this.choice(id);
	}
	async previous() {
		if (this.$previousButton.hasClass("disabled")) return;
		if (this.history.length > 1) {
			this.history.pop();
			this.choice(this.history.pop() || "1");
		} else {
			let parent = SAHYG.$("app .possibilities.visible").getAttribute("data-parent");
			if (parent) {
				await this.load(parent);
				this.choice(parent);
			}
		}
	}
	start() {
		this.history = [];
		this.choice("1");
		this.$previousButton.addClass("disabled");
	}
	async append(id, data) {
		if (SAHYG.$0(`app .possibilities[id="${id}"]`)) return;

		let parent = this.history[this.history.length - 1];
		if (Number(parent) > Number(id) || !parent) parent = data.parents[0];

		if (data.type == "question")
			this.$identificationTab.append(
				SAHYG.createElement(
					"div",
					{ class: `possibilities ${data.type}`, id, "data-parent": parent },
					data.possibilities.map((possibility) =>
						SAHYG.createElement("div", { class: "possibility", target: possibility.target }, possibility.text)
					),
					data.sketch ? SAHYG.createElement("img", { class: "sketch", src: "/img/flora/sketch/" + data.sketch + ".jpg" }) : null
				)
			);
		else if (data.type == "specimen")
			this.$identificationTab.append(
				SAHYG.createElement(
					"div",
					{ class: `possibilities ${data.type}`, id, "data-parent": parent },
					SAHYG.createElement(
						"div",
						{ class: "cards" },
						SAHYG.createElement(
							"div",
							{ class: "card family" },
							SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FAMILY")),
							SAHYG.createElement("span", { class: "text" }, data.family)
						),
						SAHYG.createElement(
							"div",
							{ class: "card gender" },
							SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("GENDER")),
							SAHYG.createElement("span", { class: "text" }, data.gender)
						),
						SAHYG.createElement(
							"div",
							{ class: "card latin" },
							SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("LATIN")),
							SAHYG.createElement("span", { class: "text" }, data.latin)
						),
						SAHYG.createElement(
							"div",
							{ class: "card french" },
							SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FLORA_FRENCH")),
							SAHYG.createElement("span", { class: "text" }, data.french)
						),
						SAHYG.createElement(
							"div",
							{ class: "card common" },
							SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FLORA_COMMON")),
							SAHYG.createElement("span", { class: "text" }, data.common)
						)
					),
					SAHYG.createElement(
						"div",
						{ class: "card properties" },
						SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FLORA_PROPERTIES")),
						SAHYG.createElement("span", { class: "text" }, data.properties)
					),
					SAHYG.createElement(
						"div",
						{ class: "card habitat" },
						SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FLORA_HABITAT")),
						SAHYG.createElement("span", { class: "text" }, data.habitat)
					),
					SAHYG.createElement(
						"div",
						{ class: "card location" },
						SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FLORA_LOCATION")),
						SAHYG.createElement("span", { class: "text" }, data.location)
					)
				)
			);
	}
	getData(id) {
		return new Promise(async (resolve, reject) => {
			let elem = SAHYG.$0(`app .possibilities[id="${id}"]`);
			if (elem) {
				let question = elem.hasClass("question");
				return resolve({
					type: question ? "question" : "specimen",
					parents: [elem.getAttribute("data-parent") || "1"],
					possibilities: question
						? [
								...elem.children.map((child) => {
									return {
										text: child.text(),
										target: child.getAttribute("target"),
									};
								}),
						  ]
						: null,
					...(question
						? {}
						: Object.fromEntries(
								["family", "gender", "latin", "french", "common", "properties", "habitat", "location", "id"].map((e) => [
									e,
									elem.$0(`.${e} .text`)?.text(),
								])
						  )),
				});
			} else {
				let data = await SAHYG.Api.post("/flora", { type: "get", id });
				if (data) resolve(data);
				else reject();
			}
		});
	}
	load(id) {
		return new Promise((resolve, reject) => {
			this.getData(id)
				.then(async (data) => (await this.append(id, data), resolve()))
				.catch(async () => {
					SAHYG.Components.toast.Toast.danger({
						message: await SAHYG.translate("ERROR_OCCURRED"),
					}).show();
				});
		});
	}
	searchEvent(e) {
		let value = this.$searchField.value;
		SAHYG.Utils.url.setLocationParams({ flora_search: value });
		this.search(value);
	}
	async search(value) {
		if (this.searchTimeout) clearTimeout(this.searchTimeout), (this.searchTimeout = null);
		let res = (await this.searchRequest(value)) || {};
		this.$searchResultsContainer.clear();
		for (const [id, properties] of Object.entries(res))
			this.$searchResultsContainer.append(
				SAHYG.createElement(
					"div",
					{ class: "item " + properties.type, "data-id": id },
					properties.type == "question"
						? SAHYG.createElement(
								"div",
								{ class: "possibilities" },
								SAHYG.createElement("span", { class: "title" }, await SAHYG.translate("POSSIBILITIES")),
								SAHYG.createElement(
									"span",
									{ class: "list" },
									properties.possibilities.map((possibility) =>
										SAHYG.createElement(
											"a",
											{ class: "possibility", "data-target": possibility.target },
											`${possibility.text} (Id: ${possibility.target})`
										).on("click", async (e) => {
											await this.load(possibility.target);
											this.choice(possibility.target);
											SAHYG.Components.navigation.openHorizontalTab("tab", "identification");
										})
									)
								)
						  )
						: [
								SAHYG.createElement(
									"div",
									{ class: "property" },
									SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FAMILY")),
									SAHYG.createElement("span", { class: "text" }, properties.family)
								),
								SAHYG.createElement(
									"div",
									{ class: "property" },
									SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("GENDER")),
									SAHYG.createElement("span", { class: "text" }, properties.gender)
								),
								SAHYG.createElement(
									"div",
									{ class: "property" },
									SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("LATIN")),
									SAHYG.createElement("span", { class: "text" }, properties.latin)
								),
								SAHYG.createElement(
									"div",
									{ class: "property" },
									SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FAMILY")),
									SAHYG.createElement("span", { class: "text" }, properties.family)
								),
								SAHYG.createElement(
									"div",
									{ class: "property" },
									SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FLORA_FRENCH")),
									SAHYG.createElement("span", { class: "text" }, properties.french)
								),
								SAHYG.createElement(
									"div",
									{ class: "property" },
									SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FLORA_COMMON")),
									SAHYG.createElement("span", { class: "text" }, properties.common)
								),
								SAHYG.createElement(
									"div",
									{ class: "property" },
									SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FLORA_PROPERTIES")),
									SAHYG.createElement("span", { class: "text" }, properties.properties)
								),
								SAHYG.createElement(
									"div",
									{ class: "property" },
									SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FLORA_HABITAT")),
									SAHYG.createElement("span", { class: "text" }, properties.habitat)
								),
								SAHYG.createElement(
									"div",
									{ class: "property" },
									SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("FLORA_LOCATION")),
									SAHYG.createElement("span", { class: "text" }, properties.location)
								),
								SAHYG.createElement(
									"div",
									{ class: "property" },
									SAHYG.createElement("span", { class: "name" }, await SAHYG.translate("ID")),
									SAHYG.createElement("span", { class: "text" }, properties.id)
								),
						  ],
					SAHYG.createElement(
						"div",
						{ class: "position" },
						SAHYG.createElement("btn", { class: "goto btn-full" }, await SAHYG.translate("GO_TO")).on("click", async () => {
							await this.load(id);
							this.choice(id);
							SAHYG.Components.navigation.openHorizontalTab("tab", "identification");
						}),
						properties.parents && !(properties.parents.length == 1 && properties.parents.includes(0))
							? SAHYG.createElement(
									"div",
									{ class: "parents" },
									SAHYG.createElement("span", { class: "title" }, await SAHYG.translate("PARENTS")),
									...properties.parents.map((parent) =>
										parent
											? SAHYG.createElement("btn", { class: "btn-un parent", "data-target": parent }, parent).on(
													"click",
													async () => {
														await this.load(parent);
														this.choice(parent);
														SAHYG.Components.navigation.openHorizontalTab("tab", "identification");
													}
											  )
											: null
									)
							  )
							: null,
						SAHYG.createElement("div", { class: "id" }, "Id: " + id)
					)
				)
			);

		this.$searchCounter.text(Object.keys(res).length);
	}
	searchRequest(value) {
		return SAHYG.Api.post("/flora", { type: "search", value });
	}
};

SAHYG.onload(async () => (SAHYG.Instances.Flora = new SAHYG.Classes.Flora()));
