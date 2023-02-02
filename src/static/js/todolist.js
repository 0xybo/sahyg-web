SAHYG.Classes.TodoList = class TodoList {
	$menu = $("container .menu");
	$menuBody = $("container .menu .body .lists");
	$tasksBody = $("container .tasks .body .todo");
	$completedBody = $("container .tasks .body .completed");
	$competedLabel = $("container .tasks .body .completed-label");
	$panel = $("container .panel");
	$tasksHeaderList = $("container .tasks .header .list .text");
	$tasksHeaderIcon = $("container .tasks .header .list .icon");
	$addList = $("container .menu .add");
	$menuIcon = $("container .tasks .menu-icon");
	$closeMenuIcon = $("container .menu .menu-icon");
	$taskPlus = $("container .tasks .header .plus");
	$taskInput = $("container .tasks .header .new-task");
	$allTasks = $("container .menu .item.all-tasks");
	$headerActions = $("container .tasks .header .actions");

	currentList = null;
	constructor() {
		this.$completedBody.slideUp(0);
		this.listLoader = SAHYG.Components.loader.replaceContent(this.$menuBody);
		this.tasksLoader = SAHYG.Components.loader.replaceContent(this.$tasksBody);

		this.taskViewer = new SAHYG.Components.popup.Menu();

		this.load();

		SAHYG.on("click", this.$menu, ({ target }) => {
			if ($(target).is(this.$closeMenuIcon)) this.$menu.removeClass("opened");
			if ($(target).closest(".menu > .body").length) return true;
			this.$menu.removeClass("opened");
		});
		SAHYG.on("click", "container .menu .item", ({ target }) => {
			if ($(target).closest(".item > .menu").length) return;
			return this.switchList(target);
		});
		SAHYG.on("click", this.$addList, this.addList.bind(this));
		SAHYG.on("click", this.$competedLabel, this.toggleCompletedList.bind(this));
		SAHYG.on("click", this.$menuIcon, this.toggleMenu.bind(this));
		SAHYG.on("click", "container .tasks .task .complete", ({ target }) => {
			let task = $(target).closest(".subtask");
			if (!task.length) task = $(target).closest(".task");
			this.completeTask(task.attr("data-id"));
		});
		SAHYG.on("click", "container .tasks .task .subtask-label", this.toggleSubtaskView.bind(this));
		SAHYG.on("click", this.$taskPlus, () => {
			let text = this.$taskInput.val();
			if (!text.length) return this.$taskInput.focus();
			this.addTask(text, this.currentList);
			this.$taskInput.val("");
		});
		SAHYG.on("keypress", this.$taskInput, ({ keyCode }) => {
			let value = this.$taskInput.val();
			if (keyCode == 13) {
				if (value.length > SAHYG.Constants.todolist_max_task_text_length || value.length < SAHYG.Constants.todolist_mix_task_text_length)
					return;
				this.addTask(value, this.currentList);
				this.$taskInput.val("");
			}
		});
		SAHYG.on("input", this.$taskInput, () => {
			let value = this.$taskInput.val();
			if (value.length > SAHYG.Constants.todolist_max_task_text_length || value.length < SAHYG.Constants.todolist_min_task_text_length)
				this.$taskInput.addClass("invalid");
			else this.$taskInput.removeClass("invalid");
		});
		SAHYG.on("click", "container .tasks .task", ({ target }) => {
			if ($(target).closest(".task .complete, .task .menu, .subtask").length) return true;
			this.showTask($(target).closest(".task").attr("data-id"));
		});
		SAHYG.on("input", "menu .task-text textarea, menu .task-add-subtask textarea", ({ target }) => SAHYG.Utils.element.resizeTextarea(target));
	}
	async load() {
		this.tasks = await this.getTasks();
		this.lists = await this.getLists();

		this.listLoader.done();
		this.tasksLoader.done();

		for (let list of this.lists) {
			await this.addListElement(list);
		}

		let listIdentifier = SAHYG.Utils.url.getParams()?.list;
		if (listIdentifier) {
			let list = this.lists.find((list) => list.identifier == listIdentifier);
			if (list) await this.showList(list._id);
			else await this.showList();
		} else await this.showList();

		this.updateCounter();
	}
	getTasks() {
		return new Promise((resolve) => {
			SAHYG.Api.get(location.pathname + "/tasks")
				.then((result) => resolve(result.tasks))
				.catch(console.log);
		});
	}
	getLists() {
		return new Promise((resolve) => {
			SAHYG.Api.get(location.pathname + "/lists")
				.then((result) => resolve(result.lists))
				.catch(console.log);
		});
	}

	async showList(id) {
		let tasks,
			list = {};

		$("container .lists .item").removeClass("opened");
		if (!id) {
			list.name = this.$allTasks.children(".text").text();
			tasks = this.tasks;
			this.$allTasks.addClass("opened");
		} else {
			list = this.lists.find((list) => list._id == id);
			if (!list) {
				list = {
					name: await SAHYG.translate("UNKNOWN"),
				};
				tasks = [];
			} else tasks = this.tasks.filter((task) => task.lists.includes(id));
			$(`container .lists .item[data-id=${id}]`).addClass("opened");
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

		this.$tasksHeaderList.text(list.name).css("color", list.color || "inherit");
		this.$tasksHeaderIcon.html(list.icon || SAHYG.Constants.todolist_default_icon || "&#xf022;").css("color", list.color || "inherit");
		this.$menu.removeClass("opened");
		this.$tasksBody.children().remove();
		this.$completedBody.children().remove();

		for (let task of tasks) {
			this.$tasksBody.append(await this.taskElement({ text: task.text, id: task._id, completed: task.completed, subtasks: task.subtasks }));
		}
		for (let task of completedTasks) {
			this.$completedBody.append(await this.taskElement({ text: task.text, id: task._id, completed: task.completed, subtasks: task.subtasks }));
		}

		this.$headerActions.children().remove();
		if (id) {
			let menu;
			this.$headerActions.append((menu = SAHYG.createElement("span", { class: "menu lafs" }, "&#xf141;")));
			await this.listMenu(menu, id);
		}

		if (list.identifier) SAHYG.Utils.url.setLocationParam("list", list.identifier);
		else SAHYG.Utils.url.removeLocationParam("list");

		this.currentList = id || null;
	}
	async showTask(id) {
		let task = this.tasks.find((task) => task._id == id);
		if (!task) return;
		this.taskViewer
			.setTitle(await SAHYG.translate("EDIT_TASK"))
			.setContent([
				SAHYG.createElement(
					"div",
					{ class: "task-container" },
					SAHYG.createElement(
						"div",
						{ class: "task-text" },
						SAHYG.createElement("span", { class: "task-complete" + (task.completed ? " completed" : "") }),
						SAHYG.createElement("textarea", {}, task.text)
					),
					SAHYG.createElement(
						"div",
						{ class: "task-subtasks" },
						...task.subtasks.map((subtask) =>
							SAHYG.createElement(
								"div",
								{ class: "task-subtask" },
								SAHYG.createElement(
									"div",
									{ class: "task-subtask-text" },
									SAHYG.createElement("span", { class: "task-subtask-complete" + (subtask.completed ? " completed" : "") }),
									SAHYG.createElement("textarea", { type: "text" }, subtask.text),
									SAHYG.createElement("btn", { class: "task-subtask-delete lafs" }, "&#xf2ed;")
								)
							)
						),
						SAHYG.createElement(
							"div",
							{ class: "task-add-subtask" },
							SAHYG.createElement("span", { class: "task-add-subtask-icon lafs" }, "&#xf067;"),
							SAHYG.createElement("textarea", { type: "text" })
						)
					)
				),
			]);
		this.taskViewer.open();
	}
	async listElement({ _id, name, color, icon, identifier }) {
		let menu;
		let list = SAHYG.createElement(
			"div",
			{ class: "item", "data-id": _id, style: color ? `color: ${color}` : "", "data-identifier": identifier },
			SAHYG.createElement("span", { class: "icon" }, icon || SAHYG.Constants.todolist_default_icon || "&#xf022;"),
			SAHYG.createElement("span", { class: "text" }, name),
			SAHYG.createElement(
				"span",
				{ class: "count" },
				`${this.tasks.filter((task) => task.lists.includes(_id) && !task.completed)?.length}/${
					this.tasks.filter((task) => task.lists.includes(_id))?.length
				}` || "0/0"
			),
			(menu = SAHYG.createElement("span", { class: "menu lafs" }, "&#xf141;"))
		);

		await this.listMenu(menu, _id);

		return list;
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

	async listMenu(menu, id) {
		SAHYG.Components.tooltip.menu(menu, [
			{
				type: "dropdown",
				icon: "&#xf304;",
				text: await SAHYG.translate("EDIT"),
				dropdown: [
					{
						type: "button",
						text: await SAHYG.translate("RENAME"),
						icon: "&#xf031;",
						callback: this.renamePopup.bind(this, id),
					},
					{ type: "divider" },
					{
						type: "button",
						text: await SAHYG.translate("CHANGE_COLOR"),
						icon: "&#xf53f;",
						callback: this.changeColorPopup.bind(this, id, menu.get(0)),
					},
					{
						type: "button",
						text: await SAHYG.translate("RESET_COLOR"),
						icon: "&#xf5c7;",
						callback: this.changeColor.bind(this, id, null),
					},
					{ type: "divider" },
					{
						type: "button",
						text: await SAHYG.translate("CHANGE_ICON"),
						icon: "&#xf03a;",
						callback: this.changeIconPopup.bind(this, id, menu.get(0)),
					},
					{
						type: "button",
						text: await SAHYG.translate("RESET_ICON"),
						icon: "&#xf0ae;",
						callback: this.changeIcon.bind(this, id, null),
					},
				],
			},
			{ type: "divider" },
			{
				type: "button",
				text: await SAHYG.translate("REMOVE"),
				icon: "&#xf2ed;",
				callback: this.deleteList.bind(this, id),
				attributes: { style: "color: var(--danger-color)" },
			},
			{
				type: "button",
				text: await SAHYG.translate("REMOVE_WITH_TASKS"),
				icon: "&#xf2ed;",
				callback: this.deleteList.bind(this, id, true),
				attributes: { style: "color: var(--danger-color)" },
			},
		]);
	}
	toggleMenu() {
		this.$menuIcon.toggleClass("opened");
		this.$menu.toggleClass("opened");
	}

	async changeColorPopup(list, target) {
		let color = await SAHYG.Utils.input.color(target, this.lists.find((l) => l._id == list)?.color);

		if (!color) return;

		this.changeColor(list, color);
	}
	changeColor(listId, color) {
		SAHYG.Api.post(
			location.pathname + "/list_color",
			{
				id: listId,
				color,
			},
			true
		)
			.then((res) => {
				if (!res?.success) return;
				let list = this.lists.find((c) => c._id == listId);
				list.color = color;

				$(`container .menu .item[data-id=${listId}]`).attr("style", `color: ${color};`);

				this.showList(list._id);
			})
			.catch(console.log);
	}
	async renamePopup(listID) {
		let name = await SAHYG.Utils.input.text({
			defaultValue: this.lists.find((list) => list._id == listID)?.name,
			title: await SAHYG.translate("RENAME"),
			validator: (value) => {
				return (value?.length || 0) <= SAHYG.Constants.todolist_max_list_name_length;
			},
		});
		if (!name) return;
		this.rename(listID, name);
	}
	async rename(id, name) {
		SAHYG.Api.post(location.pathname + "/rename_list", { id, name }, true)
			.then((res) => {
				if (!res.success) return;
				$(`container .lists [data-id=${id}] .text`).text(name);
				let list = this.lists.find((list) => list._id == id);
				list.name = name;

				this.showList(list._id);
			})
			.catch(console.log);
	}
	async changeIconPopup(list, target) {
		let icon = await SAHYG.Utils.input.icon(target);
		if (!icon) return;
		await this.changeIcon(list, `&#x${icon.unicode};`);
	}
	async changeIcon(list, icon) {
		list = this.lists.find((l) => l._id == list);
		if (!list) return;

		if (!icon) icon = SAHYG.Constants.todolist_default_icon || "&#xf022;";

		if (list.icon == icon) return;

		SAHYG.Api.post(location.pathname + "/list_icon", { id: list._id, icon }, true)
			.then((res) => {
				if (!res.success) return;

				list.icon = icon;
				$(`container .menu .item[data-id="${list._id}"] .icon`).html(icon);

				this.showList(list._id);
			})
			.catch(console.log);
	}

	async addList() {
		let data = await SAHYG.Components.popup.Popup.input(
			await SAHYG.translate("ADD_CATEGORY"),
			[
				{
					name: "name",
					label: await SAHYG.translate("NAME"),
					placeholder: await SAHYG.translate("NAME"),
					type: "text",
					required: true,
					validator: (value) => value.length > 2 && value.length < 20,
				},
			],
			false
		);
		if (!data) return;

		await SAHYG.Api.post(
			location.pathname + "/add_list",
			{
				name: data.name,
			},
			true
		)
			.catch(console.log)
			.then(async (res) => {
				if (!res?.success) return;
				await this.addListElement({ _id: res.content.id, name: data.name, identifier: res.content.identifier });
				this.lists.push({ _id: res.content.id, name: data.name, identifier: res.content.identifier });
			});
	}
	async deleteList(id, deleteTasks) {
		if (deleteTasks === true && !(await SAHYG.Components.popup.Popup.confirm(await SAHYG.translate("REMOVE_WITH_TASKS_DESCRIPTION"))).confirm)
			return;
		else if (!(await SAHYG.Components.popup.Popup.confirm(await SAHYG.translate("CONFIRM_DELETE"))).confirm) return;

		await SAHYG.Api.post(location.pathname + "/delete_list", { id, deleteTasks: deleteTasks === true }, true)
			.catch(console.log)
			.then((res) => {
				if (!res?.success) return;
				this.deleteListElement(id);
				this.lists = this.lists.filter((list) => list._id != id);
			});
	}
	async addTask(text, list) {
		SAHYG.Api.post(location.pathname + "/add_task", { text, list: list || null }, true)
			.then(async (res) => {
				if (!res?.success) return;

				let task = res.content?.task;
				if (!task) return;

				this.tasks.push(task);

				await this.showList(list || null);
				this.updateCounter();
			})
			.catch(console.log);
	}
	async deleteTask(id) {
		let taskIndex = this.tasks.findIndex((task) => task._id == id);
		if (taskIndex == -1) return;

		let task = this.tasks.splice(taskIndex);

		if (!(await SAHYG.Components.popup.Popup.confirm(await SAHYG.translate("CONFIRM_DELETE"))).confirm) return;

		SAHYG.Api.post(location.pathname + "/delete", { id }, true)
			.catch(console.log)
			.then((res) => {
				if (!res?.success) return;

				let taskElement = $(this.$tasksBody.find(`.task[data-id=${id}]`));
				if (!taskElement.length) taskElement = $(this.$completedBody.find(`.task[data-id=${id}]`));

				taskElement.remove();
			});
	}

	async addListElement(list) {
		this.$menuBody.append(await this.listElement(list));
		this.updateCounter();
	}
	deleteListElement(id) {
		$(`container .menu .item[data-id="${id}"]`).remove();
		this.updateCounter();
	}
	toggleCompletedList() {
		this.$competedLabel.toggleClass("expanded");
		this.$completedBody.slideToggle(200);
	}
	async switchList(target) {
		target = $(target);
		await this.showList(target.closest(".item").attr("data-id"));
	}
	completeTask(id) {
		let taskIndex = this.tasks.findIndex((task) => task._id == id);
		if (taskIndex == -1) {
			let subtaskIndex;
			taskIndex = this.tasks.findIndex((task) => (subtaskIndex = task.subtasks.findIndex((subtask) => subtask._id == id)) != -1);

			if (taskIndex == -1) return;

			let completed = !this.tasks[taskIndex].subtasks[subtaskIndex].completed;

			SAHYG.Api.post(location.pathname + "/complete", { id, completed }, true)
				.catch(console.log)
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
					this.updateCounter();
				});
		} else {
			let completed = !this.tasks[taskIndex].completed;

			SAHYG.Api.post(location.pathname + "/complete", { id, completed }, true)
				.catch(console.log)
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
					this.updateCounter();
				});
		}
	}
	toggleSubtaskView({ target }) {
		target = $(target);
		target.closest(".task").find(".subtask-container").slideToggle(200);
		target.toggleClass("expanded");
	}
	updateCounter() {
		this.$allTasks.children(".count").text(`${this.tasks.filter((task) => !task.completed)?.length || 0}/${this.tasks.length}`);
		this.$menuBody.children(".item[data-id]").each((i, item) => {
			let id = $(item).attr("data-id");
			let count = this.tasks.filter((task) => task.lists.includes(id)).length;
			let countNotCompleted = this.tasks.filter((task) => task.lists.includes(id) && !task.completed).length;
			$(item)
				.children(".count")
				.text(`${countNotCompleted || 0}/${count || 0}`);
		});
	}
};

$(() => (SAHYG.Instances.TodoList = new SAHYG.Classes.TodoList()));
