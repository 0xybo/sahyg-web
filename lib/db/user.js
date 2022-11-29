const { hashSync, compareSync, genSaltSync, hash, genSalt, compare } = require("bcryptjs");

function applyFunctions(model) {
	model.getGroup = async () => {
		return await this.Group({ _id: model.group }, true);
	};
	model.checkPassword = async (pass) => {
		return await compare(pass, model.password);
	};
	model.getPermissions = async () => {
		return model._permissions || (model._permissions = [...((await (await this.Group({ _id: model.group }, true))?.getPermissions()) || []), ...model.permissions]);
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
				model.username = obj.username;
				model.firstname = obj.firstname;
				model.lastname = obj.lastname;
				model.email = obj.email;
				model.permissions = obj.permissions || [];
				model.password = await hash(obj.password, await genSalt(this.app.config.get("saltRounds")));
				model.group = obj.group || (await this.Group({ name: "user" }, true))?._id;
				model.avatar = Boolean(obj.avatar);
				model.allowedIps = obj.allowedIps || [];
				model.friends = obj.friends || [];
				model.about = obj.about || "";
				model.custom = obj.custom || {};
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
