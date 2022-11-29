$(async function () {
	SAHYG.Instances.Flora = new Flora();
});

class Flora {
	history = [];
	constructor() {
		this.possibilitiesElements = $("app .possibilities");
		this.previousButton = $("app .actions .previous");
		this.searchField = $("#flora-search");
		this.searchConfirmButton = $("app [data-horizontal-tabs-id=search] .search-bar .confirm");
		this.searchResultsContainer = $("app [data-horizontal-tabs-id=search] .results");
		this.searchCounter = $("app [data-horizontal-tabs-id=search] .counter .value");
		SAHYG.Events.click.push(
			{ element: 'app [data-horizontal-tabs-id="identification"] .possibility', callback: this.click.bind(this) },
			{ element: 'app [data-horizontal-tabs-id="identification"] .actions .start', callback: this.start.bind(this) },
			{ element: this.previousButton, callback: this.previous.bind(this) },
			{ element: this.searchConfirmButton, callback: this.searchEvent.bind(this) }
		);
		SAHYG.Events.keypress.push({
			element: this.searchField,
			callback: (e) => ((e.which || e.keyCode) == 13 ? this.searchEvent(e) : null),
		});

		let id = SAHYG.Utils.url.getParams().identification;
		if (id) this.load(id).then(() => this.choice(id));
		let flora_search = SAHYG.Utils.url.getParams().flora_search;
		if (flora_search) {
			this.searchField.val(flora_search);
			// this.searchConfirmButton.trigger("click");
		}
	}
	choice(target) {
		$("app .possibilities.visible").removeClass("visible");
		$("app .possibilities#" + target).addClass("visible");
		SAHYG.Utils.url.setLocationParams({ identification: target });
		if (Number(target) < Number(this.history[this.history.length - 1]) || this.history.length == 0) this.history = [target];
		else this.history.push(target);
		if (Number(target) <= 1) this.previousButton.addClass("disabled");
		else this.previousButton.removeClass("disabled");
		SAHYG.Utils.selection.clear();
	}
	async click(event) {
		let id = $(event.target).attr("target");
		await this.load(id);
		this.choice(id);
	}
	async previous() {
		if (this.previousButton.hasClass("disabled")) return;
		if (this.history.length > 1) {
			this.history.pop();
			this.choice(this.history.pop() || "1");
		} else {
			let currentPossibilities = $("app .possibilities.visible");
			let parent = currentPossibilities.attr("data-parent");
			if (parent) {
				await this.load(parent);
				this.choice(parent);
			}
		}
	}
	start() {
		this.history = [];
		this.choice("1");
		this.previousButton.addClass("disabled");
	}
	async append(id, data) {
		if ($(`app .possibilities#${id}`).length) return;
		let parent = this.history[this.history.length - 1];
		if (Number(parent) > Number(id) || !parent) parent = data.parents[0];
		let container = $("app [data-horizontal-tabs-id=identification]");
		let element = $(`<div class="possibilities ${data.type}" id="${id}" data-parent="${parent}"></div>`);
		if (data.type == "question") {
			data.possibilities.forEach((possiblity) => {
				element.append($(`<div class="possibility" target="${possiblity.target}">${possiblity.text}</div>`));
			});
		} else if (data.type == "specimen") {
			let cards = $(`<div class="cards"></div>`);
			cards.append(
				$(`<div class="card family"><span class="name">${await SAHYG.translate("FAMILY")}</span><span class="text">${data.family}</span></div>`)
			);
			cards.append(
				$(`<div class="card gender"><span class="name">${await SAHYG.translate("GENDER")}</span><span class="text">${data.gender}</span></div>`)
			);
			cards.append(
				$(`<div class="card latin"><span class="name">${await SAHYG.translate("LATIN")}</span><span class="text">${data.latin}</span></div>`)
			);
			cards.append(
				$(`<div class="card french"><span class="name">${await SAHYG.translate("FLORA_FRENCH")}</span><span class="text">${data.french}</span></div>`)
			);
			cards.append(
				$(`<div class="card common"><span class="name">${await SAHYG.translate("FLORA_COMMON")}</span><span class="text">${data.common}</span></div>`)
			);
			element.append(cards);
			element.append(
				$(
					`<div class="card properties"><span class="name">${await SAHYG.translate("FLORA_PROPERTIES")}</span><span class="text">${
						data.properties
					}</span></div>`
				)
			);
			element.append(
				$(
					`<div class="card habitat"><span class="name">${await SAHYG.translate("FLORA_HABITAT")}</span><span class="text">${
						data.habitat
					}</span></div>`
				)
			);
			element.append(
				$(
					`<div class="card location"><span class="name">${await SAHYG.translate("FLORA_LOCATION")}</span><span class="text">${
						data.location
					}</span></div>`
				)
			);
		}
		container.append(element);
	}
	getData(id) {
		return new Promise((resolve, reject) => {
			let elem = $(`app .possibilities#${id}`);
			if (elem.length) {
				let question = elem.hasClass("question");
				return resolve({
					type: question ? "question" : "specimen",
					parents: [elem.attr("data-parent") || "1"],
					possibilities: question
						? [
								...elem
									.children()
									.toArray()
									.map((child) => {
										child = $(child);
										return {
											text: child.text(),
											target: child.attr("target"),
										};
									}),
						  ]
						: null,
					...(question
						? {}
						: Object.fromEntries(
								["family", "gender", "latin", "french", "common", "properties", "habitat", "location", "id"].map((e) => [
									e,
									elem.find(`.${e} .text`).text(),
								])
						  )),
				});
			} else
				$.post("/flora", { type: "get", id })
					.done((data) => (data ? resolve(data) : reject()))
					.fail(reject);
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
		let value = this.searchField.val();
		SAHYG.Utils.url.setLocationParams({ flora_search: value });
		this.search(value);
	}
	async search(value) {
		if (this.searchTimeout) clearTimeout(this.searchTimeout), (this.searchTimeout = null);
		let res = (await this.searchRequest(value)) || {};
		this.searchResultsContainer.empty();
		for (const [id, properties] of Object.entries(res)) {
			let elem = $(`<div class="item ${properties.type}" data-id="${id}"></div>`);
			if (properties.type == "question") {
				elem.append(
					$(
						`<div class="possibilities"><span class="title">${await SAHYG.translate(
							"POSSIBILITIES"
						)}</span><div class="list">${properties.possibilities
							.map((possibility) => `<a class="possibility" data-target="${possibility.target}">${possibility.text} (Id: ${possibility.target})</a>`)
							.join("")}</div></div>`
					)
				);
			} else {
				elem.append(
					$(`<div class="property"><span class="name">${await SAHYG.translate("FAMILY")}</span><span class="text">${properties.family}</span></div>`)
				);
				elem.append(
					$(`<div class="property"><span class="name">${await SAHYG.translate("GENDER")}</span><span class="text">${properties.gender}</span></div>`)
				);
				elem.append(
					$(`<div class="property"><span class="name">${await SAHYG.translate("LATIN")}</span><span class="text">${properties.latin}</span></div>`)
				);
				elem.append(
					$(
						`<div class="property"><span class="name">${await SAHYG.translate("FLORA_FRENCH")}</span><span class="text">${
							properties.french
						}</span></div>`
					)
				);
				elem.append(
					$(
						`<div class="property"><span class="name">${await SAHYG.translate("FLORA_COMMON")}</span><span class="text">${
							properties.common
						}</span></div>`
					)
				);
				elem.append(
					$(
						`<div class="property"><span class="name">${await SAHYG.translate("FLORA_PROPERTIES")}</span><span class="text">${
							properties.properties
						}</span></div>`
					)
				);
				elem.append(
					$(
						`<div class="property"><span class="name">${await SAHYG.translate("FLORA_HABITAT")}</span><span class="text">${
							properties.habitat
						}</span></div>`
					)
				);
				elem.append(
					$(
						`<div class="property"><span class="name">${await SAHYG.translate("FLORA_LOCATION")}</span><span class="text">${
							properties.location
						}</span></div>`
					)
				);
				elem.append(
					$(`<div class="property"><span class="name">${await SAHYG.translate("ID")}</span><span class="text">${properties.id}</span></div>`)
				);
			}
			elem.append(
				$(`<div class="position"></div>`).append(
					$(`<btn class="goto btn-full">${await SAHYG.translate("GO_TO")}</btn>`),
					properties.parents
						? $(
								`<div class="parents"><span class="title">${await SAHYG.translate("PARENTS")} : </span>${properties.parents
									?.map((parent) => `<btn class="btn-un parent" data-target="${parent}">${parent}</btn>`)
									.join("")}</div>`
						  )
						: null,
					$(`<div class="id">Id : ${id}</div>`)
				)
			);
			this.searchResultsContainer.append(elem);
		}
		this.searchCounter.text(Object.keys(res).length);
		SAHYG.Events.click.push(
			{
				element: '[data-horizontal-tabs-id="search"] a.possibility',
				callback: async (e) => {
					let id = $(e.target).attr("data-target");
					await this.load(id);
					this.choice(id);
					SAHYG.Components.navigation.openHorizontalTab("tab", "identification");
				},
			},
			{
				element: '[data-horizontal-tabs-id="search"] .parent',
				callback: async (e) => {
					let id = $(e.target).attr("data-target");
					await this.load(id);
					this.choice(id);
					SAHYG.Components.navigation.openHorizontalTab("tab", "identification");
				},
			},
			{
				element: '[data-horizontal-tabs-id="search"] .goto',
				callback: async (e) => {
					let id = $(e.target).closest(".item").attr("data-id");
					await this.load(id);
					this.choice(id);
					SAHYG.Components.navigation.openHorizontalTab("tab", "identification");
				},
			}
		);
	}
	searchRequest(value) {
		return new Promise((resolve) => {
			$.post("/flora", { type: "search", value })
				.done(resolve)
				.fail(async () => {
					SAHYG.Components.toast.Toast.danger({
						message: await SAHYG.translate("ERROR_OCCURRED"),
					}).show();
					resolve(null);
				});
		});
	}
}
