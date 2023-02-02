$(function () {
	SAHYG.Classes.Shortener = class Shortener {
		$search = $("container #search");
		$body = $("container .body");
		$refresh = $("container .refresh");
		$count = $("container .count .current");
		$countMax = $("container .count .total");
		constructor() {
			this.loader = SAHYG.Components.loader.replaceContent(this.$body, false);

			this.asyncConstructor();
		}
		async asyncConstructor() {
			this.shortcuts = await SAHYG.Api.get("/shortener/list");

			this.loader.done();

			await Promise.all(this.shortcuts.map(async (shortcut) => this.$body.append(await this.row(shortcut))));

			this.updateCount();

			SAHYG.on("click", "container .row .copy", this.copy.bind(this));
			SAHYG.on("click", "container .row .enable", this.toggle.bind(this));
			SAHYG.on("click", "container .row .edit", this.edit.bind(this));
			SAHYG.on("click", "container .row .remove", this.remove.bind(this));
			SAHYG.on("click", "container .new", this.add.bind(this));
			SAHYG.on("click", this.$refresh, this.refresh.bind(this));
			SAHYG.on("input", this.$search, this.search.bind(this));
		}
		copy({ target }) {
			navigator.clipboard.writeText($(target).closest(".row").find(".url a").attr("href")).then(async () => {
				SAHYG.Components.toast.Toast.success({
					message: await SAHYG.translate("COPIED"),
				}).show();
			});
			return false;
		}
		toggle({ target }) {
			let row = $(target).closest(".row");
			let name = row.attr("data-name");
			let shortcut = this.shortcuts.find((shortcut) => shortcut.name == name);
			SAHYG.Api.post("/shortener/" + (shortcut.enabled ? "disable" : "enable"), { name })
				.then(async () => {
					let button = row.find(".enable btn");
					if (shortcut.enabled) button.removeClass("enabled").addClass("disabled").html("&#xf0c8;");
					else button.removeClass("disabled").addClass("enabled").html("&#xf14a;");

					shortcut.enabled = !shortcut.enabled;

					SAHYG.Components.toast.Toast.success({
						message: await SAHYG.translate("UPDATE_SUCCESS"),
					}).show();
				})
				.catch(() => {});
			return false;
		}
		async refresh() {
			this.$body.children().remove();
			this.loader = SAHYG.Components.loader.replaceContent(this.$body, false);

			this.shortcuts = await SAHYG.Api.get("/shortener/list");

			this.loader.done();

			await Promise.all(this.shortcuts.map(async (shortcut) => this.$body.append(await this.row(shortcut))));

			this.updateCount();

			SAHYG.Components.toast.Toast.success({
				message: await SAHYG.translate("REFRESHED"),
			}).show();
		}
		async row({ enabled, name, target, clicked }) {
			return SAHYG.createElement(
				"div",
				{ class: "row", "data-name": name },
				SAHYG.createElement(
					"div",
					{ class: "cell enable" },
					SAHYG.createElement(
						"btn",
						{ class: enabled ? "enabled" : "disabled", "data-tooltip": await SAHYG.translate("ENABLE/DISABLE") },
						enabled ? "&#xf14a;" : "&#xf0c8;"
					)
				),
				SAHYG.createElement(
					"div",
					{ class: "cell url" },
					SAHYG.createElement("a", { href: `https://${location.host}/s/${name}`, target: "_blank" }, `https://${location.host}/s/${name}`)
				),
				SAHYG.createElement("div", { class: "cell target" }, SAHYG.createElement("a", { href: target, target: "_blank" }, target)),
				SAHYG.createElement("div", { class: "cell clicked" }, clicked),
				SAHYG.createElement(
					"div",
					{ class: "cell commands" },
					SAHYG.createElement("btn", { class: "copy", "data-tooltip": await SAHYG.translate("COPY_URL") }, "&#xf0c5;"),
					SAHYG.createElement("btn", { class: "edit", "data-tooltip": await SAHYG.translate("EDIT") }, "&#xf304;"),
					SAHYG.createElement("btn", { class: "remove", "data-tooltip": await SAHYG.translate("REMOVE") }, "&#xf2ed;")
				)
			);
		}
		async add() {
			SAHYG.Components.popup.Popup.input(await SAHYG.translate("ADD"), [
				{
					name: "name",
					label: await SAHYG.translate("NAME"),
					placeholder: await SAHYG.translate("NAME"),
					type: "text",
					defaultValue: Math.random().toString(16).substring(2, 12),
				},
				{
					name: "target",
					label: await SAHYG.translate("TARGET"),
					placeholder: await SAHYG.translate("TARGET"),
					type: "url",
					defaultValue: "",
				},
			]).then((data) => {
				if (!data) return;
				SAHYG.Api.post("/shortener/add", {
					name: data.name,
					target: data.target,
				})
					.then(async () => {
						this.$body.append(await this.row({ name: data.name, target: data.target, enabled: true, clicked: 0 }));
						this.updateCount();

						SAHYG.Components.toast.Toast.success({
							message: await SAHYG.translate("ADD_SUCCESS"),
						}).show();
					})
					.catch(() => {});
			});
		}
		async edit({ target }) {
			let row = $(target).closest(".row");
			let name = row.attr("data-name");
			let shortcut = this.shortcuts.find((shortcut) => shortcut.name == name);
			SAHYG.Components.popup.Popup.input(await SAHYG.translate("EDIT"), [
				{
					name: "name",
					label: await SAHYG.translate("NAME"),
					placeholder: await SAHYG.translate("NAME"),
					type: "text",
					defaultValue: shortcut.name,
				},
				{
					name: "target",
					label: await SAHYG.translate("TARGET"),
					placeholder: await SAHYG.translate("TARGET"),
					type: "url",
					defaultValue: shortcut.target,
				},
			]).then((data) => {
				if (!data) return;
				SAHYG.Api.post("/shortener/edit", {
					name: data.name,
					target: data.target,
					oldName: shortcut.name,
				})
					.then(async () => {
						await this.updateRow(row, { enabled: shortcut.enabled, target: data.target, name: data.name, clicked: shortcut.clicked });

						SAHYG.Components.toast.Toast.success({
							message: await SAHYG.translate("UPDATE_SUCCESS"),
						}).show();
					})
					.catch(() => {});
			});
		}
		async updateRow(row, { enabled, name, target, clicked }) {
			row.html((await this.row({ enabled, name, target, clicked })).html());
		}
		async remove({ target }) {
			let row = $(target).closest(".row");
			let name = row.attr("data-name");
			let shortcut = this.shortcuts.find((shortcut) => shortcut.name == name);
			let shortcutIndex = this.shortcuts.findIndex((shortcut) => shortcut.name == name);

			SAHYG.Components.popup.Popup.confirm(
				await SAHYG.translate("CONFIRM_DELETE_SHORTCUT", {
					name: name,
				})
			).then(({ confirm }) => {
				if (!confirm) return;

				SAHYG.Api.post("/shortener/delete", {
					name: shortcut.name,
					target: shortcut.target,
				})
					.then(async () => {
						this.shortcuts.splice(shortcutIndex, 1);
						row.remove();
						this.updateCount();

						SAHYG.Components.toast.Toast.success({
							message: await SAHYG.translate("DELETE_SUCCESS"),
						}).show();
					})
					.catch(() => {});
			});
		}
		async search() {
			this.$body.children().remove();
			this.loader = SAHYG.Components.loader.replaceContent(this.$body, false);

			let search = this.$search.val();
			let shortcuts = this.shortcuts.filter((shortcut) => shortcut.name.includes(search) || shortcut.target.includes(search));

			this.loader.done();

			await Promise.all(shortcuts.map(async (shortcut) => this.$body.append(await this.row(shortcut))));

			this.updateCount();
		}
		updateCount() {
			this.$count.text(this.$body.children().length);
			this.$countMax.text(this.shortcuts.length);
		}
	};
	SAHYG.Instances.Shortener = new SAHYG.Classes.Shortener();
});
// ANCHOR update counter
function updateCount() {
	$("container .count .current").text($("container .row:not(.header):visible").length);
	$("container .count .total").text($("container .row:not(.header)").length);
}
