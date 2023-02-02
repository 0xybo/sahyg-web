function applyFunctions(model) {}

/**
 * Download
 *
 * @param {{}} query
 * @param {{}} param1
 * @returns {model}
 */
async function Download(query, { create = false, multiple = false } = {}) {
	try {
		let model;
		if (!create) {
			if (multiple) model = await this.models.Downloads.find(query);
			else model = await this.models.Downloads.findOne(query);
			if (!model) return null;
		} else {
			model = this.models.Groups();
			model.name = query.name;
			model.file = query.file;
			model.permissions = query.permissions;
		}

		if (multiple) model.forEach(applyFunctions.bind(this));
		else applyFunctions.call(this, model);

		return model;
	} catch (e) {
		this.logger.error(e);
		return null;
	}
}

module.exports = Download;
