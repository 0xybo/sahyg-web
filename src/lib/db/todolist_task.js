function applyFunctions(model) {
	model._save = model.save;
	model.save = async function () {
		let subtasks = [];
		for (let task of model.subtasks || []) {
			let subtask;
			if (task.__proto__?._bsontype == "ObjectID" || typeof task == "string") {
				subtask = await TodoList_Task.call(this, { _id: task });
			} else
				subtask = await TodoList_Task.call(
					this,
					{
						lists: task.lists || [],
						completed: task.completed,
						text: task.text,
						user: model.user,
						type: "subtask",
						description: "",
						notifications: [],
						subtasks: [],
					},
					{ get: false, save: true }
				);

			if (subtask) subtasks.push(subtask._id);
		}

		model.subtasks = subtasks;
		await model._save();
	}.bind(this);

	model.fetchSubtasks = async function () {
		let subtasks = [];
		for (let subtask of model.subtasks) {
			if (typeof subtask == "string" || subtask.__proto__?._bsontype == "ObjectID") {
				let fetched = await TodoList_Task.call(this, { _id: subtask });
				if (fetched) subtasks.push(fetched);
			} else subtasks.push(subtask);
		}
		model.subtasks = subtasks;
		return subtasks;
	}.bind(this);

	model.remove = async function () {
		await model.fetchSubtasks();

		for (let subtask of model.subtasks) {
			subtask.remove();
		}

		await this.models.TodoList_Tasks.findOneAndDelete({ _id: model._id });
		return true;
	}.bind(this);
}

async function TodoList_Task(obj, { get = true, limit = 1, save = false, fetchSubtasks = false } = {}) {
	let model;
	if (get) {
		model = await this.models.TodoList_Tasks.find(obj, null, { limit });
		if (limit == 1) model = model[0];
		if (!model) return null;
	} else {
		model = this.models.TodoList_Tasks();
		model.user = obj.user;
		model.date = obj.date;
		model.text = obj.text;
		model.completed = obj.completed;
		model.notifications = obj.notifications;
		model.type = obj.type;
		model.description = obj.description;
		model.lists = obj.lists;

		model.subtasks = [];
		for (let task of obj.subtasks instanceof Array ? obj.subtasks : []) {
			let subtask;
			if (task._id) {
				subtask = await TodoList_Task({ _id: task._id });
				Object.assign(subtask, task);
				await subtask.save();
			} else subtask = await TodoList_Task({ user: model.user, ...task }, { get: false });

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

module.exports = TodoList_Task;
