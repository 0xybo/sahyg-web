const Page = require("../lib/page");

class TodoList extends Page {
	constructor(/** @type {import('../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.maxCategoriesPerUser = this.Web.config.get("pages.todolist.maxCategoriesPerUser");
		this.maxTasksPerUser = this.Web.config.get("pages.todolist.maxTasksPerUser");

		this.setGet(["/todolist", "/user/:user/todolist"], this.get.bind(this));
		this.setGet(["/todolist/tasks", "/user/:user/todolist/tasks"], this.tasks.bind(this));
		this.setGet(["/todolist/categories", "/user/:user/todolist/categories"], this.categories.bind(this));
		this.setPost(["/todolist/add_category", "/user/:user/todolist/add_category"], this.addCategory.bind(this));
		this.setPost(["/todolist/delete_category", "/user/:user/todolist/delete_category"], this.deleteCategory.bind(this));
		this.setPost(["/todolist/category_color", "/user/:user/todolist/category_color"], this.setCategoryColor.bind(this));
		this.setPost(["/todolist/complete", "/user/:user/todolist/complete"], this.complete.bind(this));
		this.setPost(["/todolist/delete", "/user/:user/todolist/delete"], this.delete.bind(this));
	}
	async get(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		res.WebResponse.render("todolist", { target });
	}
	async tasks(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let tasks = (await this.Web.db.TodoListTask({ user: target._id, type: "task" }, { limit: 1000, fetchSubtasks: true })) || [];

		res.WebResponse.setContent({ tasks }).send();
	}
	async categories(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let categories = (await this.Web.db.TodoListCategory({ user: target._id }, { limit: 1000 })) || [];

		res.WebResponse.setContent({ categories }).send();
	}
	async addCategory(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let name = req.body.name;
		if (name.length > 20) return res.WebResponse.error("NAME_TOO_LONG");

		let categories = await this.Web.db.TodoListCategory({ user: target._id }, { limit: this.maxCategoriesPerUser + 1 });
		if (categories.length > this.maxCategoriesPerUser) return res.WebResponse.error("TOO_MANY_CATEGORIES");

		let category = await this.Web.db.TodoListCategory({ user: target._id, name }, { get: false });
		await category.save();

		res.WebResponse.setContent({ id: category._id }).send();
	}
	async deleteCategory(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		let id = req.body.id;
		if (!id) return res.WebResponse.error("MISSING_PARAMETER");

		let deleted = await this.Web.db.models.TodoListCategories.deleteOne({ _id: id });
		if (!deleted?.deletedCount) return res.WebResponse.error("NOT_FOUND");

		let taskDeleted;
		if (req.body.deleteTasks === "true") {
			taskDeleted = await this.Web.db.models.TodoListTasks.deleteMany({ category: { $elemMatch: id } });
		} else {
			let tasks = await this.Web.db.TodoListTask({ user: target._id, category: { $elemMatch: id } }, { limit: this.maxTasksPerUser });
			for (let task of tasks) {
				task.categories = task.categories.filter((category) => category != id);
				await task.save();
			}
		}

		res.WebResponse.setContent({ deletedTasksCount: taskDeleted?.deletedCount || 0 }).send();
	}
	async complete(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		if (typeof req.body.id != "string" || typeof req.body.completed != "string") return res.WebResponse.error("MISSING_PARAMETER");

		let task = await this.Web.db.TodoListTask({ _id: req.body.id });
		if (!task) return res.WebResponse.error("NOT_FOUND");

		task.completed = req.body.completed == "true";
		await task.save();

		res.WebResponse.send();
	}
	async delete(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		if (typeof req.body.id != "string") return res.WebResponse.error("MISSING_PARAMETER");

		let task = await this.Web.db.TodoListTask({ _id: req.body.id });
		if (!task) return res.WebResponse.error("NOT_FOUND");

		await task.remove();

		res.WebResponse.send();
	}
	async setCategoryColor(req, res) {
		let target = await this.getTarget(req, res);
		if (!target) return;

		if (
			typeof req.body?.id != "string" || typeof req.body?.color == "string"
				? !/#[a-zA-Z0-9]{3,8}/.test(req.body?.color || "")
				: (req.body.color = null)
		)
			return res.WebResponse.error("MISSING_PARAMETER");

		let category = await this.Web.db.TodoListCategory({ _id: req.body?.id });
		if (!category) return res.WebResponse.error("NOT_FOUND");

		category.color = req.body?.color;
		await category.save();

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
