$(function () {
	SAHYG.Instances.Users = new (class {
		constructor() {
			this.$usersList = $('[data-horizontal-tabs-id="users"] c-input-list');
			this.$usersListBody = $('[data-horizontal-tabs-id="users"] c-input-list-body');
			this.$usersListTemplate = $('[data-horizontal-tabs-id="users"] c-input-list-template c-input-list-row');

			this.loader = SAHYG.Components.loader.replaceElementContents(this.$usersListBody, false); // Place a loader symbol in users list

			this.init();
		}
		async init() {
			this.users = await this.getAllUsers();

			this.loader.done();
			this.$usersListBody.append(
				...(await Promise.all(
					this.users.map(async (user) => {
						let row = this.$usersListTemplate.clone();
						row.find("[name=username] span").text(user.username);
						row.find("[name=firstname] span").text(user.firstname);
						row.find("[name=lastname] span").text(user.lastname);
						row.find("[name=email] span").text(user.email);
						row.data("user", user);
						return row;
					})
				))
			);
			this.$usersList.trigger("change")
		}
		getAllUsers() {
			return new Promise((resolve, reject) => {
				$.post("/users", {
					type: "GET",
				}).done((data) => resolve(data.body.users));
			});
		}
	})();
});
