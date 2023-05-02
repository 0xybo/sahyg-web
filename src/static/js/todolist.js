SAHYG.Classes.TodoList = class TodoList {
	$appContainer = SAHYG.$0("app-container");
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
		this.loader = SAHYG.Components.Loader.center();

		this.$taskViewer = SAHYG.createElement("sahyg-menu", { target: "app-container" });
		this.$taskViewer.shadowRoot.setStyle({
			".task-container": {
				display: "flex",
				gap: "1rem",
				flexDirection: "column",
				padding: "0 0.5rem 1rem 0.5rem",
				height: "100%",
			},
			".card": {
				backgroundColor: "var(--background-secondary-color)",
				borderRadius: "0.25rem",
				padding: "0.5rem",
				display: "flex",
				flexDirection: "column",
			},
			".card-title": {
				fontWeight: "bold",
				fontSize: "1.1rem",
				WebkitUserSelect: "none",
				MozUserSelect: "none",
				MsUserSelect: "none",
				userSelect: "none",
				marginBottom: "0.5rem",
			},
			".text-and-subtasks sahyg-textarea": {
				marginLeft: "0.5rem",
				flex: "1",
			},
			":is(.complete, .subtask-complete):before": {
				content: '"\\f111"',
				fontFamily: "var(--font-icon-solid)",
				fontSize: "1.5rem",
				cursor: "pointer",
			},
			":is(.complete, .subtask-complete).completed:before": {
				content: '"\\f058"',
			},
			".text": {
				display: "flex",
				alignItems: "center",
			},
			".subtasks": {
				paddingLeft: "2rem",
			},
			".subtask-text": {
				display: "flex",
				alignItems: "center",
			},
			".add-subtask": {
				display: "flex",
				alignItems: "center",
			},
			".add-subtask-icon": {
				WebkitUserSelect: "none",
				MozUserSelect: "none",
				MsUserSelect: "none",
				userSelect: "none",
				cursor: "pointer",
				fontFamily: "var(--font-icon-solid)",
			},
			".subtask-delete": {
				fontSize: "1.2rem",
			},
			".subtask-delete:hover": {
				color: "var(--danger-color)",
				transition: "var(--transition)",
			},
		});

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
				.then((result) => resolve(result?.content?.tasks))
				.catch(console.error);
		});
	}
	getLists() {
		return new Promise((resolve) => {
			SAHYG.Api.get(location.pathname + "/lists")
				.then((result) => resolve(result?.content?.lists))
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

		// TASK COMPLETE and TEXT
		this.$taskViewer.$complete = SAHYG.createElement("span", { class: "complete" + (task.completed ? " completed" : "") }).on(
			"click",
			this.taskCompleteInMenuClickHandler.bind(this, id)
		);
		this.$taskViewer.$textarea = SAHYG.createElement("sahyg-textarea", {
			placeholder: await SAHYG.translate("TEXT"),
			"border-bottom": false,
			"dynamic-height": true,
			multiline: false,
			"default-value": task.text,
			"max-length": SAHYG.Constants.todolist_max_task_text_length,
		})
			.setValidator(this.textValidator)
			.on("change", this.taskTextChangeHandler.bind(this, id))
			.on("input", this.taskTextInputHandler.bind(this, id));
		this.$taskViewer.$text = SAHYG.createElement("div", { class: "text" }, this.$taskViewer.$complete, this.$taskViewer.$textarea);
		// SUBTASKS
		this.$taskViewer.$subtasks = SAHYG.createElement("div", { class: "subtasks" });
		this.$taskViewer.subtasks = [];
		for (let subtask of task.subtasks) {
			let $complete = SAHYG.createElement("span", { class: "subtask-complete" + (subtask.completed ? " completed" : "") }).on(
				"click",
				this.subtaskCompleteInMenuClickHandler.bind(this, subtask._id)
			);
			let $textarea = SAHYG.createElement("sahyg-textarea", {
				placeholder: await SAHYG.translate("NAME"),
				"border-bottom": false,
				"dynamic-height": true,
				multiline: false,
				"default-value": subtask.text,
				"max-length": SAHYG.Constants.todolist_max_task_text_length,
			})
				.setValidator(this.textValidator)
				.on("change", this.subtaskTextChangeHandler.bind(this, subtask._id))
				.on("input", this.subtaskTextInputHandler.bind(this, subtask._id));
			let $delete = SAHYG.createElement("sahyg-button", { class: "subtask-delete", icon: String.fromCharCode(0xf2ed) }).on(
				"click",
				this.deleteSubtaskInMenuClickHandler.bind(this, subtask._id)
			);
			let $text = SAHYG.createElement("span", { class: "subtask-text" }, $complete, $textarea, $delete);
			let $subtask = SAHYG.createElement("div", { class: "subtask", "data-id": subtask._id }, $text);
			this.$taskViewer.subtasks.push({
				$subtask,
				$complete,
				$textarea,
				$delete,
				$text,
				...subtask,
			});
			this.$taskViewer.$subtasks.append($subtask);
		}
		// ADD SUBTASK
		this.$taskViewer.$addSubtaskIcon = SAHYG.createElement("span", { class: "add-subtask-icon" }, "\uf067").on(
			"click",
			this.addSubtaskIconClickHandler.bind(this, id)
		);
		this.$taskViewer.$addSubtaskTextarea = SAHYG.createElement("sahyg-textarea", {
			placeholder: await SAHYG.translate("ADD"),
			"border-bottom": false,
			"dynamic-height": true,
			multiline: false,
			"max-length": SAHYG.Constants.todolist_max_task_text_length,
		})
			.setValidator(this.textValidator)
			.on("keydown", this.addSubtaskKeydownHandler.bind(this, id));
		this.$taskViewer.$addSubtask = SAHYG.createElement(
			"div",
			{ class: "add-subtask" },
			this.$taskViewer.$addSubtaskIcon,
			this.$taskViewer.$addSubtaskTextarea
		);
		// TEXT AND SUBTASKS
		this.$taskViewer.$textAndSubtasks = SAHYG.createElement(
			"div",
			{ class: "text-and-subtasks card" },
			this.$taskViewer.$text,
			this.$taskViewer.$subtasks,
			this.$taskViewer.$addSubtask
		);

		// DESCRIPTION
		this.$taskViewer.$descriptionTitle = SAHYG.createElement("span", { class: "card-title" }, await SAHYG.translate("DESCRIPTION"));
		this.$taskViewer.$descriptionTextarea = SAHYG.createElement("sahyg-textarea", {
			placeholder: await SAHYG.translate("DESCRIPTION"),
			"border-bottom": true,
			"dynamic-height": true,
			"character-counter": true,
			multiline: true,
			"default-value": task.description,
			"max-length": SAHYG.Constants.todolist_max_task_description_length,
		})
			.setValidator(this.descriptionValidator)
			.on("click", this.descriptionClickHandler.bind(this, id))
			.on("input", this.descriptionInputHandler.bind(this, id));
		this.$taskViewer.$description = SAHYG.createElement(
			"div",
			{ class: "description card" },
			this.$taskViewer.$descriptionTitle,
			this.$taskViewer.$descriptionTextarea
		);

		// TODO DATE, TAGS
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

		this.$taskViewer.$listsTitle = SAHYG.createElement("span", { class: "card-title" }, await SAHYG.translate("LISTS"));
		this.$taskViewer.$listsSelect = SAHYG.createElement("sahyg-select", {
			options: JSON.stringify(
				this.lists.map((list) => {
					return { id: list._id, value: list.name };
				})
			),
			selected: JSON.stringify(task.lists),
			multiple: "true",
		}).on("change", this.addTaskToListChangeHandler.bind(this, id));
		this.$taskViewer.$lists = SAHYG.createElement("div", { class: "lists card" }, this.$taskViewer.$listsTitle, this.$taskViewer.$listsSelect);

		this.$taskViewer.$taskContainer = SAHYG.createElement(
			"div",
			{ class: "task-container", dataId: id },
			this.$taskViewer.$textAndSubtasks,
			this.$taskViewer.$description,
			this.$taskViewer.$lists
		);

		this.$taskViewer.setTitle(await SAHYG.translate("EDIT_TASK"));
		this.$taskViewer.setContent(this.$taskViewer.$taskContainer);

		this.$taskViewer.open();

		SAHYG.Utils.element.resizeTextarea(this.$taskViewer.$descriptionTextarea);
		SAHYG.Utils.element.resizeTextarea(this.$taskViewer.$descriptionTextarea);
		SAHYG.Utils.element.resizeTextarea(this.$taskViewer.$textarea);
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
		).on("click", this.openTaskClickHandler.bind(this));
		// Create task options menu
		SAHYG.Components.tooltipMenu({
			target: menu,
			items: [
				{
					type: "button",
					text: await SAHYG.translate("REMOVE"),
					icon: "\uf2ed",
					callback: this.deleteTask.bind(this, id),
					options: { style: "color: var(--danger-color)" },
				},
			],
		});

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
				SAHYG.Components.tooltipMenu({
					target: menu,
					items: [
						{
							type: "button",
							text: await SAHYG.translate("REMOVE"),
							icon: "\uf2ed",
							callback: this.deleteSubtask.bind(this, subtask._id),
							options: { style: "color: var(--danger-color)" },
						},
					],
				});
			}
		}

		return element;
	}
	async listMenu(menu, id) {
		SAHYG.Components.tooltipMenu({
			target: menu,
			items: [
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
					options: { style: "color: var(--danger-color)" },
				},
				{
					type: "button",
					text: await SAHYG.translate("REMOVE_WITH_TASKS"),
					icon: "\uf2ed",
					callback: this.deleteList.bind(this, id, true),
					options: { style: "color: var(--danger-color)" },
				},
			],
		});
	}
	toggleMenu() {
		this.$menuIcon.toggleClass("opened");
		this.$menu.toggleClass("opened");
	}
	async changeColorPopup(list, target) {
		let color = await SAHYG.ask.colorByTooltip({ target, defaultColor: this.lists.find((l) => l._id == list)?.color });

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
		let response = await SAHYG.createElement("sahyg-input-dialog", {
			inputs: [
				{
					type: "text",
					id: "name",
					label: await SAHYG.translate("RENAME"),
					options: { placeholder: await SAHYG.translate("RENAME"), borderBottom: true },
					defaultValue: this.lists.find((list) => list._id == listID)?.name,
					validator: (value) => {
						return (value?.length || 0) <= SAHYG.Constants.todolist_max_list_name_length;
					},
				},
			],
		})
			.show()
			.toPromise();
		if (!response?.changed?.name) return;

		this.rename(listID, response.data.name);
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
		let icon = await SAHYG.ask.iconByTooltip({ target });
		if (!icon) return;
		await this.changeIcon(list, String.fromCharCode(`0x${icon.unicode}`));
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
		let data = (
			await SAHYG.createElement("sahyg-input-dialog", {
				header: await SAHYG.translate("ADD_CATEGORY"),
				inputs: [
					{
						id: "name",
						title: await SAHYG.translate("NAME"),
						placeholder: await SAHYG.translate("NAME"),
						type: "text",
						validator: (value) => value.length > 2 && value.length < 20,
						options: {
							borderBottom: true,
						},
					},
				],
			})
				.show()
				.toPromise()
		)?.data;
		if (!data) return;

		await SAHYG.Api.post(location.pathname + "/add_list", {
			name: data.name,
		})
			.catch(console.error)
			.then(async (res) => {
				if (!res?.success) return;
				await this.addListElement({ _id: res.content.id, name: data.name, identifier: res.content.identifier });
				this.lists.push({ _id: res.content.id, name: data.name, identifier: res.content.identifier });
			});
	}
	async deleteList(id, deleteTasks) {
		if (
			deleteTasks === true &&
			!(await SAHYG.createElement("sahyg-confirm-dialog", { content: await SAHYG.translate("REMOVE_WITH_TASKS_DESCRIPTION") }).show().toPromise())
		)
			return;
		else if (!(await SAHYG.createElement("sahyg-confirm-dialog", { content: await SAHYG.translate("CONFIRM_DELETE") }).show().toPromise())) return;

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

		if (!(await SAHYG.createElement("sahyg-confirm-dialog", { content: await SAHYG.translate("CONFIRM_DELETE") }).show().toPromise())) return;

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

		if (!(await SAHYG.createElement("sahyg-confirm-dialog", { content: await SAHYG.translate("CONFIRM_DELETE") }).show().toPromise())) return;

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

					let $subtaskComplete = this.$taskViewer.subtasks?.find((st) => st._id === id)?.$complete;
					if (completed && $subtaskComplete) $subtaskComplete?.addClass("completed");
					else $subtaskComplete?.removeClass("completed");

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
							if (completed) taskElement.$0(".task-container .complete").addClass("completed");
							else taskElement.$0(".task-container .complete").removeClass("completed");
							taskElement.remove();
							this.$tasksBody.append(taskElement);
						}
					}
					if (completed) this.$taskViewer.$complete?.addClass("completed");
					else this.$taskViewer.$complete?.removeClass("completed");

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
	subtaskTextChangeHandler(id) {
		if (this.textareaTimeout) {
			clearTimeout(this.textareaTimeout);
			this.textareaTimeout = null;
		}

		let $textarea = this.$taskViewer.subtasks.find((st) => st._id === id).$textarea;
		this.setText(id, $textarea.value.trim());
	}
	subtaskTextInputHandler(id) {
		if (this.textareaTimeout) clearTimeout(this.textareaTimeout);
		this.textareaTimeout = setTimeout(() => {
			let $textarea = this.$taskViewer.subtasks.find((st) => st._id === id).$textarea;
			this.setText(id, $textarea.value.trim());
			this.textareaTimeout = null;
		}, 10000);
	}
	taskTextChangeHandler(id) {
		if (this.textareaTimeout) {
			clearTimeout(this.textareaTimeout);
			this.textareaTimeout = null;
		}

		this.setText(id, this.$taskViewer.$textarea.value.trim());
	}
	taskTextInputHandler(id) {
		if (this.textareaTimeout) clearTimeout(this.textareaTimeout);
		this.textareaTimeout = setTimeout(() => {
			this.setText(id, this.$taskViewer.$textarea.value.trim());
			this.textareaTimeout = null;
		}, 10000);
	}
	addTaskToListChangeHandler(id, { selected }) {
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
	deleteSubtaskInMenuClickHandler(id) {
		this.deleteSubtask(id);
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
	descriptionClickHandler(id) {
		if (this.textareaTimeout) {
			clearTimeout(this.textareaTimeout);
			this.textareaTimeout = null;
		}

		this.setDescription(id, this.$taskViewer.$descriptionTextarea.value.trim());
	}
	descriptionInputHandler(id) {
		if (this.textareaTimeout) clearTimeout(this.textareaTimeout);
		this.textareaTimeout = setTimeout(() => {
			this.setDescription(id, this.$taskViewer.$descriptionTextarea.value.trim());
			this.textareaTimeout = null;
		}, 10000);
	}
	subtaskCompleteInMenuClickHandler(id) {
		this.completeTask(id);
	}
	taskCompleteInMenuClickHandler(id) {
		this.completeTask(id);
	}
	async addSubtaskIconClickHandler(id) {
		if (!((this.$taskViewer.$addSubtaskTextarea.value?.length || 0) < SAHYG.Constants.todolist_min_task_text_length))
			await this.addSubtask(id, this.$taskViewer.$addSubtaskTextarea.value);
		this.$taskViewer.$addSubtaskTextarea.focus();
	}
	async addSubtaskKeydownHandler(id, { keyCode }) {
		if (keyCode == 13) {
			await this.addSubtask(id, target.value);
			SAHYG.$0(".add-subtask textarea").focus();
		}
		return true;
	}
	openTaskClickHandler({ target }) {
		if (target.closest(".complete, .menu, .subtask-label")) return true;
		this.showTask(target.closest(".task")?.getAttribute("data-id"));
	}
};

SAHYG.onload(() => (SAHYG.Instances.TodoList = new SAHYG.Classes.TodoList()));
