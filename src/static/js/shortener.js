SAHYG.Classes.Shortener = class Shortener {
	$search = SAHYG.$0("container #search");
	$body = SAHYG.$0("container .body");
	$refresh = SAHYG.$0("container .refresh");
	$count = SAHYG.$0("container .count .current");
	$countMax = SAHYG.$0("container .count .total");
	$new = SAHYG.$0("container .new");
	constructor() {
		this.loader = SAHYG.Components.loader.center();

		this.asyncConstructor();
	}
	async asyncConstructor() {
		this.shortcuts = await SAHYG.Api.get("/shortener/list");

		this.loader.remove();

		await Promise.all(this.shortcuts.map(async (shortcut) => this.$body.append(await this.row(shortcut))));

		this.updateCount();

		this.$new.on("click", this.add.bind(this));
		this.$refresh.on("click", this.refresh.bind(this));
		this.$search.on("input", this.search.bind(this));
	}
	copy({ target }) {
		navigator.clipboard.writeText(target.closest(".row").$0(".url a").getAttribute("href")).then(async () => {
			SAHYG.Components.toast.Toast.success({
				message: await SAHYG.translate("COPIED"),
			}).show();
		});
		return false;
	}
	toggle({ target }) {
		let row = target.closest(".row");
		let name = row.getAttribute("data-name");
		let shortcut = this.shortcuts.find((shortcut) => shortcut.name == name);
		SAHYG.Api.post("/shortener/" + (shortcut.enabled ? "disable" : "enable"), { name })
			.then(async () => {
				let button = row.$0(".enable btn");
				if (shortcut.enabled) button.removeClass("enabled").addClass("disabled").innerHTML = "\uf0c8";
				else button.removeClass("disabled").addClass("enabled").innerHTML = "\uf14a";

				shortcut.enabled = !shortcut.enabled;

				SAHYG.Components.toast.Toast.success({
					message: await SAHYG.translate("UPDATE_SUCCESS"),
				}).show();
			})
			.catch(console.error);
		return false;
	}
	async refresh() {
		this.$body.children.remove();
		this.loader = SAHYG.Components.loader.center();

		this.shortcuts = await SAHYG.Api.get("/shortener/list");

		this.loader.remove();

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
					enabled ? "\uf14a" : "\uf0c8"
				).on("click", this.toggle.bind(this))
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
				SAHYG.createElement("btn", { class: "copy", "data-tooltip": await SAHYG.translate("COPY_URL") }, "\uf0c5").on(
					"click",
					this.copy.bind(this)
				),
				SAHYG.createElement("btn", { class: "edit", "data-tooltip": await SAHYG.translate("EDIT") }, "\uf304").on(
					"click",
					this.edit.bind(this)
				),
				SAHYG.createElement("btn", { class: "remove", "data-tooltip": await SAHYG.translate("REMOVE") }, "\uf2ed").on(
					"click",
					this.remove.bind(this)
				)
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
					this.shortcuts.push({ name: data.name, target: data.target, enabled: true, clicked: 0 });
					this.$body.append(await this.row({ name: data.name, target: data.target, enabled: true, clicked: 0 }));
					this.updateCount();

					SAHYG.Components.toast.Toast.success({
						message: await SAHYG.translate("ADD_SUCCESS"),
					}).show();
				})
				.catch(console.error);
		});
	}
	async edit({ target }) {
		let row = target.closest(".row");
		let name = row.getAttribute("data-name");
		let shortcut = this.shortcuts.find((shortcut) => shortcut.name == name);
		if (!shortcut) return;

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
				.catch(console.error);
		});
	}
	async updateRow(row, { enabled, name, target, clicked }) {
		row.innerHTML = (await this.row({ enabled, name, target, clicked })).innerHTML;
	}
	async remove({ target }) {
		console.log(target)
		let row = target.closest(".row");
		let name = row.getAttribute("data-name");
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
				.catch(console.error);
		});
	}
	async search() {
		this.$body.children.remove();

		let search = this.$search.value;
		let shortcuts = this.shortcuts.filter((shortcut) => shortcut.name.includes(search) || shortcut.target.includes(search));

		await Promise.all(shortcuts.map(async (shortcut) => this.$body.append(await this.row(shortcut))));

		this.updateCount();
	}
	updateCount() {
		this.$count.textContent = this.$body.children.length;
		this.$countMax.textContent = this.shortcuts.length;
	}
};

SAHYG.onload(() => (SAHYG.Instances.Shortener = new SAHYG.Classes.Shortener()));
