SAHYG.Classes.Users = class Users {
	$array = SAHYG.$0('[sahyg-tab="users"] sahyg-input-array');
	constructor(users, groups) {
		this.users = users;
		this.groups = groups;

		this.init();
	}
	async init() {
		for (let user of this.users) {
			let row = await this.$array.addRow({
				username: user.username,
				email: user.email,
				group: this.groups.find((group) => group.id === user.group)?.name,
				actions: null,
			});
			row.$.$0('[button-id="edit"]').on("click", this.edit.bind(this, row, user));
			row.$.$0('[button-id="remove"]').on("click", this.remove.bind(this, row, user));
		}

		this.$array.on("input", this.arrayUpdateHandler.bind(this));
	}
	async edit(row, user) {
		let result = await SAHYG.createElement("sahyg-input-dialog", {
			header: (await SAHYG.translate("EDIT")) + " " + (user.username || (await SAHYG.translate("NEW_USER"))),
			inputs: [
				{
					type: "text",
					id: "username",
					label: await SAHYG.translate("USERNAME"),
					inline: true,
					defaultValue: user.username || null,
					options: {
						placeholder: await SAHYG.translate("USERNAME"),
						borderBottom: true,
						type: "username",
					},
				},
				{
					type: "text",
					id: "firstname",
					label: await SAHYG.translate("FIRSTNAME"),
					inline: true,
					defaultValue: user.firstname || null,
					options: {
						placeholder: await SAHYG.translate("FIRSTNAME"),
						borderBottom: true,
						type: "firstname",
					},
				},
				{
					type: "text",
					id: "lastname",
					label: await SAHYG.translate("LASTNAME"),
					inline: true,
					defaultValue: user.lastname || null,
					options: {
						placeholder: await SAHYG.translate("LASTNAME"),
						borderBottom: true,
						type: "lastname",
					},
				},
				{
					type: "text",
					id: "email",
					label: await SAHYG.translate("EMAIL"),
					inline: true,
					defaultValue: user.email || null,
					options: {
						placeholder: await SAHYG.translate("EMAIL"),
						borderBottom: true,
						type: "email",
					},
				},
				{
					type: "textarea",
					id: "about",
					label: await SAHYG.translate("ABOUT"),
					defaultValue: user.about || null,
					options: {
						placeholder: await SAHYG.translate("ABOUT"),
						rounded: true,
						outline: true,
					},
				},
				{
					type: "select",
					id: "theme",
					label: await SAHYG.translate("THEME"),
					defaultValue: [user.theme] || ["dark"],
					inline: true,
					options: {
						options: {
							dark: await SAHYG.translate("DARK"),
							light: await SAHYG.translate("LIGHT"),
						},
					},
				},
				{
					type: "select",
					id: "locale",
					label: await SAHYG.translate("LOCALE"),
					defaultValue: [user.locale] || ["fr-FR"],
					inline: true,
					options: {
						options: {
							"fr-FR": "Français",
							"en-GB": "English (GB)",
						},
					},
				},
				{
					type: "select",
					id: "group",
					label: await SAHYG.translate("GROUP"),
					defaultValue: [user.group] || [],
					inline: true,
					options: {
						options: {
							...Object.fromEntries(this.groups.map((group) => [group.id, group.name])),
						},
					},
				},
				{
					type: "switch",
					id: "certified",
					label: await SAHYG.translate("CERTIFIED"),
					defaultValue: user.certified || false,
					inline: true,
				},
				{
					type: "array",
					id: "custom",
					label: await SAHYG.translate("CUSTOM"),
					defaultValue: Object.entries(user.custom || {})?.map(([name, value]) => {
						return { name, value };
					}),
					columns: [
						{
							type: "text",
							id: "name",
							name: await SAHYG.translate("NAME"),
							placeholder: await SAHYG.translate("NAME"),
						},
						{
							type: "text",
							id: "value",
							name: await SAHYG.translate("VALUE"),
							placeholder: await SAHYG.translate("VALUE"),
						},
					],
				},
				{
					type: "list",
					id: "shared",
					label: await SAHYG.translate("SHARE"),
					defaultValue: user.shared,
				},
				{
					type: "list",
					id: "permissions",
					label: await SAHYG.translate("PERMISSIONS"),
					defaultValue: user.permissions,
				},
			],
		})
			.show()
			.toPromise();

		if (!result) {
			if (!user.id) this.$array.removeRow(row.id);
			return;
		}

		console.log(result.data);
		let newUserData = {
			username: result.data.username,
			firstname: result.data.firstname,
			lastname: result.data.lastname,
			email: result.data.email,
			about: result.data.about,
			theme: result.data.theme[0],
			locale: result.data.locale[0],
			group: result.data.group[0],
			certified: result.data.certified,
			shared: result.data.shared,
			permissions: result.data.permissions,
		};
		if (user.id) this.saveEdit(user.id, newUserData, row);
		else this.saveAdd(newUserData, row);
	}
	async remove(row, user) {
		if (
			!(await SAHYG.createElement("sahyg-confirm-dialog", { content: await SAHYG.translate("CONFIRM_DELETE") })
				.show()
				.toPromise())
		)
			return;

		this.users.splice(
			this.users.findIndex((u) => u.id === user.id),
			1
		);
		this.$array.removeRow(row.id);
		this.saveDeletion(user.id);
	}
	arrayUpdateHandler(event) {
		switch (event.action) {
			case "clear": {
				this.saveClear();
				this.users = [];
				break;
			}
			case "add": {
				let row = this.$array.rows.find((row) => row.id === event.editedRow);
				let user = {
					id: null,
					username: null,
					firstname: null,
					lastname: null,
					email: null,
					about: null,
					theme: "dark",
					locale: "fr-FR",
					group: null,
					certified: false,
					shared: [],
					permissions: [],
				};
				this.users.push(user);

				this.$array.$container
					.$0(`.row[row-id="${event.editedRow}"] [button-id="edit"]`)
					.on("click", this.edit.bind(this, row, user))
					.click();
				this.$array.$container.$0(`.row[row-id="${event.editedRow}"] [button-id="remove"]`).on("click", this.remove.bind(this, row, user));
				break;
			}
		}
	}
	async saveDeletion(...ids) {
		let res = await SAHYG.Api.post("/users/remove", { ids });
		if (res?.success) SAHYG.createElement("sahyg-toast", { type: "ok", content: await SAHYG.translate("DELETE_SUCCESS") }).show();
	}
	async saveEdit(id, user, row) {
		let res = await SAHYG.Api.post("/users/edit", { id, ...user });

		if (!res?.success) return;

		SAHYG.createElement("sahyg-toast", { type: "ok", content: await SAHYG.translate("SAVE_SUCCESS") }).show();

		this.$array.updateCell(row.id, "username", user.username);
		this.$array.updateCell(row.id, "email", user.email);
		this.$array.updateCell(row.id, "group", this.groups.find((g) => g.id === user.group)?.name);
	}
	async saveAdd(user, row) {
		let res = await SAHYG.Api.post("/users/add", user);

		if (!res?.success) return;

		SAHYG.createElement("sahyg-toast", { type: "ok", content: await SAHYG.translate("SAVE_SUCCESS") }).show();

		this.$array.updateCell(row.id, "username", user.username);
		this.$array.updateCell(row.id, "email", user.email);
		this.$array.updateCell(row.id, "group", this.groups.find((g) => g.id === user.group)?.name);
	}
};

SAHYG.Classes.Groups = class Groups {
	$array = SAHYG.$0('[sahyg-tab="groups"] sahyg-input-array');
	constructor(groups) {
		this.groups = groups;

		this.init();
	}
	async init() {
		for (let group of this.groups) {
			let row = await this.$array.addRow({
				name: group.name,
				parent: this.groups.find((parent) => parent.id === group.parent)?.name,
				actions: null,
			});
			row.$.$0('[button-id="edit"]').on("click", this.edit.bind(this, row, group));
			row.$.$0('[button-id="remove"]').on("click", this.remove.bind(this, row, group));
		}

		this.$array.on("input", this.arrayUpdateHandler.bind(this));
	}
	async edit(row, group) {
		let result = await SAHYG.createElement("sahyg-input-dialog", {
			header: (await SAHYG.translate("EDIT")) + " " + (group.name || (await SAHYG.translate("NEW_GROUP"))),
			inputs: [
				{
					type: "text",
					id: "name",
					label: await SAHYG.translate("NAME"),
					inline: true,
					defaultValue: group.name || null,
					options: {
						placeholder: await SAHYG.translate("NAME"),
						borderBottom: true,
					},
				},
				{
					type: "select",
					id: "parent",
					label: await SAHYG.translate("PARENT"),
					defaultValue: [group.parent] || [],
					inline: true,
					options: {
						options: {
							...Object.fromEntries(this.groups.filter((g) => g.id !== group.id).map((g) => [g.id, g.name])),
						},
					},
				},
				{
					type: "list",
					id: "permissions",
					label: await SAHYG.translate("PERMISSIONS"),
					defaultValue: group.permissions,
				},
			],
		})
			.show()
			.toPromise();

		if (!result) {
			if (!group.id) this.$array.removeRow(row.id);
			return;
		}

		console.log(result);
		let newGroupData = { permissions: result.data.permissions, parent: result.data.parent[0], name: result.data.name };
		if (group.id) this.saveEdit(group.id, newGroupData, row);
		else this.saveAdd(newGroupData, row);
	}
	async remove(row, group) {
		if (
			!(await SAHYG.createElement("sahyg-confirm-dialog", { content: await SAHYG.translate("CONFIRM_DELETE") })
				.show()
				.toPromise())
		)
			return;

		this.groups.splice(
			this.groups.findIndex((u) => u.id === group.id),
			1
		);
		this.$array.removeRow(row.id);
		this.saveDeletion(group.id);
	}
	arrayUpdateHandler(event) {
		switch (event.action) {
			case "clear": {
				this.saveDeletion(this.groups.map((g) => g.id));
				this.groups = [];
				break;
			}
			case "add": {
				let row = this.$array.rows.find((row) => row.id === event.editedRow);
				let group = {
					id: null,
					name: null,
					parent: null,
					permissions: [],
				};
				this.groups.push(group);

				this.$array.$container
					.$0(`.row[row-id="${event.editedRow}"] [button-id="edit"]`)
					.on("click", this.edit.bind(this, row, group))
					.click();
				this.$array.$container.$0(`.row[row-id="${event.editedRow}"] [button-id="remove"]`).on("click", this.remove.bind(this, row, group));
				break;
			}
		}
	}
	async saveDeletion(...ids) {
		let res = await SAHYG.Api.post("/groups/remove", { ids });
		if (res?.success) SAHYG.createElement("sahyg-toast", { type: "ok", content: await SAHYG.translate("DELETE_SUCCESS") }).show();
	}
	async saveEdit(id, group, row) {
		let res = await SAHYG.Api.post("/groups/edit", { id, ...group });

		if (!res?.success) return;

		SAHYG.createElement("sahyg-toast", { type: "ok", content: await SAHYG.translate("SAVE_SUCCESS") }).show();

		this.$array.updateCell(row.id, "name", group.name);
		this.$array.updateCell(row.id, "parent", this.groups.find((g) => g.id === group.parent)?.name);
	}
	async saveAdd(group, row) {
		let res = await SAHYG.Api.post("/groups/add", group);

		if (!res?.success) return;

		SAHYG.createElement("sahyg-toast", { type: "ok", content: await SAHYG.translate("SAVE_SUCCESS") }).show();

		this.$array.updateCell(row.id, "name", group.name);
		this.$array.updateCell(row.id, "parent", this.groups.find((g) => g.id === group.parent)?.name);
	}
};

SAHYG.onload(async function () {
	let users = (await SAHYG.Api.get("/users/list"))?.content?.users;
	let groups = (await SAHYG.Api.get("/groups/list"))?.content?.groups;

	SAHYG.Instances.Users = new SAHYG.Classes.Users(users, groups);
	SAHYG.Instances.Groups = new SAHYG.Classes.Groups(groups);
});

// {
// 	name: "shared",
// 	label: await SAHYG.translate("SHARED"),
// 	placeholder: await SAHYG.translate("SHARED"),
// 	type: "list",
// 	defaultValue: user.shared,
// },
