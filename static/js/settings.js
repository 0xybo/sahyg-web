$(() => {
	let regexp = {
		username: /^[a-z0-9_]{3,10}$/,
		name: /[a-z\\s]/g,
		email: /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/i,
	};
	SAHYG.Classes.Settings = class Settings {
		constructor() {
			this.modified = false;
			this.alertBeforeExiting = false;
			this.data = {
				// get data from HTML
				theme: $("#theme").attr("data-value"),
				locale: $("#locale").attr("data-value"),
				username: $("#username").val(),
				firstname: $("#firstname").val(),
				lastname: $("#lastname").val(),
				email: $("#email").val(),
				about: $("#about").val(),
				custom: Object.fromEntries(
					$(".custom c-input-array")
						.data("rows")
						?.map((row) => [row.values.customLinkName, row.values.customLinkValue]) || []
				),
				shared: $("[class*=shareable-] c-boolean")
					.toArray()
					.map((elem) =>
						$(elem).attr("value") == "true"
							? $(elem)
									.closest(".setting")
									.attr("class")
									?.match(/(?<=shareable-)[^\s]+/gim)?.[0]
							: null
					)
					.filter(Boolean),
			};
			this.data.avatar = Boolean($(".avatar .current").find("img").length);
			this.updateOldData();
			this.aboutChartCounter = $("container [data-horizontal-tabs-id=profile] .about .chart-counter");
			this.saveButton = $("container .save-button");
			this.currentAvatarContainer = $("container .avatar .current");

			SAHYG.on("input", "#username", this.verifyText.bind(this, "username"));
			SAHYG.on("input", "#firstname", this.verifyText.bind(this, "firstname"));
			SAHYG.on("input", "#lastname", this.verifyText.bind(this, "lastname"));
			SAHYG.on("input", "#about", this.verifyText.bind(this, "about"));
			SAHYG.on("input", ".custom c-input-array", this.customInput.bind(this));
			SAHYG.on("input", "#theme", this.selectInput.bind(this));
			SAHYG.on("input", "#locale", this.selectInput.bind(this));
			SAHYG.on("click", "#avatar-add", this.addAvatar.bind(this));
			SAHYG.on("click", "#avatar-edit", this.addAvatar.bind(this));
			SAHYG.on("click", "#avatar-remove", this.removeAvatar.bind(this));
			SAHYG.on("click", '[class*="shareable-"] c-boolean', this.shareableButton.bind(this));

			SAHYG.on("beforeunload", window, this.beforeExiting.bind(this));
			SAHYG.on("click", this.saveButton, this.save.bind(this));
		}
		updateOldData() {
			let _ = (data) => {
				if (!data) return false;
				if (data instanceof Array) return data.map(_);
				if (typeof data == "string") return data.trim();
				if (data instanceof File) return data;
				if (typeof data == "object") return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, _(v)]));
				return data;
			};
			this.oldData = _(this.data);
		}
		trim(val) {
			return typeof val == "string" ? val.trim() : val;
		}
		/**
		 * Recursive function for isModified function
		 * @param {Object} current
		 * @param {Object} old
		 * @returns {Boolean}
		 */
		dataIsModified(current, old) {
			if (typeof current == "string" || current instanceof File || typeof current == "boolean") return this.trim(current) != this.trim(old);
			if (current instanceof Array) return current.length == old.length ? !current.every((k, i) => this.trim(old[i]) == this.trim(k)) : true;
			let currentEntries = Object.entries(current);
			let oldEntries = Object.entries(old);
			return currentEntries.length == oldEntries.length ? currentEntries.some(([k, v]) => this.dataIsModified(v, old[k])) : true;
		}
		/**
		 * Checks if the current values (this.data) is unequal to the old values (this.oldData).
		 * @returns {Boolean}
		 */
		isModified() {
			return (this.modified = this.dataIsModified(this.data, this.oldData));
		}
		/**
		 * Handler for input event on the custom information list
		 * @param {{target: HTMLElement}} param0
		 */
		customInput({ target }) {
			this.data.custom = Object.fromEntries(
				$(target)
					.data("rows")
					?.map((row) => [row.values.customLinkName, row.values.customLinkValue]) || []
			);
			this.updateSaveButton();
		}
		/**
		 * Handler for input event on any select
		 * @param {{target: HTMLElement}} param0
		 */
		selectInput({ target }) {
			let key = $(target).attr("id");
			this.data[key] = $(target).attr("data-value");
			this.updateSaveButton();
		}
		/**
		 * Handler bind to all input event on text input element
		 * @param {String} type Text type, define when this function is bind to an event
		 * @param {{target: HTMLElement}} param1
		 */
		verifyText(type, { target }) {
			let elem = $(target);
			let val = this.trim(elem.val());
			this.data[type] = val;

			// Update borders
			if (val == "" || val == this.oldData[elem.attr("id")]) {
				elem.parent().removeClass("valid invalid");
			} else if (
				type == "username"
					? regexp.username.test(val)
					: type == "firstname" || type == "lastname"
					? regexp.name.test(val)
					: type == "email"
					? emailRegexp.test(val)
					: type == "about"
					? val.length <= 1024
					: false
			)
				elem.parent().removeClass("invalid").addClass("valid");
			else elem.parent().removeClass("valid").addClass("invalid");

			// Update chart counter if text input is "about"
			if (elem.attr("id") == "about") this.aboutChartCounter.text(val.length);

			this.updateSaveButton();
		}
		/**
		 * Checks whether the page should block refresh or exit.
		 * @param {Jquery.Event} e
		 */
		beforeExiting(e) {
			if (this.alertBeforeExiting) return true;
			else e = null;
		}
		showSaveButton() {
			if (!this.saveButton.hasClass("hidden")) return;
			this.saveButton.removeClass("hidden");
		}
		hideSaveButton() {
			if (this.saveButton.hasClass("hidden")) return;
			this.saveButton.addClass("hidden");
		}
		/**
		 * Show or hide the save button
		 */
		updateSaveButton() {
			if (this.isModified()) {
				this.alertBeforeExiting = true;
				this.showSaveButton();
			} else {
				this.alertBeforeExiting = false;
				this.hideSaveButton();
			}
		}
		/**
		 * Request server to save settings, then check if theme should be updated, page should be reloaded or shared list should be updated
		 */
		async save() {
			if (this.saveButton.hasClass("hidden")) return;
			let fd = new FormData();
			for (let [key, value] of Object.entries(this.data)) {
				if (this.dataIsModified(value, this.oldData[key]))
					if (value instanceof Array || typeof value == "string" || value instanceof File || typeof value == "boolean")
						fd.append(key, value);
					else Object.entries(value).forEach(([k, v]) => fd.append(`${key}[${k}]`, v));
			}

			let res = await SAHYG.Api.post("/settings", fd);
			if (!res) return;
			
			SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("SAVE_SUCCESS") }).show();
			if (fd.has("locale") || fd.has("avatar")) {
				if ((await SAHYG.Components.popup.Popup.confirm("⚠️" + (await SAHYG.translate("SETTING_NEED_RELOAD")))).confirm) {
					location.reload();
				}
			}
			if (fd.has("theme")) {
				SAHYG.Utils.settings.theme.set(fd.get("theme"), false);
			}
			let custom = Array.from(fd.entries()).filter(([k, v]) => k.includes("custom"));
			if (custom.length) {
				$('[data-horizontal-tabs-id="share"] [class*="shareable-custom."]').remove();
				custom.forEach(async ([k, v]) => {
					k = k.match(/(?<=custom\[).+(?=\])/gm)?.[0];
					let i = this.data.shared.findIndex((sharedId) => sharedId == "custom." + k);
					if (i != -1) this.data.shared.splice(i);
					$("[data-horizontal-tabs-id=share]").append(
						SAHYG.createElement(
							"div",
							{ class: "setting shareable-custom." + k },
							SAHYG.createElement(
								"div",
								{ class: "informations" },
								SAHYG.createElement("div", { class: "title" }, (await SAHYG.translate("CUSTOM")) + " : " + k),
								SAHYG.createElement("div", { class: "description" })
							),
							SAHYG.createElement(
								"div",
								{ class: "value" },
								SAHYG.createElement("c-boolean", { value: "false" }, SAHYG.createElement("c-boolean-circle"))
							)
						)
					);
				});
			}
			this.updateBorders();
			this.updateAlert();
			this.updateOldData();
			this.updateSaveButton();
		}
		async addAvatar() {
			if ($(this).hasClass("disabled")) return true;
			let file = await SAHYG.Utils.input.file(".png, .jpeg, .jpg", false);
			if (!file) return;
			if (file.size > 1000000) return SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("MAX_SIZE_EXCEEDED") }).show();
			this.data.avatar = file;
			this.currentAvatarContainer.children().remove();
			this.currentAvatarContainer.append(SAHYG.createElement("img", { "data-viewer": true, src: URL.createObjectURL(file), alt: "avatar" }));
			$("#avatar-add").addClass("disabled");
			$("#avatar-edit, #avatar-remove").removeClass("disabled");
			this.updateSaveButton();
		}
		async removeAvatar() {
			if ($(this).hasClass("disabled")) return true;
			this.data.avatar = null;
			this.currentAvatarContainer.children().remove();
			this.currentAvatarContainer.append(SAHYG.createElement("div", { class: "lafs" }, "&#xf007;"));
			$("#avatar-add").removeClass("disabled");
			$("#avatar-edit, #avatar-remove").addClass("disabled");
			this.updateSaveButton();
		}
		/**
		 * Handler for boolean button in share category
		 * @param {JQuery.Event} event
		 */
		shareableButton(event) {
			let name = $(event.target)
				.closest(".setting")
				.attr("class")
				?.match(/(?<=shareable-)[^\s]+/gim)?.[0];
			let value = $(event.target).closest("c-boolean").attr("value");
			if (value == "true") this.data.shared.push(name);
			else this.data.shared.splice(this.data.shared.indexOf(name));
			this.updateSaveButton();
			return true;
		}
		/**
		 * Trigger input event on some text input to update their borders
		 */
		updateBorders() {
			$("#username, #firstname, #lastname, #about").trigger("input");
		}
		/**
		 * Enable the exit alert if the settings have been changed, otherwise disable i
		 */
		updateAlert() {
			if (this.isModified()) this.alertBeforeExiting = false;
			else this.alertBeforeExiting = false;
		}
	};

	SAHYG.Instances.settings = new SAHYG.Classes.Settings();
});
