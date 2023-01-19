function applyFunctions(model) {}

async function TodoListCategory(obj, { get = true, limit = 1 } = {}) {
	let model;
	if (get) {
		model = await this.models.TodoListCategories.find(obj, null, { limit });
		if (limit == 1) model = model[0];
		if (!model) return null;
	} else {
		model = this.models.TodoListCategories();
		model.user = obj.user;
		model.name = obj.name;
		model.color = obj.color;
	}

	if (limit > 1) model.forEach(applyFunctions.bind(this));
	else applyFunctions.call(this, model);

	return model;
}

module.exports = TodoListCategory;
