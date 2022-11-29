function applyFunctions(model) {
	model.getPermissions = async () => {
		return (
			model._permissions ||
			(model._permissions =
				((_ = async (model) => {
					return [...Array.from(model.permissions), ...(model.parent ? await _(await this.Group({ _id: model.parent }, true)) : [])];
				}),
				_(model)))
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
}

/**
 * Group
 *
 * @param {{name: String, parent: ObjectId, permissions: String[]}} query
 * @param {{create: Boolean}} param1
 * @returns {model}
 */
async function Group(query, { create = false /*, multiple = false */ } = {}) {
	try {
		let model;
		if (!create) {
			model = await this.models.Groups.findOne(query);
			if (!model) return null;
		} else {
			model = this.models.Groups();
			model.name = query.name;
			model.parent = query.parent;
			model.permissions = query.permissions;
		}

		applyFunctions.call(this, model);

		return model;
	} catch (e) {
		this.logger.error(e);
		return null;
	}
}

module.exports = Group;