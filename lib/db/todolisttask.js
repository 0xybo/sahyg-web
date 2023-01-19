function applyFunctions(model) {
	model._save = model.save;
	model.save = async function () {
		let subtasks = [];
		for (let task of model.subtasks || []) {
			let subtask;
			if (task.__proto__?._bsontype == "ObjectID" || typeof task == "string") {
				subtask = await TodoListTask.call(this, { _id: task });
			} else subtask = await TodoListTask.call(this, { user: model.user, ...task }, { get: false, save: true });

			subtasks.push(subtask._id);
		}

		model.subtasks = subtasks;
		await model._save();
	}.bind(this);

	model.fetchSubtasks = async function () {
		let subtasks = [];
		for (let subtask of model.subtasks) {
			if (typeof subtask == "string" || subtask.__proto__?._bsontype == "ObjectID")
				subtasks.push(await TodoListTask.call(this, { _id: subtask }));
			else subtasks.push(subtask);
		}
		model.subtasks = subtasks;
		return subtasks;
	}.bind(this);

	model.remove = async function () {
		await model.fetchSubtasks();

		for (let subtask of model.subtasks) {
			subtask.remove();
		}

		await this.models.TodoListTasks.findOneAndDelete({ _id: model._id });
		return true;
	}.bind(this);
}

async function TodoListTask(obj, { get = true, limit = 1, save = false, fetchSubtasks = false } = {}) {
	let model;
	if (get) {
		model = await this.models.TodoListTasks.find(obj, null, { limit });
		if (limit == 1) model = model[0];
		if (!model) return null;
	} else {
		model = this.models.TodoListTasks();
		model.user = obj.user;
		model.date = obj.date;
		model.text = obj.text;
		model.completed = obj.completed;
		model.notifications = obj.notifications;
		model.type = obj.type;
		model.description = obj.description;
		model.categories = obj.categories

		model.subtasks = [];
		for (let task of [...(obj.subtasks || []), ...(obj.fetchSubtasks || [])]) {
			let subtask;
			if (task._id) {
				subtask = await TodoListTask({ _id: task._id });
				Object.assign(subtask, task);
				await subtask.save();
			} else subtask = await TodoListTask({ user: model.user, ...task }, { get: false });

			model.subtasks.push(subtask._id);
		}
	}

	if (limit > 1) {
		model.forEach(applyFunctions.bind(this));
		if (save) await Promise.all(model.map(async (m) => await m.save()));
		if (fetchSubtasks) await Promise.all(model.map(async (m) => await m.fetchSubtasks()));
	} else {
		applyFunctions.call(this, model);
		if (save) await model.save();
		if (fetchSubtasks) await model.fetchSubtasks();
	}

	return model;
}

module.exports = TodoListTask;
