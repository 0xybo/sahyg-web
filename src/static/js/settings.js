SAHYG.Classes.Settings = class Settings {
	$tabs = SAHYG.$0("#tab");

	needReloadList = ["username", "email", "locale"];

	constructor() {
		this.init();
	}
	async init() {
		let loader = SAHYG.createElement("sahyg-loader");
		await this.fetch();
		loader.remove();

		for (let setting of this.settings) {
			let $category = SAHYG.$0(`[sahyg-tab="${setting.category}"]`);
			if (!$category) continue;

			await this.appendSettingElement(setting, $category);
		}

		this.$saveButton = SAHYG.createElement("sahyg-button", {
			fullColor: true,
			fullWidth: true,
			id: "save-button",
			value: await SAHYG.translate("SAVE"),
			disabled: true,
		}).on("click", this.save.bind(this));
		this.$needReload = SAHYG.createElement(
			"span",
			{
				class: "need-reload lafs",
				tooltip: await SAHYG.translate("SETTING_NEED_RELOAD"),
			},
			"\uf2f9"
		);
		this.unsavedIcons = SAHYG.$("#tab > .tabs-container [tab-id]").map((tab) => {
			let icon = SAHYG.createElement(
				"div",
				{
					class: "unsaved-icon hidden",
				},
				String.fromCharCode(0xf0c7)
			);
			tab.append(icon);
			return { category: tab.getAttribute("tab-id"), $: icon };
		});

		this.$tabs.$0(".tabs").append(SAHYG.createElement("div", { class: "icons" }, this.$needReload), this.$saveButton);

		SAHYG.$0("#password_save_button")?.on("click", this.savePassword.bind(this));

		addEventListener("beforeunload", async (event) => {
			if (!this.unsavedSettings) return;
			event.preventDefault();
			return (event.returnValue = "");
		});
	}
	async appendSettingElement(setting, parent) {
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
						SAHYG.createElement("div", { class: "title" }, setting.title, setting.needReload && (await this.appendNeedReloadIcon())),
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
						}).on("input", this.selectInputHandler.bind(this))
					)
				);
				break;
			}
			case "text": {
				setting.$ = SAHYG.createElement(
					"div",
					{ class: "setting" },
					SAHYG.createElement(
						"div",
						{ class: "informations" },
						SAHYG.createElement("div", { class: "title" }, setting.title, setting.needReload && (await this.appendNeedReloadIcon())),
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
							.on("input", this.textInputHandler.bind(this, setting.id))
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
							src: setting.value ? location.origin + "/resources/avatar/" + SAHYG.Constants.USERNAME : "",
						}))
					),
					SAHYG.createElement(
						"div",
						{ class: "panel" },
						SAHYG.createElement("span", { class: "title" }, await SAHYG.translate("PROFILE_PICTURE")),
						SAHYG.createElement(
							"div",
							{ class: "buttons" },
							(this.$addAvatar = SAHYG.createElement("sahyg-button", {
								fullColor: true,
								disabled: Boolean(setting.value),
								id: "add-avatar",
								value: await SAHYG.translate("ADD"),
							}).on("click", this.addAvatarHandler.bind(this))),
							(this.$editAvatar = SAHYG.createElement("sahyg-button", {
								fullColor: true,
								disabled: !setting.value,
								id: "edit-avatar",
								value: await SAHYG.translate("EDIT"),
							}).on("click", this.editAvatarHandler.bind(this))),
							(this.$removeAvatar = SAHYG.createElement("sahyg-button", {
								fullColor: true,
								disabled: !setting.value,
								id: "remove-avatar",
								value: await SAHYG.translate("REMOVE"),
							}).on("click", this.removeAvatarHandler.bind(this)))
						),
						SAHYG.createElement("span", { class: "informations" }, await SAHYG.translate("SETTINGS_AVATAR_INFOS"))
					)
				);
				parent.$0(".tab-title").insertAdjacentElement("afterend", setting.$);
				return;
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
							outline: true,
							rounded: true,
							multiline: true,
							dynamicHeight: false,
							characterCounter: true,
							placeholder: setting.title,
							defaultValue: setting.value,
							minHeight: 100,
							maxLength: 1024,
							resize: "vertical",
							...(!setting.editable ? { disabled: true } : {}),
						}).on("input", this.textInputHandler.bind(this, setting.id))
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
						}).on("input", this.arrayInputHandler.bind(this, setting.id))
					)
				);
				break;
			}
			case "section": {
				setting.$ = SAHYG.createElement(
					"sahyg-collapsable",
					{ class: "section", name: setting.title, description: setting.description, collapsed: false },
					(setting.$body = SAHYG.createElement("div", { class: "section-content" }))
				);
				for (let sectionChild of setting.content) {
					await this.appendSettingElement(sectionChild, setting.$body);
				}
				break;
			}
			case "button": {
				setting.$ = SAHYG.createElement("sahyg-button", {
					id: setting.id,
					content: setting.title,
					fullWidth: true,
					fullColor: true,
					disabled: setting.id.includes("save"),
				});
			}
		}
		parent.append(setting.$);
	}
	async appendNeedReloadIcon() {
		return SAHYG.createElement(
			"span",
			{
				class: "need-reload lafs",
				tooltip: await SAHYG.translate("SETTING_NEED_RELOAD"),
			},
			"\uf2f9"
		);
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
	async save() {
		let fd = {};

		for (let setting of this.settings.filter((s) => s.type !== "button")) {
			if (await this.isModified(setting.id)) fd[setting.id] = setting.value;
			// if (
			// 	setting.value instanceof Array ||
			// 	typeof setting.value == "string" ||
			// 	setting.value instanceof File ||
			// 	typeof setting.value == "boolean"
			// )
			// else Object.entries(setting.value).forEach(([k, v]) => fd.append(`${setting.id}[${k}]`, v));
		}

		// if (!Array.from(fd).length) return;
		if (!Object.keys(fd).length) return;

		SAHYG.Api.post(location.pathname + "/set", fd)
			.then(async (res) => {
				if (!res?.success) return;

				SAHYG.createElement("sahyg-toast", { type: "success", content: await SAHYG.translate("SAVED") }).show();

				// update Settings value
				for (let [name, value] of Object.entries(fd)) {
					let setting = this.settings.find(s => s.id === name)
					setting.value = value
				}

				this.unsavedSettings = false;
				// update icons
				this.updateNeedReloadIcon()
				this.updateCategoryUnsavedIcon()
			})
			.catch(console.error);
	}
	async savePassword() {
		let section = this.settings.find((set) => set.id == "change_password"),
			newPassword = section.content.find((s) => s.id == "new_password").value,
			confirmPassword = section.content.find((s) => s.id == "new_password_confirmation").value,
			currentPassword = section.content.find((s) => s.id == "current_password").value;

		if (!newPassword || !confirmPassword || !currentPassword) return;
		if (newPassword !== confirmPassword) return;

		let response = await SAHYG.Api.post(location.pathname + "/password", {
			current: currentPassword,
			new: newPassword,
		});
		if (!response?.success) return;

		SAHYG.createElement("sahyg-toast", { type: "success", content: await SAHYG.translate("SAVED") }).show();
	}
	async isModified(name) {
		if (!name) return (await Promise.all(this.settings.filter((s) => s.type !== "button").map((s) => this.isModified(s.id)))).includes(true);

		let currentValue = this.settings.find((setting) => setting.id === name)?.value,
			oldValue = this.savedSettings.find((setting) => setting.id === name)?.value;

		if (typeof currentValue === "string" || !currentValue) return currentValue !== oldValue;
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

		if (!(await this.isModified(setting.id)) && !forceSave) {
			setting.isModified = false;
			if (!(await this.isModified())) {
				this.unsavedSettings = false;
				this.disableSaveButton();
				this.updateNeedReloadIcon();
				this.updateCategoryUnsavedIcon();
			}
		} else {
			setting.isModified = true;
			this.unsavedSettings = true;
			this.enableSaveButton();
			this.updateNeedReloadIcon();
			this.updateCategoryUnsavedIcon();
		}
	}
	enableSaveButton() {
		this.$saveButton.removeAttribute("disabled");
	}
	disableSaveButton() {
		this.$saveButton.setAttribute("disabled", true);
	}
	updateNeedReloadIcon() {
		if (this.settings.filter((s) => s.needReload && s.isModified).length) this.$needReload.addClass("needed");
		else this.$needReload.removeClass("needed");
	}
	updateCategoryUnsavedIcon() {
		this.unsavedIcons.forEach(({ category, $ }) => {
			if (this.settings.filter((s) => s.category === category && s.isModified).length) $.removeClass("hidden");
			else $.addClass("hidden");
		});
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
	selectInputHandler({ target }) {
		let setting = this.settings.find((setting) => setting.id == target.id && setting.type.startsWith("select"));
		if (!setting) return;

		if (target.id == "theme") SAHYG.Utils.settings.theme.set(target.selected[0], false);
		else if (target.id == "locale") SAHYG.Utils.settings.locale.set(target.selected[0], false, false);

		this.setSetting(setting.id, setting.type == "selectOne" ? target.selected[0] : target.selected);
	}
	textInputHandler(name, event) {
		if (event.target.hasClass("invalid")) return;

		this.setSetting(name, event.target.value);
	}
	async addAvatarHandler({ target }) {
		if (!this.$avatar || target.hasClass("disabled")) return;

		let file = await SAHYG.Utils.input.file(".png, .jpeg, .jpg", false);
		if (!file) return;
		file = await this.crop(file);
		if (!file) return;

		if (file.size > SAHYG.Constants.settings_max_avatar_size)
			return SAHYG.createElement("sahyg-toast", { type: "error", content: await SAHYG.translate("MAX_SIZE_EXCEEDED") }).show();
		this.newAvatar = file;
		this.setSetting("avatar", file, true);

		this.$avatar.setAttribute("src", URL.createObjectURL(file));

		this.$addAvatar?.addClass("disabled");
		SAHYG.$(this.$editAvatar, this.$removeAvatar).removeClass("disabled");
	}
	async editAvatarHandler({ target }) {
		if (!this.$avatar || target.hasClass("disabled")) return;

		let file = await SAHYG.Utils.input.file(".png, .jpeg, .jpg", false);
		if (!file) return;
		file = await this.crop(file);
		if (!file) return;

		if (file.size > SAHYG.Constants.settings_max_avatar_size)
			return SAHYG.createElement("sahyg-toast", { type: "error", content: await SAHYG.translate("MAX_SIZE_EXCEEDED") }).show();
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
	async removeAvatarHandler({ target }) {
		if (!this.$avatar || target.hasClass("disabled")) return;

		this.newAvatar = null;
		this.setSetting("avatar", false);

		this.$avatar.removeAttribute("src");

		this.$addAvatar?.removeClass("disabled");
		SAHYG.$(this.$editAvatar, this.$removeAvatar).addClass("disabled");
	}
	async arrayInputHandler(name, { target }) {
		this.setSetting(name, target.value);
	}
};

SAHYG.onload(() => (SAHYG.Instances.Settings = new SAHYG.Classes.Settings()));
