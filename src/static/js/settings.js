SAHYG.Classes.Settings = class Settings {
	$tabs = SAHYG.$0("#tab");
	constructor() {
		this.init();
	}
	async init() {
		let loader = SAHYG.Components.loader.center();
		await this.fetch();
		loader.remove();

		this.$tabs.$0(".tabs").append(
			SAHYG.createElement(
				"div",
				{ class: "icons" },
				(this.$needReload = SAHYG.createElement(
					"span",
					{
						class: "need-reload lafs",
						"data-tooltip": await SAHYG.translate("SETTING_NEED_RELOAD"),
					},
					"\uf2f9"
				))
			),
			(this.$saveButton = SAHYG.createElement("input", {
				type: "button",
				class: "full disabled",
				id: "save-button",
				value: await SAHYG.translate("SAVE"),
			}).on("click", this.save.bind(this)))
		);

		for (let setting of this.settings) {
			let $category = SAHYG.$0(`[sahyg-tab="${setting.category}"]`);
			if (!$category) continue;

			switch (setting.type) {
				case "selectOne":
				case "select": {
					if (!SAHYG.Utils.user.isConnected()) {
						switch (setting.id) {
							case "theme": {
								setting.value = SAHYG.Utils.settings.theme.current();
								break;
							}
							case "locale": {
								setting.value = SAHYG.Utils.settings.locale.get();
							}
						}
					}
					setting.$ = SAHYG.createElement(
						"div",
						{ class: "setting" },
						SAHYG.createElement(
							"div",
							{ class: "informations" },
							SAHYG.createElement(
								"div",
								{ class: "title" },
								setting.title,
								["locale"].includes(setting.id)
									? SAHYG.createElement(
											"span",
											{
												class: "need-reload lafs",
												"data-tooltip": await SAHYG.translate("SETTING_NEED_RELOAD"),
											},
											"\uf2f9"
									  )
									: null
							),
							SAHYG.createElement("div", { class: "description" }, setting.description)
						),
						SAHYG.createElement(
							"div",
							{ class: "value" },
							SAHYG.createElement("sahyg-select", {
								id: setting.id,
								options: JSON.stringify(setting.options),
								multiple: String(setting.type != "selectOne"),
								selected: JSON.stringify([setting.value]),
								...(!setting.editable ? { disabled: true } : {}),
							}).on("input", this.µInputSelect.bind(this))
						)
					);
					break;
				}
				case "text": {
					if (setting.validator) {
						let { exp, flags } = /^(?:\/)(?<exp>.+)(?:\/)(?<flags>g?m?i?y?u?s?d?)$/g.exec(setting.validator)?.groups || {};
						if (exp) setting.validator = new RegExp(exp, flags);
						else setting.validator = null;
					}
					setting.$ = SAHYG.createElement(
						"div",
						{ class: "setting" },
						SAHYG.createElement(
							"div",
							{ class: "informations" },
							SAHYG.createElement(
								"div",
								{ class: "title" },
								setting.title,
								["username"].includes(setting.id)
									? SAHYG.createElement(
											"span",
											{
												class: "need-reload lafs",
												"data-tooltip": await SAHYG.translate("SETTING_NEED_RELOAD"),
											},
											"\uf2f9"
									  )
									: null
							),
							SAHYG.createElement("div", { class: "description" }, setting.description)
						),
						SAHYG.createElement(
							"div",
							{ class: "value" },
							SAHYG.createElement("sahyg-textarea", {
								multiline: false,
								showCharacterCounter: true,
								placeholder: await SAHYG.translate(setting.title),
								defaultValue: setting.value,
								borderBottom: "true",
							})
								.setValidator(setting.validator)
								.on("input", this.µInputText.bind(this, setting.id))
						)
					);
					break;
				}
				case "avatar": {
					setting.$ = SAHYG.createElement(
						"div",
						{ class: "avatar" },
						SAHYG.createElement(
							"div",
							{ class: "image" },
							(this.$avatar = SAHYG.createElement("img", {
								"data-viewer": true,
								src: setting.value ? location.origin + "/resources/avatar/" + SAHYG.Constants.username : "",
							}))
						),
						SAHYG.createElement(
							"div",
							{ class: "panel" },
							SAHYG.createElement("span", { class: "title" }, await SAHYG.translate("PROFILE_PICTURE")),
							SAHYG.createElement(
								"div",
								{ class: "buttons" },
								(this.$addAvatar = SAHYG.createElement("input", {
									type: "button",
									class: "full" + (!setting.value ? "" : " disabled"),
									id: "add-avatar",
									value: await SAHYG.translate("ADD"),
								}).on("click", this.µClickAddAvatar.bind(this))),
								(this.$editAvatar = SAHYG.createElement("input", {
									type: "button",
									class: "full" + (setting.value ? "" : " disabled"),
									id: "edit-avatar",
									value: await SAHYG.translate("EDIT"),
								}).on("click", this.µClickEditAvatar.bind(this))),
								(this.$removeAvatar = SAHYG.createElement("input", {
									type: "button",
									class: "full" + (setting.value ? "" : " disabled"),
									id: "remove-avatar",
									value: await SAHYG.translate("REMOVE"),
								}).on("click", this.µClickRemoveAvatar.bind(this)))
							),
							SAHYG.createElement("span", { class: "informations" }, await SAHYG.translate("SETTINGS_AVATAR_INFOS"))
						)
					);
					$category.$0(".tab-title").insertAdjacentElement("afterend", setting.$);
					continue;
				}
				case "textarea": {
					setting.$ = SAHYG.createElement(
						"div",
						{ class: "setting vertical" },
						SAHYG.createElement(
							"div",
							{ class: "informations" },
							SAHYG.createElement("div", { class: "title" }, setting.title),
							SAHYG.createElement("div", { class: "description" }, setting.description)
						),
						SAHYG.createElement(
							"div",
							{ class: "value" },
							SAHYG.createElement("sahyg-textarea", {
								id: setting.id,
								class: "outline rounded",
								multiline: true,
								dynamicHeight: false,
								characterCounter: true,
								placeholder: await SAHYG.translate("ABOUT"),
								defaultValue: setting.value,
								minHeight: 100,
								maxLength: 1024,
								resize: "vertical",
								...(!setting.editable ? { disabled: true } : {}),
							}).on("input", this.µInputText.bind(this, setting.id))
						)
					);
					break;
				}
				case "inputArray": {
					setting.$ = SAHYG.createElement(
						"div",
						{ class: "setting vertical" },
						SAHYG.createElement(
							"div",
							{ class: "informations" },
							SAHYG.createElement("div", { class: "title" }, setting.title),
							SAHYG.createElement("div", { class: "description" }, setting.description)
						),
						SAHYG.createElement(
							"div",
							{ class: "value" },
							SAHYG.createElement("sahyg-input-array", {
								columns: JSON.stringify(setting.columns),
								values: JSON.stringify(
									Object.entries(setting.value).map(([name, value]) => {
										return { name, value };
									})
								),
							}).on("input", this.µInputArray.bind(this, setting.id))
						)
					);
				}
			}
			$category.append(setting.$);
		}
	}
	async fetch() {
		await SAHYG.Api.get(location.pathname + "/list", {}, true)
			.then((res) => {
				if (!res.success) return;

				this.settings = res.content;
				this.savedSettings = structuredClone(this.settings);
			})
			.catch(console.error());
	}
	// async setSetting(name, value) {
	// 	if (this.settings[name] == value) return false;

	// 	if (typeof value == "string" && this.settings[name] == value.trim()) return false;

	// 	this.settings[name] = value;

	// 	await SAHYG.Api.post(location.pathname + "/set", {
	// 		settings: [
	// 			{
	// 				name,
	// 				value,
	// 			},
	// 		],
	// 	});
	// }
	// async setSettings(settings) {
	// 	let postData = {};
	// 	for (let [name, value] of Object.entries(settings)) {
	// 		if (this.settings[name] == value) continue;

	// 		if (typeof value == "string" && this.settings[name] == value.trim()) continue;

	// 		this.settings[name] = value;
	// 		postData[name] = value;
	// 	}
	// 	await SAHYG.Api.post(location.pathname + "/set", {
	// 		settings: postData,
	// 	});
	// }
	enableSaveButton() {
		this.$saveButton.removeClass("disabled");
	}
	disableSaveButton() {
		this.$saveButton.addClass("disable");
	}
	async save() {
		let fd = new FormData();
		for (let setting of this.settings) {
			if (await this.isModified(setting.id))
				if (
					setting.value instanceof Array ||
					typeof setting.value == "string" ||
					setting.value instanceof File ||
					typeof setting.value == "boolean"
				)
					fd.append(setting.id, setting.value);
				else Object.entries(setting.value).forEach(([k, v]) => fd.append(`${setting.id}[${k}]`, v));
		}

		if (!Array.from(fd).length) return;

		SAHYG.Api.post(location.pathname + "/set", fd, true)
			.then((res) => {
				if (!res?.success) return;
			})
			.catch(console.error);
	}
	async isModified(name) {
		let currentValue = this.settings.find((setting) => setting.id === name)?.value,
			oldValue = this.savedSettings.find((setting) => setting.id === name)?.value;

		if (typeof currentValue === "string") return currentValue !== oldValue;
		if (currentValue instanceof Array)
			return currentValue.length === oldValue.length ? !currentValue.every((value, index) => value === oldValue[index]) : true;
		if (currentValue instanceof File) return oldValue instanceof File ? (await currentValue.text()) == (await oldValue.text()) : true;

		currentValue = Object.entries(currentValue);
		oldValue = Object.entries(oldValue);
		return currentValue.length === oldValue.length ? !currentValue.every(([key, value], index) => value === oldValue[index][1]) : true;
	}
	async setSetting(id, value, forceSave = false) {
		let setting = this.settings.find((set) => set.id == id);
		if (!setting) return;

		if (!this.validSetting(id, value)) return;
		setting.value = value;

		if (!SAHYG.Utils.user.isConnected()) return;

		if (!(await this.isModified(setting.id)) && !forceSave) return;

		this.unsavedSettings = true;

		this.enableSaveButton();
	}
	validSetting(id, value) {
		let setting = this.settings.find((set) => set.id == id);

		switch (setting.type) {
			case "selectOne": {
				if (!setting.options[value]) return false;
				break;
			}
			case "select": {
				if (!value.every((val) => setting.options[val])) return false;
				break;
			}
		}
		return true;
	}
	needReload(needed = true) {
		if (needed) this.$needReload.addClass("needed");
		else this.$needReload.removeClass("needed");
	}
	µInputSelect({ target }) {
		let setting = this.settings.find((setting) => setting.id == target.id && setting.type.startsWith("select"));
		if (!setting) return;

		if (target.id == "theme") SAHYG.Utils.settings.theme.set(target.selected[0], false);
		if (target.id == "locale") {
			if (!SAHYG.Utils.settings.locale.is(target.selected[0])) this.needReload();
			SAHYG.Utils.settings.locale.set(target.selected[0], false, false);
		}

		this.setSetting(setting.id, setting.type == "selectOne" ? target.selected[0] : target.selected);
	}
	µInputText(name, event) {
		if (event.target.hasClass("invalid")) return;

		this.setSetting(name, event.target.value);
	}
	async µClickAddAvatar({ target }) {
		if (!this.$avatar || target.hasClass("disabled")) return;

		let file = await SAHYG.Utils.input.file(".png, .jpeg, .jpg", false);
		if (!file) return;
		file = await this.crop(file);
		if (!file) return;

		if (file.size > SAHYG.Constants.settings_max_avatar_size)
			return SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("MAX_SIZE_EXCEEDED") }).show();
		this.newAvatar = file;
		this.setSetting("avatar", file, true);

		this.$avatar.setAttribute("src", URL.createObjectURL(file));

		this.$addAvatar?.addClass("disabled");
		SAHYG.$(this.$editAvatar, this.$removeAvatar).removeClass("disabled");
	}
	async µClickEditAvatar({ target }) {
		if (!this.$avatar || target.hasClass("disabled")) return;

		let file = await SAHYG.Utils.input.file(".png, .jpeg, .jpg", false);
		if (!file) return;
		file = await this.crop(file);
		if (!file) return;

		if (file.size > SAHYG.Constants.settings_max_avatar_size)
			return SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("MAX_SIZE_EXCEEDED") }).show();
		this.newAvatar = file;
		this.setSetting("avatar", file, true);

		this.$avatar.setAttribute("src", URL.createObjectURL(file));

		this.$addAvatar?.addClass("disabled");
		SAHYG.$(this.$editAvatar, this.$removeAvatar).removeClass("disabled");
	}
	async crop(/**@type {File}**/ file) {
		let dataURL = await SAHYG.createElement("sahyg-cropper-dialog", {
			image: URL.createObjectURL(file),
			ratio: "1:1",
		})
			.show()
			.toPromise();

		if (!dataURL) return null;

		return new File([await (await fetch(dataURL)).blob()], file.name, { type: file.type, lastModified: new Date() });
	}
	async µClickRemoveAvatar({ target }) {
		if (!this.$avatar || target.hasClass("disabled")) return;

		this.newAvatar = null;
		this.setSetting("avatar", false);

		this.$avatar.removeAttribute("src");

		this.$addAvatar?.removeClass("disabled");
		SAHYG.$(this.$editAvatar, this.$removeAvatar).addClass("disabled");
	}
	async µInputArray(name, { target }) {
		this.setSetting(name, target.value);
	}
};

SAHYG.onload(() => (SAHYG.Instances.Settings = new SAHYG.Classes.Settings()));

// SAHYG.Classes.Settings = class Settings {
// 	constructor() {
// 		this.modified = false;
// 		this.alertBeforeExiting = false;
// 		this.data = {
// 			// get data from HTML
// 			theme: SAHYG.$0("#theme").getAttribute("data-value"),
// 			locale: SAHYG.$0("#locale").getAttribute("data-value"),
// 			username: SAHYG.$0("#username").value,
// 			firstname: SAHYG.$0("#firstname").value,
// 			lastname: SAHYG.$0("#lastname").value,
// 			email: SAHYG.$0("#email").value,
// 			about: SAHYG.$0("#about").value,
// 			custom: Object.fromEntries(
// 				$(".custom c-input-array")
// 					.data("rows")
// 					?.map((row) => [row.values.customLinkName, row.values.customLinkValue]) || []
// 			),
// 			shared: $("[class*=shareable-] c-boolean")
// 				.toArray()
// 				.map((elem) =>
// 					$(elem).attr("value") == "true"
// 						? $(elem)
// 								.closest(".setting")
// 								.attr("class")
// 								?.match(/(?<=shareable-)[^\s]+/gim)?.[0]
// 						: null
// 				)
// 				.filter(Boolean),
// 		};
// 		this.data.avatar = Boolean($(".avatar .current").find("img").length);
// 		this.updateOldData();
// 		this.aboutChartCounter = $("container [data-horizontal-tabs-id=profile] .about .chart-counter");
// 		this.saveButton = $("container .save-button");
// 		this.currentAvatarContainer = $("container .avatar .current");

// 		SAHYG.oldOn("input", "#username", this.verifyText.bind(this, "username"));
// 		SAHYG.oldOn("input", "#firstname", this.verifyText.bind(this, "firstname"));
// 		SAHYG.oldOn("input", "#lastname", this.verifyText.bind(this, "lastname"));
// 		SAHYG.oldOn("input", "#about", this.verifyText.bind(this, "about"));
// 		SAHYG.oldOn("input", ".custom c-input-array", this.customInput.bind(this));
// 		SAHYG.oldOn("input", "#theme", this.selectInput.bind(this));
// 		SAHYG.oldOn("input", "#locale", this.selectInput.bind(this));
// 		SAHYG.oldOn("click", "#avatar-add", this.addAvatar.bind(this));
// 		SAHYG.oldOn("click", "#avatar-edit", this.addAvatar.bind(this));
// 		SAHYG.oldOn("click", "#avatar-remove", this.removeAvatar.bind(this));
// 		SAHYG.oldOn("click", '[class*="shareable-"] c-boolean', this.shareableButton.bind(this));

// 		SAHYG.oldOn("beforeunload", window, this.beforeExiting.bind(this));
// 		SAHYG.oldOn("click", this.saveButton, this.save.bind(this));
// 	}
// 	updateOldData() {
// 		let _ = (data) => {
// 			if (!data) return false;
// 			if (data instanceof Array) return data.map(_);
// 			if (typeof data == "string") return data.trim();
// 			if (data instanceof File) return data;
// 			if (typeof data == "object") return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, _(v)]));
// 			return data;
// 		};
// 		this.oldData = _(this.data);
// 	}
// 	trim(val) {
// 		return typeof val == "string" ? val.trim() : val;
// 	}
// 	/**
// 	 * Recursive function for isModified function
// 	 * @param {Object} current
// 	 * @param {Object} old
// 	 * @returns {Boolean}
// 	 */
// 	dataIsModified(current, old) {
// 		if (typeof current == "string" || current instanceof File || typeof current == "boolean") return this.trim(current) != this.trim(old);
// 		if (current instanceof Array) return current.length == old.length ? !current.every((k, i) => this.trim(old[i]) == this.trim(k)) : true;
// 		let currentEntries = Object.entries(current);
// 		let oldEntries = Object.entries(old);
// 		return currentEntries.length == oldEntries.length ? currentEntries.some(([k, v]) => this.dataIsModified(v, old[k])) : true;
// 	}
// 	/**
// 	 * Checks if the current values (this.data) is unequal to the old values (this.oldData).
// 	 * @returns {Boolean}
// 	 */
// 	isModified() {
// 		return (this.modified = this.dataIsModified(this.data, this.oldData));
// 	}
// 	/**
// 	 * Handler for input event on the custom information list
// 	 * @param {{target: HTMLElement}} param0
// 	 */
// 	customInput({ target }) {
// 		this.data.custom = Object.fromEntries(
// 			$(target)
// 				.data("rows")
// 				?.map((row) => [row.values.customLinkName, row.values.customLinkValue]) || []
// 		);
// 		this.updateSaveButton();
// 	}
// 	/**
// 	 * Handler for input event on any select
// 	 * @param {{target: HTMLElement}} param0
// 	 */
// 	selectInput({ target }) {
// 		let key = $(target).attr("id");
// 		this.data[key] = $(target).attr("data-value");
// 		this.updateSaveButton();
// 	}
// 	/**
// 	 * Handler bind to all input event on text input element
// 	 * @param {String} type Text type, define when this function is bind to an event
// 	 * @param {{target: HTMLElement}} param1
// 	 */
// 	verifyText(type, { target }) {
// 		let elem = $(target);
// 		let val = this.trim(elem.val());
// 		this.data[type] = val;

// 		// Update borders
// 		if (val == "" || val == this.oldData[elem.attr("id")]) {
// 			elem.parent().removeClass("valid invalid");
// 		} else if (
// 			type == "username"
// 				? regexp.username.test(val)
// 				: type == "firstname" || type == "lastname"
// 				? regexp.name.test(val)
// 				: type == "email"
// 				? emailRegexp.test(val)
// 				: type == "about"
// 				? val.length <= 1024
// 				: false
// 		)
// 			elem.parent().removeClass("invalid").addClass("valid");
// 		else elem.parent().removeClass("valid").addClass("invalid");

// 		// Update chart counter if text input is "about"
// 		if (elem.attr("id") == "about") this.aboutChartCounter.text(val.length);

// 		this.updateSaveButton();
// 	}
// 	/**
// 	 * Checks whether the page should block refresh or exit.
// 	 * @param {Jquery.Event} e
// 	 */
// 	beforeExiting(e) {
// 		if (this.alertBeforeExiting) return true;
// 		else e = null;
// 	}
// 	showSaveButton() {
// 		if (!this.saveButton.hasClass("hidden")) return;
// 		this.saveButton.removeClass("hidden");
// 	}
// 	hideSaveButton() {
// 		if (this.saveButton.hasClass("hidden")) return;
// 		this.saveButton.addClass("hidden");
// 	}
// 	/**
// 	 * Show or hide the save button
// 	 */
// 	updateSaveButton() {
// 		if (this.isModified()) {
// 			this.alertBeforeExiting = true;
// 			this.showSaveButton();
// 		} else {
// 			this.alertBeforeExiting = false;
// 			this.hideSaveButton();
// 		}
// 	}
// 	/**
// 	 * Request server to save settings, then check if theme should be updated, page should be reloaded or shared list should be updated
// 	 */
// 	async save() {
// 		if (this.saveButton.hasClass("hidden")) return;
// 		let fd = new FormData();
// 		for (let [key, value] of Object.entries(this.data)) {
// 			if (this.dataIsModified(value, this.oldData[key]))
// 				if (value instanceof Array || typeof value == "string" || value instanceof File || typeof value == "boolean")
// 					fd.append(key, value);
// 				else Object.entries(value).forEach(([k, v]) => fd.append(`${key}[${k}]`, v));
// 		}

// 		let res = await SAHYG.Api.post("/settings", fd);
// 		if (!res) return;

// 		SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("SAVE_SUCCESS") }).show();
// 		if (fd.has("locale") || fd.has("avatar")) {
// 			if ((await SAHYG.Components.popup.Popup.confirm("⚠️" + (await SAHYG.translate("SETTING_NEED_RELOAD")))).confirm) {
// 				location.reload();
// 			}
// 		}
// 		if (fd.has("theme")) {
// 			SAHYG.Utils.settings.theme.set(fd.get("theme"), false);
// 		}
// 		let custom = Array.from(fd.entries()).filter(([k, v]) => k.includes("custom"));
// 		if (custom.length) {
// 			$('[data-horizontal-tabs-id="share"] [class*="shareable-custom."]').remove();
// 			custom.forEach(async ([k, v]) => {
// 				k = k.match(/(?<=custom\[).+(?=\])/gm)?.[0];
// 				let i = this.data.shared.findIndex((sharedId) => sharedId == "custom." + k);
// 				if (i != -1) this.data.shared.splice(i);
// 				$("[data-horizontal-tabs-id=share]").append(
// 					SAHYG.oldCreateElement(
// 						"div",
// 						{ class: "setting shareable-custom." + k },
// 						SAHYG.oldCreateElement(
// 							"div",
// 							{ class: "informations" },
// 							SAHYG.oldCreateElement("div", { class: "title" }, (await SAHYG.translate("CUSTOM")) + " : " + k),
// 							SAHYG.oldCreateElement("div", { class: "description" })
// 						),
// 						SAHYG.oldCreateElement(
// 							"div",
// 							{ class: "value" },
// 							SAHYG.oldCreateElement("c-boolean", { value: "false" }, SAHYG.oldCreateElement("c-boolean-circle"))
// 						)
// 					)
// 				);
// 			});
// 		}
// 		this.updateBorders();
// 		this.updateAlert();
// 		this.updateOldData();
// 		this.updateSaveButton();
// 	}
// 	async addAvatar() {
// 		if ($(this).hasClass("disabled")) return true;
// 		let file = await SAHYG.Utils.input.file(".png, .jpeg, .jpg", false);
// 		if (!file) return;
// 		if (file.size > 1000000) return SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("MAX_SIZE_EXCEEDED") }).show();
// 		this.data.avatar = file;
// 		this.currentAvatarContainer.children().remove();
// 		this.currentAvatarContainer.append(SAHYG.oldCreateElement("img", { "data-viewer": true, src: URL.createObjectURL(file), alt: "avatar" }));
// 		$("#avatar-add").addClass("disabled");
// 		$("#avatar-edit, #avatar-remove").removeClass("disabled");
// 		this.updateSaveButton();
// 	}
// 	async removeAvatar() {
// 		if ($(this).hasClass("disabled")) return true;
// 		this.data.avatar = null;
// 		this.currentAvatarContainer.children().remove();
// 		this.currentAvatarContainer.append(SAHYG.oldCreateElement("div", { class: "lafs" }, "\uf007"));
// 		$("#avatar-add").removeClass("disabled");
// 		$("#avatar-edit, #avatar-remove").addClass("disabled");
// 		this.updateSaveButton();
// 	}
// 	/**
// 	 * Handler for boolean button in share category
// 	 * @param {JQuery.Event} event
// 	 */
// 	shareableButton(event) {
// 		let name = $(event.target)
// 			.closest(".setting")
// 			.attr("class")
// 			?.match(/(?<=shareable-)[^\s]+/gim)?.[0];
// 		let value = $(event.target).closest("c-boolean").attr("value");
// 		if (value == "true") this.data.shared.push(name);
// 		else this.data.shared.splice(this.data.shared.indexOf(name));
// 		this.updateSaveButton();
// 		return true;
// 	}
// 	/**
// 	 * Trigger input event on some text input to update their borders
// 	 */
// 	updateBorders() {
// 		$("#username, #firstname, #lastname, #about").trigger("input");
// 	}
// 	/**
// 	 * Enable the exit alert if the settings have been changed, otherwise disable i
// 	 */
// 	updateAlert() {
// 		if (this.isModified()) this.alertBeforeExiting = false;
// 		else this.alertBeforeExiting = false;
// 	}
// };
