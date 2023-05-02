const Page = require("../lib/page");

class Users extends Page {
	constructor(/** @type {import('../../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.setGet(["/users"], this.get.bind(this));

		this.setGet(["/users/list"], this.getUsersList.bind(this));
		this.setPost(["/users/edit"], this.saveUser.bind(this));
		this.setPost(["/users/add"], this.addUser.bind(this));
		this.setPost(["/users/remove"], this.removeUser.bind(this));

		this.setGet(["/groups/list"], this.getGroupsList.bind(this));
		this.setPost(["/groups/add"], this.addGroup.bind(this));
		this.setPost(["/groups/edit"], this.saveGroup.bind(this));
		this.setPost(["/groups/remove"], this.removeGroup.bind(this));
	}

	async get(req, res, next) {
		return res.WebResponse.render("users");
	}
	async getUsersList(req, res, next) {
		res.WebResponse.setContent({
			users: await Promise.all(
				(
					await this.Web.db.User({}, { multiple: true })
				).map(async (user) => {
					return {
						id: user._id,
						avatar: user.avatar,
						theme: user.theme,
						locale: user.locale,
						shared: user.shared,
						permissions: user.permissions,
						friends: user.friends,
						about: user.about,
						createdAt: user.createdAt,
						username: user.username,
						email: user.email,
						group: user.group,
						certified: user.certified,
						firstname: user.firstname,
						lastname: user.lastname,
						custom: user.custom,
					};
				})
			),
		}).send();
	}
	async saveUser(req, res, next) {
		let id = req.body.id;
		if (!id) return res.WebResponse.error("MISSING_USER_ID");

		if (!req.body.username || !req.body.email) return res.WebResponse.error("MISSING_REQUIRED_USER_PROPERTY");

		let user = await this.Web.db.User({ _id: id });
		if (user) Object.assign(user, req.body);
		else return res.WebResponse.error("USER_NOT_FOUND");
		await user
			.save()
			.then(() => res.WebResponse.setStatus("OK").send())
			.catch(() => res.WebResponse.error("SERVER_ERROR"));
	}
	async addUser(req, res, next) {
		if (!req.body.username || !req.body.email) return res.WebResponse.error("MISSING_REQUIRED_USER_PROPERTY");

		let user = await this.Web.db.User(req.body, { create: true });
		await user
			.save()
			.then(() => res.WebResponse.setStatus("OK").setContent({ id: user._id }).send())
			.catch(() => res.WebResponse.error("SERVER_ERROR"));
	}
	async removeUser(req, res) {
		let ids = req.body.ids;
		if (!ids) return res.WebResponse.error("MISSING_PARAMETER");

		if (!(ids instanceof Array)) ids = [ids];

		let deleted = {};
		for (let id of ids) {
			deleted[id] = Boolean(await this.Web.db.models.Users.findOneAndDelete({ _id: id }));
		}
		res.WebResponse.setContent({ deleted }).send();
	}

	async getGroupsList(req, res, next) {
		res.WebResponse.setContent({
			groups: await Promise.all(
				(
					await this.Web.db.Group({}, { multiple: true })
				).map(async (group) => {
					return {
						id: group._id,
						parent: group.parent,
						name: group.name,
						permissions: group.permissions,
					};
				})
			),
		}).send();
	}
	async saveGroup(req, res, next) {
		let id = req.body.id;
		if (!id) return res.WebResponse.error("MISSING_GROUP_ID");

		let group = await this.Web.db.Group({ _id: id });
		if (group) Object.assign(group, req.body);
		else return res.WebResponse.error("USER_NOT_FOUND");
		await group
			.save()
			.then(() => res.WebResponse.setStatus("OK").send())
			.catch((e) => res.WebResponse.error("SERVER_ERROR"));
	}
	async addGroup(req, res, next) {
		if (!req.body.name) return res.WebResponse.error("MISSING_REQUIRED_GROUP_PROPERTY");

		let group = await this.Web.db.Group(req.body, { create: true });
		await group
			.save()
			.then(() => res.WebResponse.setContent({ id: group._id }).send())
			.catch((e) => {
				this.logger.error(e);
				res.WebResponse.error("SERVER_ERROR");
			});
	}
	async removeGroup(req, res, next) {
		let ids = req.body.ids;
		if (!ids) return res.WebResponse.error("MISSING_PARAMETER");

		if (!(ids instanceof Array)) ids = [ids];

		let deleted = {};
		for (let id of ids) {
			deleted[id] = Boolean(await this.Web.db.models.Groups.findOneAndDelete({ _id: id }));
		}
		res.WebResponse.setContent({ deleted }).send();
	}
}

module.exports = Users;
