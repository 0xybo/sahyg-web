const Page = require("../lib/page");

class TodoList extends Page {
	constructor(/** @type {import('../../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.maxListsPerUser = this.Web.config.get("pages.todolist.maxListsPerUser");
		this.maxTasksPerUser = this.Web.config.get("pages.todolist.maxTasksPerUser");
		this.maxListNameLength = this.Web.config.get("pages.todolist.maxListNameLength");
		this.minListNameLength = this.Web.config.get("pages.todolist.minListNameLength");
		this.maxTaskTextLength = this.Web.config.get("pages.todolist.maxTaskTextLength");
		this.minTaskTextLength = this.Web.config.get("pages.todolist.minTaskTextLength");
		this.maxTaskDescriptionLength = this.Web.config.get("pages.todolist.maxTaskDescriptionLength");
		this.minTaskDescriptionLength = this.Web.config.get("pages.todolist.minTaskDescriptionLength");
		this.defaultIcon = this.Web.config.get("pages.todolist.defaultIcon");

		this.setGet(["/todolist", "/user/:user/todolist"], this.get.bind(this));
		this.setGet(["/todolist/tasks", "/user/:user/todolist/tasks"], this.tasks.bind(this));
		this.setGet(["/todolist/lists", "/user/:user/todolist/lists"], this.lists.bind(this));
		this.setPost(["/todolist/add_list", "/user/:user/todolist/add_list"], this.addList.bind(this));
		this.setPost(["/todolist/add_task", "/user/:user/todolist/add_task"], this.addTask.bind(this));
		this.setPost(["/todolist/add_subtask", "/user/:user/todolist/add_subtask"], this.addSubtask.bind(this));
		this.setPost(["/todolist/rename_list", "/user/:user/todolist/rename_list"], this.rename.bind(this));
		this.setPost(["/todolist/delete_list", "/user/:user/todolist/delete_list"], this.deleteList.bind(this));
		this.setPost(["/todolist/set_list_color", "/user/:user/todolist/set_list_color"], this.setListColor.bind(this));
		this.setPost(["/todolist/set_list_icon", "/user/:user/todolist/set_list_icon"], this.setListIcon.bind(this));
		this.setPost(["/todolist/complete", "/user/:user/todolist/complete"], this.complete.bind(this));
		this.setPost(["/todolist/set_description", "/user/:user/todolist/set_description"], this.description.bind(this));
		this.setPost(["/todolist/set_text", "/user/:user/todolist/set_text"], this.text.bind(this));
		this.setPost(["/todolist/delete_task", "/user/:user/todolist/delete_task"], this.delete.bind(this));
		this.setPost(["/todolist/set_lists", "/user/:user/todolist/set_lists"], this.setLists.bind(this));
	}
	async get(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		res.WebResponse.render("todolist", {
			target,
			maxListsPerUser: this.maxListsPerUser,
			maxTasksPerUser: this.maxTasksPerUser,
			maxListNameLength: this.maxListNameLength,
			minListNameLength: this.minListNameLength,
			maxTaskTextLength: this.maxTaskTextLength,
			minTaskTextLength: this.minTaskTextLength,
			maxTaskDescriptionLength: this.maxTaskDescriptionLength,
			minTaskDescriptionLength: this.minTaskDescriptionLength,
			defaultIcon: this.defaultIcon,
		});
	}
	async tasks(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let tasks = (await this.Web.db.TodoList_Task({ user: target._id, type: "task" }, { limit: 1000, fetchSubtasks: true })) || [];

		res.WebResponse.setContent({ tasks }).send();
	}
	async lists(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let lists = (await this.Web.db.TodoList_List({ user: target._id }, { limit: 1000 })) || [];

		res.WebResponse.setContent({ lists }).send();
	}
	async addList(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let name = req.body.name;
		if (name.length > this.maxListNameLength) return res.WebResponse.error("NAME_TOO_LONG");
		if (name.length < this.minListNameLength) return res.WebResponse.error("NAME_TOO_SHORT");

		let lists = await this.Web.db.TodoList_List({ user: target._id }, { limit: this.maxListsPerUser + 1 });
		if (lists.length > this.maxListsPerUser) return res.WebResponse.error("TOO_MANY_LISTS");

		let identifier = await this.getIdentifier(name, target);

		let list = await this.Web.db.TodoList_List({ user: target._id, name, identifier }, { get: false });
		await list.save();

		res.WebResponse.setContent({ id: list._id, identifier }).send();
	}
	async addTask(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let text = req.body.text;
		let listID = req.body.list;
		if (typeof text != "string") return res.WebResponse.error("MISSING_PARAMETER");

		if (text.length > this.maxTaskTextLength || text.length < this.minTaskTextLength) return res.WebResponse.error("BAD_REQUEST");

		let list = listID ? await this.Web.db.TodoList_List({ _id: listID }) : null;

		let task = await this.Web.db.TodoList_Task(
			{ user: target._id, text, lists: list?._id ? [list._id] : [], completed: false, notifications: [], type: "task", description: "" },
			{ get: false }
		);
		await task.save();

		return res.WebResponse.setContent({ task }).send();
	}
	async addSubtask(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let text = req.body.text;
		let task = req.body.task;

		if (typeof text !== "string" || typeof task !== "string") return res.WebResponse.error("MISSING_PARAMETER");

		if (text.length < this.minTaskTextLength || text.length > this.maxTaskTextLength) return res.WebResponse.error("BAD_REQUEST");

		task = await this.Web.db.TodoList_Task({ _id: task, type: "task" });
		if (!task) return res.WebResponse.error("NOT_FOUND");

		let subtask = await this.Web.db.TodoList_Task(
			{ user: target._id, text, lists: task.lists || [], completed: false, notifications: [], type: "subtask", description: "" },
			{ get: false, save: true }
		);

		task.subtasks.push(subtask._id);
		await task.save();

		return res.WebResponse.setContent({ id: subtask._id }).send();
	}
	async getIdentifier(name, user) {
		let identifier = name
			.toLowerCase()
			.match(/[\p{Letter}\p{Number}]/gu)
			.join("");
		let identifierIndex = 0;
		let exists = Boolean(await this.Web.db.TodoList_List({ user: user._id, identifier }));
		while (exists) {
			identifier = identifier.replace(/_[0-9]+$|(?<!_[0-9]+)$/g, `_${++identifierIndex}`);
			exists = Boolean(await this.Web.db.TodoList_List({ user: user._id, identifier }));
		}
		return identifier;
	}
	async deleteList(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let id = req.body.id;
		if (!id) return res.WebResponse.error("MISSING_PARAMETER");

		let deleted = await this.Web.db.models.TodoList_Lists.deleteOne({ _id: id });
		if (!deleted?.deletedCount) return res.WebResponse.error("NOT_FOUND");

		let taskDeleted;
		if (req.body.deleteTasks === "true") {
			taskDeleted = await this.Web.db.models.TodoList_Tasks.deleteMany({ list: { $elemMatch: id } });
		} else {
			let tasks = await this.Web.db.TodoList_Task({ user: target._id, list: { $elemMatch: id } }, { limit: this.maxTasksPerUser });
			for (let task of tasks) {
				task.lists = task.lists.filter((list) => list != id);
				await task.save();
			}
		}

		res.WebResponse.setContent({ deletedTasksCount: taskDeleted?.deletedCount || 0 }).send();
	}
	async complete(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		if (typeof req.body.id != "string" || typeof req.body.completed != "string") return res.WebResponse.error("MISSING_PARAMETER");

		let task = await this.Web.db.TodoList_Task({ _id: req.body.id });
		if (!task) return res.WebResponse.error("NOT_FOUND");

		task.completed = req.body.completed == "true";
		await task.save();

		res.WebResponse.send();
	}
	async delete(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		if (typeof req.body.id != "string") return res.WebResponse.error("MISSING_PARAMETER");

		let task = await this.Web.db.TodoList_Task({ _id: req.body.id });
		if (!task) return res.WebResponse.error("NOT_FOUND");

		await task.remove();

		if (task.type == "subtask") {
			let parentTask = await this.Web.db.TodoList_Task({ subtasks: task._id });
			if (parentTask) {
				parentTask.subtasks.splice(
					parentTask.subtasks.findIndex((st) => st._id == task._id),
					1
				);
				await parentTask.save();
			}
		}

		res.WebResponse.send();
	}
	async setListColor(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		if (
			typeof req.body?.id != "string" || typeof req.body?.color == "string"
				? !/#[a-zA-Z0-9]{3,8}/.test(req.body?.color || "")
				: (req.body.color = null)
		)
			return res.WebResponse.error("MISSING_PARAMETER");

		let list = await this.Web.db.TodoList_List({ _id: req.body?.id });
		if (!list) return res.WebResponse.error("NOT_FOUND");

		list.color = req.body?.color;
		await list.save();

		return res.WebResponse.send();
	}
	async setListIcon(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		if (!req.body?.id || !req.body?.icon) return res.WebResponse.error("MISSING_PARAMETER");

		let list = await this.Web.db.TodoList_List({ _id: req.body?.id });
		if (!list) return res.WebResponse.error("NOT_FOUND");

		list.icon = req.body.icon;
		await list.save();

		return res.WebResponse.send();
	}
	async rename(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let name = req.body?.name,
			id = req.body?.id;
		if (typeof name != "string" || !id) return res.WebResponse.error("MISSING_PARAMETER");
		if (name.length < this.minListNameLength || name.length > this.maxListNameLength) return res.WebResponse.error("BAD_REQUEST");

		let list = await this.Web.db.TodoList_List({ _id: id });
		if (!list) return res.WebResponse.error("NOT_FOUND");

		if (name == list.name) return res.WebResponse.error("BAD_REQUEST");

		list.name = name;
		list.identifier = await this.getIdentifier(name, target);
		await list.save();

		return res.WebResponse.send();
	}
	async description(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let taskId = req.body?.task;
		let description = req.body?.description;
		if (!taskId || !description) return res.WebResponse.error("MISSING_PARAMETER");

		let task = await this.Web.db.TodoList_Task({ _id: taskId, type: "task" });
		if (!task) return res.WebResponse.error("NOT_FOUND");

		if (
			typeof description != "string" ||
			(description = description.trim()).length < this.minTaskDescriptionLength ||
			description.length > this.maxTaskDescriptionLength
		)
			return res.WebResponse.error("BAD_REQUEST");

		task.description = description;
		await task.save();

		return res.WebResponse.send();
	}
	async text(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let taskId = req.body?.task;
		let text = req.body?.text;
		if (!taskId || !text) return res.WebResponse.error("MISSING_PARAMETER");

		let task = await this.Web.db.TodoList_Task({ _id: taskId });
		if (!task) return res.WebResponse.error("NOT_FOUND");

		if (typeof text != "string" || (text = text.trim()).length < this.minTaskTextLength || text.length > this.maxTaskTextLength)
			return res.WebResponse.error("BAD_REQUEST");

		task.text = text;
		await task.save();

		return res.WebResponse.send();
	}
	async setLists(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let lists = req.body.lists || [];
		let taskId = req.body.task;
		if (!taskId) return res.WebResponse.error("MISSING_PARAMETER");

		if (!(lists instanceof Array)) return res.WebResponse.error("BAD_REQUEST");

		let task = await this.Web.db.TodoList_Task({ _id: taskId });
		if (!task) return res.WebResponse.error("NOT_FOUND");

		lists = await Promise.all(lists.map(async (list) => await this.Web.db.TodoList_List({ _id: list })));
		if (lists.some((list) => !list)) return res.WebResponse.error("NOT_FOUND");

		task.lists = lists.map((list) => list._id);
		await task.save();

		return res.WebResponse.send();
	}
	async getTarget(req, res) {
		let target = req.WebRequest.user;
		if (req.params.user) {
			let user = await this.Web.db.User({ username: req.params.user });
			if (!user) return void res.WebResponse.error("NOT_FOUND");
			if (target._id != user._id && !(await target.checkPermissions(["WEB_ADMIN_TODOLIST_PAGE"])))
				return void res.WebResponse.error("UNAUTHORIZED");
			target = user;
		}
		return target;
	}
}

module.exports = TodoList;
