SAHYG.Classes.Shortener = class Shortener {
	$array = SAHYG.$0("container sahyg-input-array");
	constructor() {
		this.asyncConstructor();
	}
	async asyncConstructor() {
		await this.loadShortcuts();

		this.$refresh = SAHYG.createElement("sahyg-button", {
			content: await SAHYG.translate("REFRESH"),
			icon: String.fromCharCode(0xf2f9),
		}).on("click", this.refresh.bind(this));
		SAHYG.$0(".container > .buttons", this.$array.shadowRoot)?.append(this.$refresh);

		this.$array.on("change", async (event) => {
			if (this.isLoading) return;
			switch (event.action) {
				case "add": {
					let shortcut = {
						name: SAHYG.Utils.createRandomId(),
						clicked: "0",
					};
					this.shortcuts.push(shortcut);
					this.edit(
						this.$array.rows.find((row) => row.id === event.editedRow),
						shortcut
					);
					break;
				}
				case "clear": {
					let response = await SAHYG.Api.post(location.pathname + "/clear");
					if (!response?.success) break;

					SAHYG.createElement("sahyg-toast", {
						type: "success",
						content: await SAHYG.translate("SUCCESS_CLEAR_SHORTCUTS", { count: response?.content?.deletedCount || "" }),
					}).show();
				}
			}
		});
	}
	async loadShortcuts() {
		this.isLoading = true;
		this.loader = SAHYG.Components.Loader.center();

		this.shortcuts = (await SAHYG.Api.get(location.pathname + "/list"))?.content;

		if (!this.shortcuts) return;

		this.loader.remove();

		for (let shortcut of this.shortcuts) {
			await this.addRow(shortcut);
		}
		this.isLoading = false;
	}
	async addRow(shortcut) {
		shortcut.url = `https://${location.host}/s/${shortcut.name}`;

		let row = await this.$array.addRow({
			clicked: String(shortcut.clicked),
			target: shortcut.target,
			url: shortcut.url,
		});
		row.shortcut = shortcut;

		row.$enableButton = row.$.$0('[button-id="enable"]');
		row.$enableButton.setAttribute("icon", shortcut.enabled ? String.fromCharCode(0xf14a) : String.fromCharCode(0xf0c8));
		row.$enableButton.on("click", this.toggle.bind(this, row, shortcut));

		row.$copy = row.$.$0('[button-id="copy"]');
		row.$copy.on("click", this.copy.bind(this, shortcut.url));

		row.$edit = row.$.$0('[button-id="edit"]');
		row.$edit.on("click", this.edit.bind(this, row, shortcut));

		row.$remove = row.$.$0('[button-id="remove"]');
		row.$remove.on("click", this.remove.bind(this, row, shortcut));
	}
	copy(url) {
		navigator.clipboard.writeText(url).then(async () => {
			SAHYG.createElement("sahyg-toast", { type: "success", content: await SAHYG.translate("COPIED") }).show();
		});
		return false;
	}
	toggle(row, shortcut) {
		SAHYG.Api.post("/shortener/" + (shortcut.enabled ? "disable" : "enable"), { name: shortcut.name })
			.then(async () => {
				row.$enableButton.setAttribute("icon", !shortcut.enabled ? String.fromCharCode(0xf14a) : String.fromCharCode(0xf0c8));

				shortcut.enabled = !shortcut.enabled;

				SAHYG.createElement("sahyg-toast", {
					type: "success",
					content: await SAHYG.translate("UPDATE_SUCCESS"),
				}).show();
			})
			.catch(console.error);
		return false;
	}
	async edit(row, shortcut) {
		let dialog = SAHYG.createElement("sahyg-input-dialog", {
			inputs: [
				{
					type: "text",
					id: "name",
					label: await SAHYG.translate("NAME"),
					defaultValue: shortcut.name || null,
					options: {
						placeholder: await SAHYG.translate("NAME"),
						borderBottom: true,
					},
				},
				{
					type: "text",
					id: "target",
					label: await SAHYG.translate("TARGET"),
					defaultValue: shortcut.target || null,
					options: {
						placeholder: await SAHYG.translate("TARGET"),
						borderBottom: true,
						type: "url",
					},
				},
			],
		});

		let result = await dialog.show().toPromise();

		if (!result) {
			if (!shortcut.target) this.$array.removeRow(row.id);
			return;
		}

		let response;
		if (!shortcut.target)
			response = await SAHYG.Api.post(location.pathname + "/add", {
				name: result.data.name,
				target: result.data.target,
			});
		else
			response = await SAHYG.Api.post(location.pathname + "/edit", {
				name: result.data.name,
				target: result.data.target,
				oldName: shortcut.name,
			});

		if (!response?.success) {
			if (!shortcut.target) this.$array.removeRow(row.id);
			return;
		}

		shortcut.name = result.data.name;
		shortcut.target = result.data.target;
		shortcut.url = `https://${location.host}/s/${shortcut.name}`;
		shortcut.clicked = String(shortcut.clicked);

		this.updateRow(row, shortcut);

		SAHYG.createElement("sahyg-toast", {
			type: "success",
			content: await SAHYG.translate(shortcut.name ? "SAVE_SUCCESS" : "ADD_SUCCESS"),
		}).show();
	}
	async updateRow(row, shortcut) {
		if (row.values.url !== shortcut.url) this.$array.updateCell(row.id, "url", shortcut.url);
		if (row.values.target !== shortcut.target) this.$array.updateCell(row.id, "target", shortcut.target);
		if (row.values.clicked !== shortcut.clicked) this.$array.updateCell(row.id, "clicked", shortcut.clicked);

		console.log(
			row.values,
			shortcut,
			row.values.url !== shortcut.url,
			row.values.target !== shortcut.target,
			row.values.clicked !== shortcut.clicked
		);
	}
	async refresh() {
		if (this.isLoading) return;
		this.isLoading = true;

		await this.$array.clearRows(true);
		await this.loadShortcuts();

		SAHYG.createElement("sahyg-toast", { type: "success", content: await SAHYG.translate("REFRESHED") }).show();
	}
	async remove(row, shortcut) {
		let confirm = await SAHYG.createElement("sahyg-confirm-dialog", {
			content: await SAHYG.translate("CONFIRM_DELETE_SHORTCUT", { name: shortcut.name }),
		})
			.show()
			.toPromise();
		if (!confirm) return;

		let response = await SAHYG.Api.post(location.pathname + "/delete", { name: shortcut.name });
		if (!response?.success) return;

		this.$array.removeRow(row.id);
		this.shortcuts.splice(
			this.shortcuts.indexOf((sc) => sc.id === shortcut.id),
			1
		);

		SAHYG.createElement("sahyg-toast", {
			type: "success",
			content: await SAHYG.translate("DELETE_SUCCESS"),
		}).show();
	}
};

SAHYG.onload(() => (SAHYG.Instances.Shortener = new SAHYG.Classes.Shortener()));
