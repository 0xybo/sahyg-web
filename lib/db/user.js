const { hash, genSalt, compare } = require("bcryptjs");

function applyFunctions(model) {
	model.getGroup = async () => {
		return await this.Group({ _id: model.group }, true);
	};
	model.checkPassword = async (pass) => {
		return await compare(pass, model.password);
	};
	model.getPermissions = async () => {
		return (
			model._permissions ||
			(model._permissions = [...((await (await this.Group({ _id: model.group }, true))?.getPermissions()) || []), ...model.permissions])
		);
	};
	model.checkPermissions = (perms = []) => {
		return new Promise(async (resolve, reject) => {
			let permissions = await model.getPermissions();
			perms.forEach((perm) => {
				if (!permissions.includes(perm)) resolve(false);
			});
			resolve(true);
		});
	};
	model.comparePermissions = (perms = [], perms2 = []) => {
		return new Promise(async (resolve, reject) => {
			perms.forEach((perm) => {
				if (!perms2.includes(perm)) resolve(false);
			});
			resolve(true);
		});
	};
}

/**
 * User
 *
 * @param {{username: String, password: String, firstname: String, lastname: String, email: String, group: Number, allowedIps: String[]}} query
 * @param {{create: Boolean, multiple: Boolean}} param1
 * @returns {mongoose.Model}
 */
async function User(query, { create = false, multiple = false } = {}) {
	try {
		let model;
		if (!create && query) {
			if (multiple) model = await this.models.Users.find(query);
			else model = await this.models.Users.findOne(query);
			if (!model) return null;
		} else {
			model = this.models.Users();
			if (!query) {
				model.username = "guest";
				model.firstname = "guestFirstname";
				model.lastname = "guestLastname";
				model.email = "guest@sahyg.fr";
				model.permissions = model.friends = [];
				model.password = model.about = "";
				model.avatar = false;
				model.group = (await this.Group({ name: "guest" }))?._id;
				model.custom = {};
			} else {
				model.username = query.username;
				model.firstname = query.firstname;
				model.lastname = query.lastname;
				model.email = query.email;
				model.permissions = query.permissions || [];
				if (!query.password)
					query.password = await this.generateTemporaryPassword({
						username: model.username,
						email: model.email,
						firstname: model.firstname,
						lastname: model.lastname,
					});
				model.password = await hash(query.password, await genSalt(this.Web.config.get("db.saltRounds")));
				model.group = query.group || (await this.Group({ name: "user" }, true))?._id;
				model.avatar = Boolean(query.avatar);
				model.allowedIps = query.allowedIps || [];
				model.friends = query.friends || [];
				model.about = query.about || "";
				model.custom = query.custom || {};
			}
		}
		if (multiple) model.forEach(applyFunctions.bind(this));
		else applyFunctions.call(this, model);

		return model;
	} catch (e) {
		this.logger.error(e);
		return null;
	}
}

module.exports = User;
