$(function () {
	SAHYG.Classes.Groups = class Groups {
		$groupsList = $('[data-horizontal-tabs-id="groups"] c-input-array');
		$groupsListBody = $('[data-horizontal-tabs-id="groups"] c-input-array-body');
		$groupsListTemplate = $('[data-horizontal-tabs-id="groups"] c-input-array-template c-input-array-row');
		constructor() {
			this.loader = SAHYG.Components.loader.replaceContent(this.$groupsListBody, false); // Place a loader symbol in groups list

			SAHYG.on("click", "[data-horizontal-tabs-id=groups] c-input-array-field[name=actions] .edit", this.edit.bind(this));
			SAHYG.on("input", this.$groupsList, this.arrayUpdate.bind(this));

			this.init();
		}
		async init() {
			this.groups = await this.getAllGroups();

			this.loader.done();
			this.$groupsListBody.append(
				...(await Promise.all(
					this.groups.map(async (group) => {
						let row = this.$groupsListTemplate.clone();
						row.find("[name=name] span").text(group.name);
						row.find("[name=parent] span").text(this.groups.find((grp) => grp.id == group.parent)?.name || group.parent);
						row.attr("data-group-id", group.id);
						return row;
					})
				))
			);
			this.$groupsList.trigger("change");
		}
		async getAllGroups() {
			return (await SAHYG.Api.get("/groups/list").catch(console.log)).groups;
		}
		async arrayUpdate(event, action, data) {
			if (action == "delete") {
				let name = data.values.name;
				let group = this.groups.find((group) => group.name == name);
				if (group.id) await this.removeGroup(group.id);
				else SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("SAVE_FAILED") }).show();
			} else if (action == "add") {
				let target = $(data).find("[name=actions] btn");
				this.edit({ target });
			} else return true;
		}
		async edit({ target }) {
			let id = $(target).closest("c-input-array-row")?.attr("data-group-id");
			if (id) {
				let group = this.groups.find((group) => group.id === id);
				let editedGroup = await this.editPopup(group);
				if (!editedGroup || Object.entries(editedGroup).every(([name, value]) => group[name] == value)) return;
				this.sendGroup(group.id, editedGroup);
			} else {
				let group = {
					name: "",
					parent: "",
					permissions: [],
				};
				let editedGroup = await this.editPopup(group);
				if (!editedGroup || Object.entries(editedGroup).every(([name, value]) => group[name] == value)) return;
				this.sendGroup(group.id, editedGroup);
			}
		}
		editPopup(group) {
			return new Promise(async (resolve) => {
				SAHYG.Components.popup.Popup.input((await SAHYG.translate("EDIT")) + " " + group.name, [
					{
						name: "name",
						label: await SAHYG.translate("NAME"),
						placeholder: await SAHYG.translate("NAME"),
						type: "text",
						defaultValue: group.name,
					},
					{
						name: "parent",
						label: await SAHYG.translate("PARENT"),
						placeholder: await SAHYG.translate("PARENT"),
						type: "select",
						options: this.groups
							.filter((grp) => grp.id != group.id)
							.map((grp) => {
								return { name: grp.id, text: grp.name };
							}),
						defaultValue: this.groups.find((grp) => grp.id == group.parent)?.id,
					},
					{
						name: "permissions",
						label: await SAHYG.translate("PERMISSIONS"),
						placeholder: await SAHYG.translate("PERMISSIONS"),
						type: "list",
						defaultValue: group.permissions,
					},
				]).then(resolve);
			});
		}
		async sendGroup(id, editedGroup) {
			let res;
			if (!id) res = await SAHYG.Api.post("/groups/add", editedGroup, true);
			else res = await SAHYG.Api.post("/groups/save", Object.assign(editedGroup, { id }), true);
			if (res.success) {
				SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("SAVE_SUCCESS") }).show();
				let row = this.$groupsList.find(`c-input-array-row[data-group-id=${id}]`);
				if (!row.length) row = this.$groupsList.find("c-input-array-row").last();
				if (!id) id = res.content.id;
				this.updateRow(row, id, editedGroup);
				let group = this.groups.find((group) => group.id === id);
				if (group) Object.assign(group, editedGroup);
				else this.groups.push(Object.assign(editedGroup, { id }));
			} else SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("SAVE_FAILED") }).show();
		}
		async removeGroup(id) {
			let res = await SAHYG.Api.post("/groups/remove/" + id, {}, true);
			if (res.success) SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("SAVE_SUCCESS") }).show();
			else SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("SAVE_FAILED") }).show();
		}
		updateRow(row, id, { name, parent }) {
			row.find("[name=name] span").text(name);
			row.find("[name=parent] span").text(this.parentName(parent));
			row.attr("data-group-id", id);
		}
		parentName(id) {
			return this.groups.find((group) => group.id == id)?.name || id;
		}
	};
	SAHYG.Instances.Groups = new SAHYG.Classes.Groups();

	SAHYG.Classes.Users = class Users {
		$usersList = $('[data-horizontal-tabs-id="users"] c-input-array');
		$usersListBody = $('[data-horizontal-tabs-id="users"] c-input-array-body');
		$usersListTemplate = $('[data-horizontal-tabs-id="users"] c-input-array-template c-input-array-row');
		constructor() {
			this.loader = SAHYG.Components.loader.replaceContent(this.$usersListBody, false); // Place a loader symbol in users list

			SAHYG.on("click", "[data-horizontal-tabs-id=users] c-input-array-field[name=actions] .edit", this.edit.bind(this));
			SAHYG.on("input", this.$usersList, this.arrayUpdate.bind(this));

			this.init();
		}
		async init() {
			this.users = await this.getAllUsers();

			while (!SAHYG.Instances.Groups?.groups) {}

			this.loader.done();
			this.$usersListBody.append(
				...(await Promise.all(
					this.users.map(async (user) => {
						let row = this.$usersListTemplate.clone();
						row.find("[name=username] span").text(user.username);
						row.find("[name=group] span").text(SAHYG.Instances.Groups.groups.find((grp) => grp.id == user.group)?.name || group);
						row.find("[name=email] span").text(user.email);
						row.attr("data-user-id", user.id);
						return row;
					})
				))
			);
			this.$usersList.trigger("change");
		}
		async getAllUsers() {
			return (await SAHYG.Api.get("/users/list").catch(console.log)).users;
		}
		async arrayUpdate(event, action, data) {
			if (action == "delete") {
				let username = data.values.username;
				let user = this.users.find((user) => user.username == username);
				if (user.id) await this.removeUser(user.id);
				else SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("SAVE_FAILED") }).show();
			} else if (action == "add") {
				let target = $(data).find("[name=actions] btn");
				this.edit({ target });
			} else return true;
		}
		async edit({ target }) {
			let id = $(target).closest("c-input-array-row")?.attr("data-user-id");
			if (id) {
				let user = this.users.find((user) => user.id === id);
				let editedUser = await this.editPopup(user);
				if (!editedUser || Object.entries(editedUser).every(([name, value]) => user[name] == value)) return;
				this.sendUser(user.id, editedUser);
			} else {
				let user = {
					username: "",
					firstname: "",
					lastname: "",
					email: "",
					about: "",
					theme: "light",
					locale: "fr-FR",
					group: "",
					certified: false,
					shared: [],
					permissions: [],
				};
				let editedUser = await this.editPopup(user);
				if (!editedUser || Object.entries(editedUser).every(([name, value]) => user[name] == value)) return;
				this.sendUser(user.id, editedUser);
			}
		}
		editPopup(user) {
			return new Promise(async (resolve) => {
				SAHYG.Components.popup.Popup.input((await SAHYG.translate("EDIT")) + " " + user.username, [
					{
						name: "username",
						label: await SAHYG.translate("USERNAME"),
						placeholder: await SAHYG.translate("USERNAME"),
						type: "text",
						defaultValue: user.username,
						inline: true,
					},
					{
						name: "firstname",
						label: await SAHYG.translate("FIRSTNAME"),
						placeholder: await SAHYG.translate("FIRSTNAME"),
						type: "text",
						defaultValue: user.firstname,
						inline: true,
					},
					{
						name: "lastname",
						label: await SAHYG.translate("LASTNAME"),
						placeholder: await SAHYG.translate("LASTNAME"),
						type: "text",
						defaultValue: user.lastname,
						inline: true,
					},
					{
						name: "email",
						label: await SAHYG.translate("EMAIL"),
						placeholder: await SAHYG.translate("EMAIL"),
						type: "text",
						defaultValue: user.email,
					},
					{
						name: "about",
						label: await SAHYG.translate("ABOUT"),
						placeholder: await SAHYG.translate("ABOUT"),
						type: "textarea",
						defaultValue: user.about,
					},
					{
						name: "theme",
						label: await SAHYG.translate("THEME"),
						placeholder: await SAHYG.translate("THEME"),
						type: "select",
						options: [
							{
								name: "light",
								text: await SAHYG.translate("LIGHT"),
							},
							{
								name: "dark",
								text: await SAHYG.translate("DARK"),
							},
						],
						defaultValue: user.theme,
						inline: true,
					},
					{
						name: "locale",
						label: await SAHYG.translate("LOCALE"),
						placeholder: await SAHYG.translate("LOCALE"),
						type: "select",
						options: [
							{
								name: "fr-FR",
								text: "fr-FR",
							},
							{
								name: "en-UK",
								text: "en-UK",
							},
						],
						defaultValue: user.locale,
						inline: true,
					},
					{
						name: "group",
						label: await SAHYG.translate("GROUP"),
						placeholder: await SAHYG.translate("GROUP"),
						type: "select",
						options: SAHYG.Instances.Groups.groups.map((grp) => {
							return { name: grp.id, text: grp.name };
						}),
						defaultValue: user.group,
						inline: true,
					},
					{
						name: "certified",
						label: await SAHYG.translate("CERTIFIED"),
						placeholder: await SAHYG.translate("CERTIFIED"),
						type: "boolean",
						defaultValue: user.certified,
						inline: true,
					},
					{
						name: "shared",
						label: await SAHYG.translate("SHARED"),
						placeholder: await SAHYG.translate("SHARED"),
						type: "list",
						defaultValue: user.shared,
					},
					{
						name: "permissions",
						label: await SAHYG.translate("PERMISSIONS"),
						placeholder: await SAHYG.translate("PERMISSIONS"),
						type: "list",
						defaultValue: user.permissions,
					},
				]).then(resolve);
			});
		}
		async sendUser(id, editedUser) {
			let res;
			if (!id) res = await SAHYG.Api.post("/users/add", editedUser, true);
			else res = await SAHYG.Api.post("/users/save", Object.assign(editedUser, { id }), true);
			if (res.success) {
				SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("SAVE_SUCCESS") }).show();
				let row = this.$usersList.find(`c-input-array-row[data-user-id=${id}]`);
				if (!row.length) row = this.$usersList.find("c-input-array-row").last();
				if (!id) id = res.content.id;
				this.updateRow(row, id, editedUser);

				let user = this.users.find((user) => user.id === id);
				if (user) Object.assign(user, editedUser);
				else this.users.push(Object.assign(editedUser, { id }));
			} else SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("SAVE_FAILED") }).show();
		}
		async removeUser(id) {
			let res = await SAHYG.Api.post("/users/remove/" + id, {}, true);
			if (res.success) SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("SAVE_SUCCESS") }).show();
			else SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("SAVE_FAILED") }).show();
		}
		updateRow(row, id, { email, username, group }) {
			row.find("[name=username] span").text(username);
			row.find("[name=email] span").text(email);
			row.find("[name=group] span").text(SAHYG.Instances.Groups.groups.find((grp) => grp.id == group)?.name || group);
			row.attr("data-user-id", id);
		}
	};
	SAHYG.Instances.Users = new SAHYG.Classes.Users();
});