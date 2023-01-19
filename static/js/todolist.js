SAHYG.Classes.TodoList = class TodoList {
	$menu = $("container .menu");
	$menuBody = $("container .menu .body .categories");
	$tasksBody = $("container .tasks .body .todo");
	$completedBody = $("container .tasks .body .completed");
	$competedLabel = $("container .tasks .body .completed-label");
	$panel = $("container .panel");
	$backdrops = $("container .backdrop");
	$tasksHeaderCategory = $("container .tasks .header .category .text");
	$addCategory = $("container .menu .add");
	$menuIcon = $("container .tasks .menu-icon");
	$closeMenuIcon = $("container .menu .menu-icon");
	$taskPlus = $("container .tasks .header .plus");
	$taskInput = $("container .tasks .header .new-task");
	$allTasks = $("container .menu .item.all-tasks");
	constructor() {
		this.$completedBody.slideUp(0);
		this.categoryLoader = SAHYG.Components.loader.replaceContent(this.$menuBody);
		this.tasksLoader = SAHYG.Components.loader.replaceContent(this.$tasksBody);

		this.load();

		SAHYG.on("click", this.$backdrops, this.closeAll.bind(this));
		SAHYG.on("click", "container .menu .item", ({ target }) => {
			if (target.closest(".item > .menu")) return;
			console.log("click", target);
			return this.switchCategory(target);
		});
		SAHYG.on("click", this.$addCategory, this.addCategory.bind(this));
		SAHYG.on("click", this.$competedLabel, this.toggleCompletedList.bind(this));
		SAHYG.on("click", this.$menuIcon, this.toggleMenu.bind(this));
		SAHYG.on("click", this.$closeMenuIcon, this.$menu.removeClass.bind(this.$menu, "opened"));
		SAHYG.on("click", "container .tasks .task .complete", ({ target }) => {
			let task = $(target).closest(".subtask");
			if (!task.length) task = $(target).closest(".task");
			this.completeTask(task.attr("data-id"));
		});
		SAHYG.on("click", "container .tasks .task .subtask-label", this.toggleSubtaskView.bind(this));
		SAHYG.on("click", this.$taskPlus, () => {
			let text = this.$taskInput.val();
			if (!text.length) return this.$taskInput.focus();
			this.addTask(text);
		});
	}
	async load() {
		this.tasks = await this.getTasks();
		this.categories = await this.getCategories();

		this.categoryLoader.done();
		this.tasksLoader.done();

		for (let category of this.categories) {
			await this.addCategoryElement(category);
		}

		await this.showCategory();
	}
	getTasks() {
		return new Promise((resolve) => {
			SAHYG.Api.get(location.pathname + "/tasks")
				.then((result) => resolve(result.tasks))
				.catch(() => {});
		});
	}
	getCategories() {
		return new Promise((resolve) => {
			SAHYG.Api.get(location.pathname + "/categories")
				.then((result) => resolve(result.categories))
				.catch(() => {});
		});
	}
	closeAll() {
		this.$menu.removeClass("opened");
		this.$panel.removeClass("opened");
	}
	async categoryElement({ _id, name, color }) {
		let menu;
		let category = SAHYG.createElement(
			"div",
			{ class: "item", "data-id": _id, style: color ? `color: ${color}` : "" },
			SAHYG.createElement("span", { class: "icon" }, "&#xf0ae;"),
			SAHYG.createElement("span", { class: "text" }, name),
			(menu = SAHYG.createElement("span", { class: "menu lafs" }, "&#xf141;"))
		);
		SAHYG.Components.tooltip.menu(menu, [
			{
				type: "button",
				text: await SAHYG.translate("CHANGE_COLOR"),
				icon: "&#xf53f;",
				callback: this.changeColorPopup.bind(this, _id),
			},
			{
				type: "button",
				text: await SAHYG.translate("RESET_COLOR"),
				icon: "&#xf5c7;",
				callback: this.changeColor.bind(this, _id, null),
			},
			{ type: "divider" },
			{
				type: "button",
				text: await SAHYG.translate("REMOVE"),
				icon: "&#xf2ed;",
				callback: this.deleteCategory.bind(this, _id),
				attributes: { style: "color: var(--danger-color)" },
			},
			{
				type: "button",
				text: await SAHYG.translate("REMOVE_WITH_TASKS"),
				icon: "&#xf2ed;",
				callback: this.deleteCategory.bind(this, _id, true),
				attributes: { style: "color: var(--danger-color)" },
			},
		]);
		return category;
	}
	async changeColorPopup(category) {
		let { color } =
			(await SAHYG.Components.popup.Popup.input(
				await SAHYG.translate("CHANGE_COLOR"),
				[
					{
						type: "color",
						defaultValue: this.categories.find((c) => c._id == category)?.color,
						name: "color",
						label: await SAHYG.translate("COLOR"),
						autoFocus: true,
					},
				],
				false
			)) || {};

		if (!color) return;

		this.changeColor(category, color);
	}
	changeColor(categoryId, color) {
		SAHYG.Api.post(
			location.pathname + "/category_color",
			{
				id: categoryId,
				color,
			},
			true
		)
			.then((res) => {
				if (!res?.success) return;
				let category = this.categories.find((c) => c._id == categoryId);
				category.color = color;

				$(`container .menu .item[data-id=${categoryId}]`).attr("style", `color: ${color};`);
			})
			.catch(() => {});
	}
	async taskElement({ text, id, completed, subtasks }) {
		let menu;
		let element = SAHYG.createElement(
			"div",
			{ class: "task", "data-id": id },
			SAHYG.createElement(
				"div",
				{ class: "task-container" },
				SAHYG.createElement("span", { class: "complete" + (completed ? " completed" : "") }, ""),
				SAHYG.createElement("div", { class: "task-body" }, SAHYG.createElement("span", { class: "text" }, text)),
				(menu = SAHYG.createElement("span", { class: "menu lafs" }, "&#xf141;"))
			)
		);
		// Create task options menu
		SAHYG.Components.tooltip.menu(menu, [
			{
				type: "button",
				text: await SAHYG.translate("REMOVE"),
				icon: "&#xf2ed;",
				callback: this.deleteTask.bind(this, id),
				attributes: { style: "color: var(--danger-color)" },
			},
		]);

		if (subtasks.length) {
			let container;
			element.append(
				SAHYG.createElement("span", { class: "subtask-label expanded" }, await SAHYG.translate("SUBTASKS")),
				(container = SAHYG.createElement("div", { class: "subtask-container" }))
			);
			for (let subtask of subtasks) {
				container.append(
					SAHYG.createElement(
						"div",
						{ class: "subtask", "data-id": subtask._id },
						SAHYG.createElement("span", { class: "complete" + (subtask.completed ? " completed" : "") }, ""),
						SAHYG.createElement("div", { class: "task-body" }, SAHYG.createElement("span", { class: "text" }, subtask.text)),
						(menu = SAHYG.createElement("span", { class: "menu lafs" }, "&#xf141;"))
					)
				);
				// Create subtask options menu
				SAHYG.Components.tooltip.menu(menu, [
					{ type: "button", text: await SAHYG.translate("REMOVE"), icon: "&#xf2ed;", callback: this.deleteTask.bind(this, subtask._id) },
				]);
			}
		}

		return element;
	}
	async showCategory(id) {
		let tasks,
			category = {};

		if (!id) {
			category.name = this.$allTasks.children(".text").text();
			tasks = this.tasks;
		} else {
			category = this.categories.find((category) => category._id == id);
			if (!category) {
				category = {
					name: await SAHYG.translate("UNKNOWN"),
				};
				tasks = [];
			} else tasks = this.tasks.filter((task) => task.categories.includes(id));
		}

		let completedTasks = [];

		tasks =
			tasks?.filter((task) => {
				if (task.completed) {
					completedTasks.push(task);
					return false;
				}
				return true;
			}) || [];

		this.$tasksHeaderCategory.text(category.name);
		this.$menu.removeClass("opened");
		this.$tasksBody.children().remove();
		this.$completedBody.children().remove();

		for (let task of tasks) {
			this.$tasksBody.append(await this.taskElement({ text: task.text, id: task._id, completed: task.completed, subtasks: task.subtasks }));
		}
		for (let task of completedTasks) {
			this.$completedBody.append(await this.taskElement({ text: task.text, id: task._id, completed: task.completed, subtasks: task.subtasks }));
		}
	}
	async addCategory() {
		let data = await SAHYG.Components.popup.Popup.input(
			await SAHYG.translate("ADD_CATEGORY"),
			[
				{
					name: "name",
					label: await SAHYG.translate("NAME"),
					placeholder: await SAHYG.translate("NAME"),
					type: "text",
					required: true,
				},
			],
			false
		);
		if (!data) return;

		await SAHYG.Api.post(
			location.pathname + "/add_category",
			{
				name: data.name,
			},
			true
		)
			.catch(() => {})
			.then(async (res) => {
				if (!res?.success) return;
				await this.addCategoryElement({ _id: res.content.id, name: data.name });
				this.categories.push({ _id: res.content.id, name: data.name });
			});
	}
	async deleteCategory(id, deleteTasks) {
		if (deleteTasks === true && !(await SAHYG.Components.popup.Popup.confirm(await SAHYG.translate("REMOVE_WITH_TASKS_DESCRIPTION"))).confirm)
			return;
		else if (!(await SAHYG.Components.popup.Popup.confirm(await SAHYG.translate("CONFIRM_DELETE"))).confirm) return;

		await SAHYG.Api.post(location.pathname + "/delete_category", { id, deleteTasks: deleteTasks === true }, true)
			.catch(() => {})
			.then((res) => {
				if (!res?.success) return;
				this.deleteCategoryElement(id);
				this.categories = this.categories.filter((category) => category._id != id);
			});
	}
	async addCategoryElement(category) {
		this.$menuBody.append(await this.categoryElement(category));
	}
	deleteCategoryElement(id) {
		$(`container .menu .item[data-id="${id}"]`).remove();
	}
	toggleCompletedList() {
		this.$competedLabel.toggleClass("expanded");
		this.$completedBody.slideToggle(200);
	}
	async switchCategory(target) {
		target = $(target);
		await this.showCategory(target.closest(".item").attr("data-id"));
	}
	toggleMenu() {
		this.$menuIcon.toggleClass("opened");
		this.$menu.toggleClass("opened");
	}
	completeTask(id) {
		let taskIndex = this.tasks.findIndex((task) => task._id == id);
		if (taskIndex == -1) {
			let subtaskIndex;
			taskIndex = this.tasks.findIndex((task) => (subtaskIndex = task.subtasks.findIndex((subtask) => subtask._id == id)) != -1);

			if (taskIndex == -1) return;

			let completed = !this.tasks[taskIndex].subtasks[subtaskIndex].completed;

			SAHYG.Api.post(location.pathname + "/complete", { id, completed }, true)
				.catch(() => {})
				.then((res) => {
					if (!res?.success) return;

					this.tasks[taskIndex].subtasks[subtaskIndex].completed = completed;
					let subtaskElement = $(this.$tasksBody.find(`.subtask[data-id=${id}]`));
					if (subtaskElement.length) {
						if (completed) subtaskElement.children(".complete").addClass("completed");
						else subtaskElement.children(".complete").removeClass("completed");
					} else {
						subtaskElement = $(this.$completedBody.find(`.subtask[data-id=${id}]`));
						if (subtaskElement.length) {
							if (completed) subtaskElement.children(".complete").addClass("completed");
							else subtaskElement.children(".complete").removeClass("completed");
						}
					}
				});
		} else {
			let completed = !this.tasks[taskIndex].completed;

			SAHYG.Api.post(location.pathname + "/complete", { id, completed }, true)
				.catch(() => {})
				.then((res) => {
					if (!res?.success) return;

					this.tasks[taskIndex].completed = completed;
					let taskElement = $(this.$tasksBody.find(`.task[data-id=${id}]`));
					if (taskElement.length) {
						if (completed) taskElement.find(".task-container .complete").addClass("completed");
						else taskElement.find(".task-container .complete").removeClass("completed");
						taskElement.remove();
						this.$completedBody.append(taskElement);
					} else {
						taskElement = $(this.$completedBody.find(`.task[data-id=${id}]`));
						if (taskElement.length) {
							if (completed) taskElement.find(".task-container .complete").addClass("completed");
							else taskElement.find(".task-container .complete").removeClass("completed");
							taskElement.remove();
							this.$tasksBody.append(taskElement);
						}
					}
				});
		}
	}
	async deleteTask(id) {
		let taskIndex = this.tasks.findIndex((task) => task._id == id);
		if (taskIndex == -1) return;

		let task = this.tasks.splice(taskIndex);

		if (!(await SAHYG.Components.popup.Popup.confirm(await SAHYG.translate("CONFIRM_DELETE"))).confirm) return;

		SAHYG.Api.post(location.pathname + "/delete", { id }, true)
			.catch(() => {})
			.then((res) => {
				if (!res?.success) return;

				let taskElement = $(this.$tasksBody.find(`.task[data-id=${id}]`));
				if (!taskElement.length) taskElement = $(this.$completedBody.find(`.task[data-id=${id}]`));

				taskElement.remove();
			});
	}
	toggleSubtaskView({ target }) {
		target = $(target);
		target.closest(".task").find(".subtask-container").slideToggle(200);
		target.toggleClass("expanded");
	}
	async addTask(text) {}
};

$(() => (SAHYG.Instances.TodoList = new SAHYG.Classes.TodoList()));
