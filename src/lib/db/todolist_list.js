function applyFunctions(model) {}

async function TodoList_List(obj, { get = true, limit = 1 } = {}) {
	let model;
	if (get) {
		model = await this.models.TodoList_Lists.find(obj, null, { limit });
		if (limit == 1) model = model[0];
		if (!model) return null;
	} else {
		model = this.models.TodoList_Lists();
		model.user = obj.user;
		model.name = obj.name;
		model.color = obj.color;
		model.icon = obj.icon
		model.identifier = obj.identifier;
	}

	if (limit > 1) model.forEach(applyFunctions.bind(this));
	else applyFunctions.call(this, model);

	return model;
}

module.exports = TodoList_List;
