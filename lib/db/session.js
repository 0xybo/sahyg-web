function applyFunctions(model) {
	
}

async function Session(query) {
	try {
		let model = await this.models.Groups.findOne(query);
		if (!model) return null;

		applyFunctions.call(this, model);

		return model;
	} catch (e) {
		this.logger.error(e);
		return null;
	}
}

module.exports = Session;