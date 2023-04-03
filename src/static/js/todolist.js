SAHYG.Classes.TodoList = class TodoList {
	$menu = SAHYG.$0("container .menu");
	$menuBody = SAHYG.$0("container .menu .body .lists");
	$tasksBody = SAHYG.$0("container .tasks .body .todo");
	$completedBody = SAHYG.$0("container .tasks .body .completed");
	$competedLabel = SAHYG.$0("container .tasks .body .completed-label");
	$panel = SAHYG.$0("container .panel");
	$tasksHeaderList = SAHYG.$0("container .tasks .header .list .text");
	$tasksHeaderIcon = SAHYG.$0("container .tasks .header .list .icon");
	$addList = SAHYG.$0("container .menu .add");
	$menuIcon = SAHYG.$0("container .tasks .menu-icon");
	$closeMenuIcon = SAHYG.$0("container .menu .menu-icon");
	$taskPlus = SAHYG.$0("container .tasks .header .plus");
	$taskInput = SAHYG.$0("container .tasks .header .new-task");
	$allTasks = SAHYG.$0("container .menu .item.all-tasks");
	$headerActions = SAHYG.$0("container .tasks .header .actions");

	$sort = SAHYG.$0("container .tasks .header .sort");
	$direction = SAHYG.$0("container .tasks .header .direction");
	$searchIcon = SAHYG.$0("container .tasks .header .search .icon");
	$search = SAHYG.$0("container .tasks .header .search sahyg-textarea");

	currentList = null;
	constructor() {
		this.$completedBody.slideHide(0);
		this.loader = SAHYG.Components.loader.center();

		this.taskViewer = new SAHYG.Components.popup.Menu({ over: 1200, appendTo: SAHYG.$0("app-container") });

		this.textareaTimeout = null;

		this.sortType = this.$sort.selected?.[0] || "creation-date";
		this.directionType = this.$direction.selected?.[0] || "decrease";

		this.load();

		this.$menu.on("click", this.µClickOpenMenu.bind(this));
		this.$addList.on("click", this.addList.bind(this));
		this.$competedLabel.on("click", this.toggleCompletedList.bind(this));
		this.$menuIcon.on("click", this.toggleMenu.bind(this));
		this.$taskPlus.on("click", this.µClickAddTaskIcon.bind(this));
		this.$taskInput.on("keydown", this.µKeypressAddTaskEnterCheck.bind(this));
		this.$taskInput.on("input", this.µInputAddTaskValidator.bind(this));
		this.$sort.on("change", this.µClickSort.bind(this));
		this.$direction.on("change", this.µClickSortDirection.bind(this));
		this.$searchIcon.on("click", this.$search.focus.bind(this.$search));
		this.$search.on("input", this.search.bind(this));
		this.$allTasks.on("click", this.µClickOpenList.bind(this));
	}
	async load() {
		this.tasks = await this.getTasks();
		this.lists = await this.getLists();

		this.loader.remove();

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
				.catch(console.error);
		});
	}
	getLists() {
		return new Promise((resolve) => {
			SAHYG.Api.get(location.pathname + "/lists")
				.then((result) => resolve(result.lists))
				.catch(console.error);
		});
	}
	async showList(id) {
		let list = {};

		this.currentList = id || null;

		SAHYG.$("container .lists .item").removeClass("opened");
		if (!id) {
			list.name = this.$allTasks.$0(".text").text();
			this.$allTasks.addClass("opened");
		} else {
			list = this.lists.find((list) => list._id == id);
			if (!list) {
				list = {
					name: await SAHYG.translate("UNKNOWN"),
				};
			}
			SAHYG.$(`container .lists .item[data-id="${id}"]`).addClass("opened");
		}

		this.$tasksHeaderList.text(list.name).setStyle("color", list.color || "inherit");
		this.$tasksHeaderIcon.setContent(list.icon || SAHYG.Constants.todolist_default_icon || "\uf022").setStyle("color", list.color || "inherit");
		this.$menu.removeClass("opened");

		this.$headerActions.children.remove();
		if (id) {
			let menu;
			this.$headerActions.append((menu = SAHYG.createElement("span", { class: "menu lafs" }, "\uf141")));
			await this.listMenu(menu, id);
		}

		if (list.identifier) SAHYG.Utils.url.setLocationParam("list", list.identifier);
		else SAHYG.Utils.url.removeLocationParam("list");

		await this.updateTasksDisplay();
	}
	async updateTasksDisplay(tasks) {
		let completedTasks = [];

		tasks =
			(tasks || this.tasks || [])?.filter((task) => {
				if (this.currentList && !task.lists.includes(this.currentList)) return false;
				if (task.completed) {
					completedTasks.push(task);
					return false;
				}
				return true;
			}) || [];

		this.$tasksBody.children.remove();
		this.$completedBody.children.remove();

		for (let task of tasks) {
			this.$tasksBody.append(await this.taskElement({ text: task.text, id: task._id, completed: task.completed, subtasks: task.subtasks }));
		}
		for (let task of completedTasks) {
			this.$completedBody.append(await this.taskElement({ text: task.text, id: task._id, completed: task.completed, subtasks: task.subtasks }));
		}
	}
	async showTask(id) {
		let task = this.tasks.find((task) => task._id == id);
		if (!task) return;

		this.taskViewer
			.setTitle(await SAHYG.translate("EDIT_TASK"))
			.setContent([
				SAHYG.createElement(
					"div",
					{ class: "container", "data-id": id },
					SAHYG.createElement(
						"div",
						{ class: "text-and-subtasks card" },
						SAHYG.createElement(
							"div",
							{ class: "text" },
							SAHYG.createElement("span", { class: "complete" + (task.completed ? " completed" : "") }).on(
								"click",
								this.µClickTaskCompleteInMenu.bind(this)
							),
							SAHYG.createElement("sahyg-textarea", {
								placeholder: await SAHYG.translate("TEXT"),
								"border-bottom": false,
								"dynamic-height": true,
								multiline: false,
								"default-value": task.text,
								"max-length": SAHYG.Constants.todolist_max_task_text_length,
							})
								.setValidator(this.textValidator)
								.on("change", this.µChangeTaskText.bind(this))
								.on("input", this.µInputTaskText.bind(this))
						),
						SAHYG.createElement(
							"div",
							{ class: "subtasks" },
							...(await Promise.all(
								task.subtasks.map(async (subtask) =>
									SAHYG.createElement(
										"div",
										{ class: "subtask", "data-id": subtask._id },
										SAHYG.createElement(
											"div",
											{ class: "subtask-text" },
											SAHYG.createElement("span", { class: "subtask-complete" + (subtask.completed ? " completed" : "") }).on(
												"click",
												this.µClickSubtaskCompleteInMenu.bind(this)
											),
											SAHYG.createElement("sahyg-textarea", {
												placeholder: await SAHYG.translate("NAME"),
												"border-bottom": false,
												"dynamic-height": true,
												multiline: false,
												"default-value": subtask.text,
												"max-length": SAHYG.Constants.todolist_max_task_text_length,
											})
												.setValidator(this.textValidator)
												.on("change", this.µChangeSubtaskText.bind(this))
												.on("input", this.µInputSubtaskText.bind(this)),
											SAHYG.createElement("btn", { class: "subtask-delete lafs" }, "\uf2ed").on(
												"click",
												this.µClickDeleteSubtaskInMenu.bind(this)
											)
										)
									)
								)
							)),
							SAHYG.createElement(
								"div",
								{ class: "add-subtask" },
								SAHYG.createElement("span", { class: "add-subtask-icon lafs" }, "\uf067").on(
									"click",
									this.µClickAddSubtaskIcon.bind(this)
								),
								SAHYG.createElement("sahyg-textarea", {
									placeholder: await SAHYG.translate("ADD"),
									"border-bottom": false,
									"dynamic-height": true,
									multiline: false,
									"max-length": SAHYG.Constants.todolist_max_task_text_length,
								})
									.setValidator(this.textValidator)
									.on("keydown", this.µKeydownAddSubtask.bind(this))
							)
						)
					),
					SAHYG.createElement(
						"div",
						{ class: "description card" },
						SAHYG.createElement("span", { class: "card-title" }, await SAHYG.translate("DESCRIPTION")),
						SAHYG.createElement("sahyg-textarea", {
							placeholder: await SAHYG.translate("DESCRIPTION"),
							"border-bottom": true,
							"dynamic-height": true,
							"character-counter": true,
							multiline: true,
							"default-value": task.description,
							"max-length": SAHYG.Constants.todolist_max_task_description_length,
						})
							.setValidator(this.descriptionValidator)
							.on("click", this.µChangeDescription.bind(this))
							.on("input", this.µInputDescription.bind(this))
					),
					// SAHYG.createElement(
					// 	"div",
					// 	{ class: "date card" },
					// 	SAHYG.createElement("span", { class: "card-title" }, await SAHYG.translate("DATE")),
					// 	SAHYG.Components.input.datetime()
					// ),
					// SAHYG.createElement(
					// 	"div",
					// 	{ class: "tags card" },
					// 	SAHYG.createElement("span", { class: "card-title" }, await SAHYG.translate("TAGS")),
					// 	SAHYG.createElement(
					// 		"sahyg-input-list",
					// 		{},
					// 		...(task.tags || []).map((list) => SAHYG.createElement("span", { id: list }, this.lists.find((l) => l._id == list).name))
					// 	)
					// ),
					SAHYG.createElement(
						"div",
						{ class: "lists card" },
						SAHYG.createElement("span", { class: "card-title" }, await SAHYG.translate("LISTS")),
						SAHYG.createElement("sahyg-select", {
							options: JSON.stringify(
								this.lists.map((list) => {
									return { id: list._id, value: list.name };
								})
							),
							selected: JSON.stringify(task.lists),
							multiple: "true",
						}).on("change", this.µClickAddTaskToList.bind(this))
					)
				),
			])
			.open()
			.$.querySelectorAll("textarea")
			.forEach((elem) => SAHYG.Utils.element.resizeTextarea(elem));
	}
	async listElement({ _id, name, color, icon, identifier }) {
		let menu;
		let list = SAHYG.createElement(
			"div",
			{ class: "item", "data-id": _id, style: color ? `color: ${color}` : "", "data-identifier": identifier },
			SAHYG.createElement("span", { class: "icon" }, icon || SAHYG.Constants.todolist_default_icon || `\uf022`),
			SAHYG.createElement("span", { class: "text" }, name),
			SAHYG.createElement(
				"span",
				{ class: "count" },
				`${this.tasks.filter((task) => task.lists.includes(_id) && !task.completed)?.length}/${
					this.tasks.filter((task) => task.lists.includes(_id))?.length
				}` || "0/0"
			),
			(menu = SAHYG.createElement("span", { class: "menu lafs" }, "\uf141"))
		).on("click", this.µClickOpenList.bind(this));

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
				SAHYG.createElement("span", { class: "complete" + (completed ? " completed" : "") }, "").on(
					"click",
					this.µClickCompleteTask.bind(this)
				),
				SAHYG.createElement("div", { class: "task-body" }, SAHYG.createElement("span", { class: "text" }, text)),
				(menu = SAHYG.createElement("span", { class: "menu lafs" }, "\uf141"))
			)
		).on("click", this.µClickOpenTask.bind(this));
		// Create task options menu
		SAHYG.Components.tooltip.menu(menu, [
			{
				type: "button",
				text: await SAHYG.translate("REMOVE"),
				icon: "\uf2ed",
				callback: this.deleteTask.bind(this, id),
				attributes: { style: "color: var(--danger-color)" },
			},
		]);

		if (subtasks.length) {
			let container;
			element.append(
				SAHYG.createElement(
					"div",
					{ class: "subtasks" },
					SAHYG.createElement(
						"span",
						{ class: "subtask-label expanded" },
						SAHYG.createElement("span", { class: "arrow" }),
						SAHYG.createElement("span", { class: "alternative-text" }, await SAHYG.translate("SUBTASKS"))
					).on("click", this.µClickToggleSubtaskView.bind(this)),
					(container = SAHYG.createElement("div", { class: "subtask-container" }))
				)
			);
			for (let subtask of subtasks) {
				container.append(
					SAHYG.createElement(
						"div",
						{ class: "subtask", "data-id": subtask._id },
						SAHYG.createElement("span", { class: "complete" + (subtask.completed ? " completed" : "") }, "").on(
							"click",
							this.µClickCompleteTask.bind(this)
						),
						SAHYG.createElement("div", { class: "task-body" }, SAHYG.createElement("span", { class: "text" }, subtask.text)),
						(menu = SAHYG.createElement("span", { class: "menu lafs" }, "\uf141"))
					)
				);
				// Create subtask options menu
				SAHYG.Components.tooltip.menu(menu, [
					{
						type: "button",
						text: await SAHYG.translate("REMOVE"),
						icon: "\uf2ed",
						callback: this.deleteSubtask.bind(this, subtask._id),
						attributes: { style: "color: var(--danger-color)" },
					},
				]);
			}
		}

		return element;
	}
	async listMenu(menu, id) {
		SAHYG.Components.tooltip.menu(menu, [
			{
				type: "dropdown",
				icon: "\uf304",
				text: await SAHYG.translate("EDIT"),
				dropdown: [
					{
						type: "button",
						text: await SAHYG.translate("RENAME"),
						icon: "\uf031",
						callback: this.renamePopup.bind(this, id),
					},
					{ type: "divider" },
					{
						type: "button",
						text: await SAHYG.translate("CHANGE_COLOR"),
						icon: "\uf53f",
						callback: this.changeColorPopup.bind(this, id, menu),
					},
					{
						type: "button",
						text: await SAHYG.translate("RESET_COLOR"),
						icon: "\uf5c7",
						callback: this.changeColor.bind(this, id, null),
					},
					{ type: "divider" },
					{
						type: "button",
						text: await SAHYG.translate("CHANGE_ICON"),
						icon: "\uf03a",
						callback: this.changeIconPopup.bind(this, id, menu),
					},
					{
						type: "button",
						text: await SAHYG.translate("RESET_ICON"),
						icon: "\uf0ae",
						callback: this.changeIcon.bind(this, id, null),
					},
				],
			},
			{ type: "divider" },
			{
				type: "button",
				text: await SAHYG.translate("REMOVE"),
				icon: "\uf2ed",
				callback: this.deleteList.bind(this, id),
				attributes: { style: "color: var(--danger-color)" },
			},
			{
				type: "button",
				text: await SAHYG.translate("REMOVE_WITH_TASKS"),
				icon: "\uf2ed",
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
			location.pathname + "/set_list_color",
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

				SAHYG.$(`container .menu .item[data-id="${listId}"]`).setAttribute("style", `color: ${color};`);

				this.showList(list._id);
			})
			.catch(console.error);
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
				SAHYG.$0(`container .lists [data-id="${id}"] .text`).text(name);
				let list = this.lists.find((list) => list._id == id);
				list.name = name;

				this.showList(list._id);
			})
			.catch(console.error);
	}
	async changeIconPopup(list, target) {
		let icon = await SAHYG.Utils.input.icon(target);
		if (!icon) return;
		await this.changeIcon(list, `&#x${icon.unicode};`);
	}
	async changeIcon(list, icon) {
		list = this.lists.find((l) => l._id == list);
		if (!list) return;

		if (!icon) icon = SAHYG.Constants.todolist_default_icon || "\uf022";

		if (list.icon == icon) return;

		SAHYG.Api.post(location.pathname + "/set_list_icon", { id: list._id, icon }, true)
			.then((res) => {
				if (!res.success) return;

				list.icon = icon;
				SAHYG.$0(`container .menu .item[data-id="${list._id}"] .icon`).setContent(icon);

				this.showList(list._id);
			})
			.catch(console.error);
	}
	async setDescription(taskId, description) {
		if (
			description.length < SAHYG.Constants.todolist_min_task_description_length ||
			description.length > SAHYG.Constants.todolist_max_task_description_length
		)
			return;

		let task = this.tasks.find((t) => t._id == taskId && t.type == "task");

		if (task.description == description) return;

		SAHYG.Api.post(location.pathname + "/set_description", { task: taskId, description }, true)
			.then((res) => {
				if (!res.success) return;

				task.description = description;
			})
			.catch(console.error);
	}
	async setText(taskId, text) {
		if (text.length < SAHYG.Constants.todolist_min_task_text_length || text.length > SAHYG.Constants.todolist_max_task_text_length) return;

		let task = this.tasks.find((t) => t._id == taskId);

		if (task.text == text) return;

		SAHYG.Api.post(location.pathname + "/set_text", { task: taskId, text }, true)
			.then((res) => {
				if (!res.success) return;

				task.text = text;
				SAHYG.$(
					`container .tasks .task[data-id="${taskId}"] .task-container .text, container .tasks .subtask[data-id="${taskId}"] .text`
				).text(text);
			})
			.catch(console.error);
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
			.catch(console.error)
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
			.catch(console.error)
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
				this.updateSort();
			})
			.catch(console.error);
	}
	addSubtask(taskId, value) {
		return new Promise(async (resolve) => {
			let task = this.tasks.find((task) => task._id == taskId);
			if (!task) return void resolve();

			SAHYG.Api.post(location.pathname + "/add_subtask", { text: value, task: taskId }, true)
				.then(async (res) => {
					if (!res?.success) return void resolve();

					task.subtasks.push({
						text: value,
						createdAt: new Date(Date.now()),
						_id: res.content?.id,
					});

					await this.showList(this.currentList || null);
					await this.showTask(taskId);

					SAHYG.$0("container menu .task-add-subtask sahyg-textarea")?.focus();
					this.updateCounter();
					resolve();
				})
				.catch(function () {
					resolve(), console.error.call(this, ...arguments);
				});
		});
	}
	async deleteTask(id) {
		let taskIndex = this.tasks.findIndex((task) => task._id == id);
		if (taskIndex == -1) return;

		if (!(await SAHYG.Components.popup.Popup.confirm(await SAHYG.translate("CONFIRM_DELETE"))).confirm) return;

		let task = this.tasks.splice(taskIndex, 1);

		SAHYG.Api.post(location.pathname + "/delete_task", { id }, true)
			.catch(console.error)
			.then((res) => {
				if (!res?.success) return;

				SAHYG.$0(`container .task[data-id="${id}"]`).remove();
			});
	}
	async deleteSubtask(id) {
		let subtaskIndex;
		let task = this.tasks.find((t) => (subtaskIndex = t.subtasks.findIndex((subtask) => subtask._id == id)) != -1);
		if (!task) return;

		if (!(await SAHYG.Components.popup.Popup.confirm(await SAHYG.translate("CONFIRM_DELETE"))).confirm) return;

		let subtask = task.subtasks.splice(subtaskIndex, 1);

		SAHYG.Api.post(location.pathname + "/delete_task", { id }, true)
			.catch(console.error)
			.then((res) => {
				if (!res?.success) return;

				SAHYG.$0(`container .subtask[data-id="${id}"]`).remove();
			});
	}
	async addListElement(list) {
		this.$menuBody.append(await this.listElement(list));
		this.updateCounter();
	}
	deleteListElement(id) {
		SAHYG.$0(`container .menu .item[data-id="${id}"]`).remove();
		this.updateCounter();
	}
	toggleCompletedList() {
		this.$competedLabel.toggleClass("expanded");
		this.$completedBody.slideToggle(200);
	}
	async switchList(target) {
		await this.showList(target.closest(".item").getAttribute("data-id"));
	}
	completeTask(id) {
		if (!id) return;
		let taskIndex = this.tasks.findIndex((task) => task._id == id);
		if (taskIndex == -1) {
			let subtaskIndex;
			taskIndex = this.tasks.findIndex((task) => (subtaskIndex = task.subtasks.findIndex((subtask) => subtask._id == id)) != -1);

			if (taskIndex == -1) return;

			let completed = !this.tasks[taskIndex].subtasks[subtaskIndex].completed;

			SAHYG.Api.post(location.pathname + "/complete", { id, completed }, true)
				.catch(console.error)
				.then((res) => {
					if (!res?.success) return;

					this.tasks[taskIndex].subtasks[subtaskIndex].completed = completed;
					let subtaskElement = this.$tasksBody.$0(`.subtask[data-id="${id}"]`);
					if (subtaskElement) {
						if (completed) subtaskElement.$0(".complete").addClass("completed");
						else subtaskElement.$0(".complete").removeClass("completed");
					} else {
						subtaskElement = this.$completedBody.$0(`.subtask[data-id="${id}"]`);
						if (subtaskElement) {
							if (completed) subtaskElement.$0(".complete").addClass("completed");
							else subtaskElement.$0(".complete").removeClass("completed");
						}
					}
					if (completed) SAHYG.$0(`menu .subtask[data-id="${id}"] .subtask-complete`)?.addClass("completed");
					else SAHYG.$0(`menu .subtask[data-id="${id}"] .subtask-complete`)?.removeClass("completed");

					this.updateCounter();
				});
		} else {
			let completed = !this.tasks[taskIndex].completed;

			SAHYG.Api.post(location.pathname + "/complete", { id, completed }, true)
				.catch(console.error)
				.then((res) => {
					if (!res?.success) return;

					this.tasks[taskIndex].completed = completed;
					let taskElement = this.$tasksBody.$0(`.task[data-id="${id}"]`);
					if (taskElement) {
						if (completed) taskElement.$0(".task-container .complete").addClass("completed");
						else taskElement.$0(".task-container .complete").removeClass("completed");
						taskElement.remove();
						this.$completedBody.append(taskElement);
					} else {
						taskElement = this.$completedBody.$0(`.task[data-id="${id}"]`);
						if (taskElement) {
							if (completed) taskElement.$0("task-.container .complete").addClass("completed");
							else taskElement.$0(".task-container .complete").removeClass("completed");
							taskElement.remove();
							this.$tasksBody.append(taskElement);
						}
					}
					if (completed) SAHYG.$0(`menu .container[data-id="${id}"] .complete`)?.addClass("completed");
					else SAHYG.$0(`menu .container[data-id="${id}"] .complete`)?.removeClass("completed");

					this.updateCounter();
				});
		}
	}
	updateCounter() {
		this.$allTasks.$0(".count").text(`${this.tasks.filter((task) => !task.completed)?.length || 0}/${this.tasks.length}`);
		this.$menuBody.$(".item[data-id]").forEach((item) => {
			let id = item.getAttribute("data-id");
			let count = this.tasks.filter((task) => task.lists.includes(id)).length;
			let countNotCompleted = this.tasks.filter((task) => task.lists.includes(id) && !task.completed).length;
			item.$0(".count")?.text(`${countNotCompleted || 0}/${count || 0}`);
		});
		SAHYG.$("container .tasks .body .task").forEach((taskElement) => {
			let task = this.tasks.find((task) => task._id == taskElement.getAttribute("data-id"));
			if (!task) return;

			if (task.subtasks.length)
				taskElement
					.$0(".subtasks .alternative-text")
					?.setAttribute("data-count", task.subtasks.filter((subtask) => !subtask.completed).length + " / " + task.subtasks.length);
		});
	}
	textValidator(value) {
		if (value.length < SAHYG.Constants.todolist_min_task_text_length || value.length > SAHYG.Constants.todolist_max_task_text_length)
			return false;
		return true;
	}
	descriptionValidator(value) {
		if (
			value.length < SAHYG.Constants.todolist_min_task_description_length ||
			value.length > SAHYG.Constants.todolist_max_task_description_length
		)
			return false;
		return true;
	}

	// Sort tasks
	sortFunctions = {
		"creation-date": (a, b) => {
			return (this.directionType == "decrease" ? -1 : 1) * (new Date(a.createdAt) - new Date(b.createdAt));
		},
		name: (a, b) => {
			return (this.directionType == "decrease" ? -1 : 1) * a.text.localeCompare(b.text);
		},
	};
	updateSort() {
		this.tasks.sort(this.sortFunctions[this.sortType]);
		this.showList(this.currentList);
	}
	search() {
		let tasks = this.tasks.filter((task) => (task.text + task.description).includes(this.$search.value));
		this.updateTasksDisplay(tasks);
	}

	// Event handlers
	µClickToggleSubtaskView({ target }) {
		target = target.closest(".subtask-label");
		let alternativeText = target.$0(".alternative-text");

		if (target.hasClass("expanded")) setTimeout(() => alternativeText.slideShow(100), 200);
		else alternativeText.slideUp(10);
		target.closest(".task").$0(".subtask-container").slideToggle(200);
		target.toggleClass("expanded");
	}
	µChangeSubtaskText({ target }) {
		let taskId = target.closest("menu .container").getAttribute("data-id");
		if (this.textareaTimeout) {
			clearTimeout(this.textareaTimeout);
			this.textareaTimeout = null;
		}

		this.setText(taskId, target.value.trim());
	}
	µInputSubtaskText({ target }) {
		let taskId = target.closest("menu .container").getAttribute("data-id");

		if (this.textareaTimeout) clearTimeout(this.textareaTimeout);
		this.textareaTimeout = setTimeout(() => {
			this.setText(taskId, target.value.trim());
			this.textareaTimeout = null;
		}, 10000);
	}
	µChangeTaskText({ target }) {
		let taskId = target.closest("menu .container").getAttribute("data-id");
		if (this.textareaTimeout) {
			clearTimeout(this.textareaTimeout);
			this.textareaTimeout = null;
		}

		this.setText(taskId, target.value.trim());
	}
	µInputTaskText({ target }) {
		let taskId = target.closest("menu .container").getAttribute("data-id");

		if (this.textareaTimeout) clearTimeout(this.textareaTimeout);
		this.textareaTimeout = setTimeout(() => {
			this.setText(taskId, target.value.trim());
			this.textareaTimeout = null;
		}, 10000);
	}
	µClickAddTaskToList({ target, added, removed, selected }) {
		let id = target.closest("[data-id]").getAttribute("data-id");
		let task = this.tasks.find((task) => task._id == id);

		SAHYG.Api.post(location.pathname + "/set_lists", { lists: selected, task: id }, true)
			.catch(console.error)
			.then((res) => {
				if (!res.success) return;

				task.lists = selected;

				this.showList(this.currentList);
				this.updateCounter();
			});
	}
	µClickDeleteSubtaskInMenu({ target }) {
		let subtaskId = target.closest("[data-id]").getAttribute("data-id");
		this.deleteSubtask(subtaskId);
	}
	µClickCompleteTask({ target }) {
		let task = target.closest(".subtask");
		if (!task) task = target.closest(".task");
		this.completeTask(task.getAttribute("data-id"));
	}
	µClickOpenMenu({ target }) {
		if (target.contains(this.$closeMenuIcon)) this.$menu.removeClass("opened");
		if (target.closest(".menu > .body")) return true;
		this.$menu.removeClass("opened");
	}
	µClickOpenList({ target }) {
		if (target.closest(".item > .menu")) return;
		return this.switchList(target);
	}
	µClickAddTaskIcon() {
		let text = this.$taskInput.value;
		if (!text.length) return this.$taskInput.focus();
		this.addTask(text, this.currentList);
		this.$taskInput.value = "";
	}
	µKeypressAddTaskEnterCheck({ keyCode }) {
		let value = this.$taskInput.value;
		if (keyCode == 13) {
			if (value.length > SAHYG.Constants.todolist_max_task_text_length || value.length < SAHYG.Constants.todolist_mix_task_text_length) return;
			this.addTask(value, this.currentList);
			this.$taskInput.value = "";
		}
	}
	µInputAddTaskValidator() {
		let value = this.$taskInput.value;
		if (value.length > SAHYG.Constants.todolist_max_task_text_length || value.length < SAHYG.Constants.todolist_min_task_text_length)
			this.$taskInput.addClass("invalid");
		else this.$taskInput.removeClass("invalid");
	}
	µClickSort() {
		this.sortType = this.$sort.selected?.[0] || "creation-date";
		this.updateSort();
	}
	µClickSortDirection() {
		this.directionType = this.$direction.selected?.[0] || "decrease";
		this.updateSort();
	}
	µChangeDescription({ target }) {
		let taskId = target.closest("menu .container").getAttribute("data-id");
		if (this.textareaTimeout) {
			clearTimeout(this.textareaTimeout);
			this.textareaTimeout = null;
		}

		this.setDescription(taskId, target.value.trim());
	}
	µInputDescription({ target }) {
		let taskId = target.closest("menu .container").getAttribute("data-id");
		if (this.textareaTimeout) clearTimeout(this.textareaTimeout);
		this.textareaTimeout = setTimeout(() => {
			this.setDescription(taskId, target.value.trim());
			this.textareaTimeout = null;
		}, 10000);
	}
	µClickSubtaskCompleteInMenu({ target }) {
		let subtask = target.closest(".subtask");
		this.completeTask(subtask.getAttribute("data-id"));
	}
	µClickTaskCompleteInMenu({ target }) {
		let taskContainer = target.closest(".container");
		this.completeTask(taskContainer.getAttribute("data-id"));
	}
	async µClickAddSubtaskIcon({ target }) {
		let input = SAHYG.$0("container menu .add-subtask textarea");
		if (!((input.value?.length || 0) < SAHYG.Constants.todolist_min_task_text_length))
			await this.addSubtask(input.closest(".container").getAttribute("data-id"), input.value);
		input.focus();
	}
	async µKeydownAddSubtask({ target, keyCode }) {
		if (keyCode == 13) {
			await this.addSubtask(target.closest(".container").getAttribute("data-id"), target.value);
			SAHYG.$0("container menu .add-subtask textarea").focus();
		}
		return true;
	}
	µClickOpenTask({ target }) {
		if (target.closest(".complete, .menu, .subtask-label")) return true;
		this.showTask(target.closest(".task")?.getAttribute("data-id"));
	}
};

SAHYG.onload(() => (SAHYG.Instances.TodoList = new SAHYG.Classes.TodoList()));
