const SAHYG = {
	Cache: {
		// To store var for access it later
		users: {},
		translations: null,
		translationsFetchError: false,
		icons: [],
	},
	Events: {}, // Centralize event binding for keep the update event bound to the selector
	Classes: {},
	Instances: {}, // Store class instance associate with specific page
	currentEventID: 0, // Store the current event ID
	Constants: Object.fromEntries(
		$("head meta[name*=sahyg-]")
			.toArray()
			?.map((metaElement) => {
				metaElement = $(metaElement);

				let value = metaElement.attr("content");
				if (metaElement.attr("type") == "number") value = Number(value);

				return [metaElement.attr("name")?.replace("sahyg-", "").replace(/-/g, "_"), value];
			}) || []
	),
	/**
	 * Get a translation from the server and store it for future access
	 * @async
	 * @function translate
	 * @param {String} name Translation name
	 * @param {{[StringName: String]: String}} options Allow you to replace `{{String}}` in translation
	 * @return {Promise<String>}
	 */
	async translate(name, options = null) {
		if (SAHYG.Cache.translationsFetchError) return "";
		if (!SAHYG.Cache.translations) {
			SAHYG.Cache.translations = await SAHYG.Api.get("/resources/translate", {
				locale: $("html").attr("lang"),
			}).catch((e) => (SAHYG.Cache.translationsFetchError = true));
		}
		let result = SAHYG.Cache.translations[name] || name;
		if (options) {
			Object.entries(options).forEach(([k, v]) => {
				result = result.replace(new RegExp(`{{${k}}}`, "gmi"), String(v));
			});
		}
		return result;
	},
	/**
	 * Create a JQuery element with specified attributes and bind event on it if specified
	 * @param {String} type Element name (ex: `div`) or html (ex: `<div></div>`)
	 * @param {{events: {[eventName: String]: Function}, [attributeName: String]: String}} attr Element attributes
	 * @param  {...HTMLELement | String | JQuery} children
	 * @returns {JQuery}
	 */
	createElement(type, attr = {}, ...children) {
		let e = type.startsWith("<") ? $(type) : $(`<${type}></${type}>`);
		if (attr.events || attr.on) {
			Object.entries(attr.events || attr.on).forEach(([name, callback]) => {
				SAHYG.on(name, e, callback);
			});
			delete attr.events;
			delete attr.on;
		}
		if (attr.once) {
			Object.entries(attr.once).forEach(([name, callback]) => {
				SAHYG.once(name, e, callback);
			});
			delete attr.once;
		}
		Object.entries(attr).forEach(([k, v]) => {
			e.attr(k, v);
		});
		children.forEach((child) => e.append(child));
		return e;
	},
	/**
	 * Bind event to an element(s) by adding specified informations to SAHYG.Events variable
	 * @param {String} type Event type to bind on specified element
	 * @param {String | HTMLElement | JQuery} element Element
	 * @param  {...Function} callbacks
	 * @returns {String [ HTMLElement | JQuery]}
	 */
	on(type, element, callback) {
		if (!SAHYG.Events[type]) SAHYG.Events[type] = [];
		SAHYG.Events[type]?.push({
			element,
			callback,
			id: ++SAHYG.currentEventID,
		});
		return { id: SAHYG.currentEventID, remove: SAHYG.off.bind(null, SAHYG.currentEventID) };
	},
	once(type, element, callback) {
		if (!SAHYG.Events[type]) SAHYG.Events[type] = [];
		SAHYG.Events[type]?.push({
			element,
			callback: function (id) {
				SAHYG.off(id);
				let args = Array.from(arguments);
				args.shift();
				callback.call(this, ...args);
			}.bind(null, SAHYG.currentEventID + 1),
			id: ++SAHYG.currentEventID,
		});
		return SAHYG.currentEventID;
	},
	off(typeOrID, elementOrCallback) {
		if (typeof typeOrID == "number") {
			type = SAHYG.findEventById(typeOrID)[0]?.type;
			if (!type) return false;
			if (SAHYG.Events[type]) SAHYG.Events[type] = SAHYG.Events[type]?.filter((event) => event.id != typeOrID);
		} else if (SAHYG.Events[typeOrID])
			SAHYG.Events[typeOrID] = SAHYG.Events[typeOrID]?.filter(
				(event) => event.element != elementOrCallback && event.callback != elementOrCallback
			);
	},
	findEventByElementOrCallback(elementOrCallback, type) {
		let list = Object.entries(type ? { [type]: SAHYG.Events[type] || [] } : SAHYG.Events);
		let result = [];
		list.forEach(([type, events]) => {
			events.forEach((event) => {
				if (event.element == elementOrCallback || event.callback == elementOrCallback) result.push({ type, ...event });
			});
		});
		return result.length ? result : null;
	},
	findEventById(id, type) {
		let list = Object.entries(type ? { [type]: SAHYG.Events[type] || [] } : SAHYG.Events);
		let result = [];
		list.forEach(([type, events]) => {
			events.forEach((event) => {
				if (event.id == id) result.push({ type, ...event });
			});
		});
		return result.length ? result : null;
	},
	Components: {
		popup: {
			$container: "popups",
			Popup: class Popup {
				events = {
					closed: () => {},
				};
				buttons = {};
				popup = $();
				style = {
					fullColor: {
						"background-color": "var(--accent-color)",
						color: "var(--background-color)",
					},
				};

				constructor({ title, content, buttons = {} } = {}) {
					this.parent = $("popups");

					this.popup = SAHYG.createElement(
						"popup",
						{},
						(this.backdrop = SAHYG.createElement("div", {
							class: "backdrop",
							events: { click: this.close.bind(this) },
						})),
						SAHYG.createElement(
							"div",
							{ class: "container" },
							SAHYG.createElement("div", { class: "header" }, SAHYG.createElement("h3", { class: "title" })),
							SAHYG.createElement("div", { class: "content" }),
							SAHYG.createElement("div", { class: "buttons" })
						)
					);

					Object.entries(buttons).forEach(([id, prop]) => this.button(id, prop));
					if (content) this.content(content);
					if (title) this.title(title);

					this.popup.get(0)._popup = this;
				}

				show() {
					return new Promise((resolve, reject) => {
						if (Object.entries(this.buttons).length == 0) {
							this.buttons.ok = {
								callback: (event) => this.close(event, this),
								text: "Ok",
								style: `background-color": "var(--accent-color)";color: "var(--background-color)`,
							};
							this.events.ok = this.buttons.ok.callback;
							this.buttons.ok.$ = SAHYG.createElement("input", {
								class: "btn",
								type: "button",
								events: { click: this.events.ok },
								"data-btn-id": "ok",
								value: this.buttons.ok.text,
								style: this.buttons.ok.style,
							});
							this.popup.find(".buttons").append(this.buttons.ok.$);
						}

						this.parent.append(this.popup);
						setTimeout(() => {
							this.popup.addClass("visible");
							resolve(this);
						}, 0);
					});
				}

				close = async function (event) {
					this.popup.remove();

					// Remove popup events listener
					SAHYG.off("click", this.backdrop);
					for (let i in this.buttons) {
						SAHYG.off("click", this.buttons[i].$);
					}

					// Trigger internal popup event `closed`
					this.events.closed(event || null);

					return true;
				}.bind(this);

				_promise(name) {
					return new Promise((resolve, reject) => (this.events[name] = (...args) => this.close().then(resolve.bind(null, ...args))));
				}

				button(eventName, { callback, text, style }) {
					this.buttons[eventName] = {
						callback,
						text,
						style: this._style(style),
					};

					this.events[eventName] = callback.bind(null, this);
					this.buttons[eventName].$ = SAHYG.createElement("input", {
						class: "btn",
						type: "button",
						events: { click: this.events[eventName] },
						"data-btn-id": eventName,
						value: this.buttons[eventName].text,
						style: this.buttons[eventName].style,
					});

					this.popup.find(".buttons").append(this.buttons[eventName].$);
					return this;
				}

				content(content) {
					this.popup.find(".content").html(content);
					return this;
				}

				addClass(classToAdd) {
					this.popup.addClass(classToAdd);
					return this;
				}

				title(title) {
					this.popup.find(".title").text(title);
					return this;
				}

				closed(cb) {
					this.events.closed = (e) => cb(e, this);
					return this;
				}

				_style(obj) {
					if (!obj) return "";
					if (typeof obj == "string") {
						if (this.style[obj])
							return Object.entries(this.style[obj])
								.map(([k, v]) => `${k}:${v};`)
								.join("");
						else return obj;
					} else
						return Object.entries(obj)
							.map(([k, v]) => `${k}:${v};`)
							.join("");
				}

				static confirm(content) {
					return new Promise(async (resolve) =>
						new SAHYG.Components.popup.Popup({
							title: await SAHYG.translate("CONFIRM"),
							content,
							buttons: {
								discard: {
									text: await SAHYG.translate("DISCARD"),
									style: undefined,
									callback: (popup, event) => {
										popup.close();
										resolve({ confirm: false, event, popup });
									},
								},
								confirm: {
									text: await SAHYG.translate("CONFIRM"),
									style: "fullColor",
									callback: (popup, event) => {
										popup.close();
										resolve({ confirm: true, event, popup });
									},
								},
							},
						}).show()
					);
				}

				static alert(content) {
					return new Promise(async (resolve) =>
						new SAHYG.Components.popup.Popup({
							title: "⚠️ " + (await SAHYG.translate("ALERT")),
							content,
							buttons: {
								ok: {
									text: await SAHYG.translate("OK"),
									style: "fullColor",
									callback: (popup, event) => {
										popup.close();
										resolve({ event, popup });
									},
								},
							},
						}).show()
					);
				}

				static input(title, inputs, large = true) {
					let data = Object.fromEntries(inputs.map((input) => [input.name, input.defaultValue]));
					let focus = () => {};
					return new Promise(async (resolve) => {
						let popup = new SAHYG.Components.popup.Popup();
						if (large) popup.addClass("large");
						popup
							.title(title)
							.content(
								SAHYG.createElement(
									"form",
									{
										events: {
											submit: (event) => {
												event.preventDefault();
												popup.events.ok(null, popup);
												popup.close();
											},
										},
									},
									...(await Promise.all(
										inputs.map(async (input) => {
											if (!input.validator) input.validator = () => true;
											let inputElement;
											if (["text", "url"].includes(input.type))
												inputElement = SAHYG.createElement("input", {
													events: {
														input: async (event) => {
															if (!(await input.validator(event.target.value)))
																return void $(event.target)
																	.closest("[data-input-type]")
																	.addClass("invalid")
																	.removeClass("valid");
															else
																$(event.target).closest("[data-input-type]").removeClass("invalid").addClass("valid");
															data[input.name] = event.target.value;
														},
													},
													placeholder: input.placeholder,
													type: input.type,
													value: input.defaultValue,
													id: input.name,
												});
											else if (input.type == "textarea")
												inputElement = SAHYG.createElement(
													"textarea",
													{
														events: {
															input: async (event) => {
																if (!(await input.validator(event.target.value)))
																	return void $(event.target)
																		.closest("[data-input-type]")
																		.addClass("invalid")
																		.removeClass("valid");
																else
																	$(event.target)
																		.closest("[data-input-type]")
																		.removeClass("invalid")
																		.addClass("valid");
																data[input.name] = event.target.value;
															},
														},
														placeholder: input.placeholder,
														id: input.name,
													},
													input.defaultValue
												);
											else if (input.type == "select")
												inputElement = await SAHYG.Components.input.select({
													options: input.options,
													defaultValue: input.defaultValue,
													events: {
														input: async ({ target }) => {
															let value = $(target).attr("data-value");

															if (!(await input.validator(value)))
																return void $(target)
																	.closest("[data-input-type]")
																	.addClass("invalid")
																	.removeClass("valid");
															else $(target).closest("[data-input-type]").removeClass("invalid").addClass("valid");

															data[input.name] = value;
														},
													},
													placeholder: input.placeholder,
												});
											else if (input.type == "boolean")
												inputElement = await SAHYG.Components.input.boolean({
													defaultValue: input.defaultValue,
													events: {
														input: async ({ target }) => {
															let value = $(target).attr("value") == "true";

															if (!(await input.validator(value)))
																return void $(target)
																	.closest("[data-input-type]")
																	.addClass("invalid")
																	.removeClass("valid");
															else $(target).closest("[data-input-type]").removeClass("invalid").addClass("valid");

															data[input.name] = value;
														},
													},
												});
											else if (input.type == "list")
												inputElement = await SAHYG.Components.input.list({
													defaultValue: input.defaultValue,
													events: {
														input: async ({ target }) => {
															let value =
																$(target)
																	.find("c-input-list-value")
																	.toArray()
																	.map((elem) => elem.innerText) || [];

															if (!(await input.validator(value)))
																return void $(target)
																	.closest("[data-input-type]")
																	.addClass("invalid")
																	.removeClass("valid");
															else $(target).closest("[data-input-type]").removeClass("invalid").addClass("valid");

															data[input.name] = value;
														},
													},
												});
											else if (input.type == "color") {
												inputElement = SAHYG.createElement("input", {
													type: "color",
													on: {
														input: async ({ target }) => {
															let value = $(target).val();

															if (!(await input.validator(value)))
																return void $(target)
																	.closest("[data-input-type]")
																	.addClass("invalid")
																	.removeClass("valid");
															else $(target).closest("[data-input-type]").removeClass("invalid").addClass("valid");

															$(target).attr("value", (data[input.name] = value));
														},
													},
													value: input.defaultValue,
												});

												focus = () => {
													if (input.autoFocus) $(inputElement).click();
												};
											}

											input.$ = inputElement;

											return SAHYG.createElement(
												"div",
												{ class: input.inline ? "inline" : "" },
												SAHYG.createElement("label", { for: input.name }, input.label),
												SAHYG.createElement("span", { class: "description" }, input.description),
												(input.$container = SAHYG.createElement("div", { "data-input-type": input.type }, inputElement))
											);
										})
									))
								)
							)
							.button("discard", {
								text: await SAHYG.translate("DISCARD"),
								style: undefined,
								callback: (popup) => {
									resolve(null);
									popup.close();
								},
							})
							.button("ok", {
								text: await SAHYG.translate("OK"),
								style: "fullColor",
								callback: (popup) => {
									for (let input of inputs) {
										if (input.required && !data[input.name]) {
											input.$container?.addClass("invalid");
											return false;
										}
										if (!input.validator(data[input.name])) return false;
									}
									resolve(data);
									popup.close();
								},
							})
							.closed(() => resolve(null));
						await popup.show();
						focus();
					});
				}
			},
			Viewer: class Viewer {
				events = { closed: async () => {} };
				constructor({ img, title, widthHeight, size, zoom = false, type, openOriginal }) {
					this.options = {
						img,
						title,
						widthHeight,
						size,
						zoom,
						type,
						openOriginal,
					};
					this.parent = $("popups");
					this.popup = SAHYG.createElement(
						"viewer",
						{},
						SAHYG.createElement("div", { class: "backdrop", events: { click: this.close.bind(this) } }),
						(this.container = SAHYG.createElement("div", { class: "container" })),
						SAHYG.createElement("div", { class: "close-button lafs", events: { click: this.close.bind(this) } }, "&#xf00d;")
					);

					this.popup._viewer = this;
				}
				async load() {
					this.imageBlob = await (await fetch(this.options.img)).blob();
					if (this.imageBlob.size == 0) return Promise.reject();

					this.image = new Image();
					this.image.src = URL.createObjectURL(this.imageBlob);
					await this.image.decode();

					this.container.append(this.image);
					this.container.append((this.infos = SAHYG.createElement("div", { class: "infos" })));

					if (this.options.title) this.infos.append(SAHYG.createElement("span", { class: "title" }, this.options.title));
					else this.infos.append(SAHYG.createElement("span", { class: "title" }, (this.options.title = this.options.img.split("/").pop())));
					if (this.options.type) this.infos.append(SAHYG.createElement("span", {}, this.options.type));
					else this.infos.append(SAHYG.createElement("span", {}, (this.options.type = this.imageBlob.type.split("/").pop().toUpperCase())));
					if (this.options.widthHeight) this.infos.append(SAHYG.createElement("span", {}, this.options.widthHeight));
					else this.infos.append(SAHYG.createElement("span", {}, (this.options.widthHeight = this.image.width + "x" + this.image.height)));
					if (this.options.size) this.infos.append(SAHYG.createElement("span", {}, SAHYG.Utils.units.formatOctets(this.options.size)));
					else
						this.infos.append(SAHYG.createElement("span", {}, (this.options.size = SAHYG.Utils.units.formatOctets(this.imageBlob.size))));

					if (this.options.openOriginal)
						this.infos.append(
							SAHYG.createElement(
								"span",
								{ class: "link", events: { click: this.openOriginal.bind(this) } },
								await SAHYG.translate("OPEN_ORIGINAL")
							)
						);
				}
				async show(load = true) {
					let loader = SAHYG.Components.loader.center();
					if (load)
						await this.load()
							.catch(() => {
								loader.done();
							})
							.then(() => {
								loader.done();
								this.parent.append(this.popup);
							});
				}
				async close(event) {
					this.popup.remove();
					await this.events.closed(event || null);
					URL.revokeObjectURL(this.imageBlob);
					return true;
				}
				openOriginal() {
					window.open(this.options.img, "_blank");
				}
			},
			Menu: class Menu {
				constructor({
					content,
					footerContent,
					title,
					target,
					position = "right",
					fullHeight = false,
					appendTo = SAHYG.Components.popup.$container,
				} = {}) {
					this.content = content;
					this.footerContent = footerContent;
					this.title = title;
					this.$target = $(target);
					this.fullHeight = fullHeight;
					this.$appendTo = $(appendTo);

					this.$ = SAHYG.createElement(
						"menu",
						{
							on: {
								click: this.µclick.bind(this),
							},
							class: `${fullHeight ? "full-height" : ""} ${position == "right" ? "right" : "left"}`,
						},
						SAHYG.createElement(
							"div",
							{ class: "menu-container" },
							SAHYG.createElement(
								"div",
								{ class: "menu-header" },
								SAHYG.createElement("div", { class: "menu-close-icon lafs", on: { click: this.close.bind(this) } }, "&#xf00d;"),
								SAHYG.createElement("div", { class: "menu-title" }, title || "")
							),
							SAHYG.createElement(
								"div",
								{ class: "menu-body" },
								content,
								SAHYG.createElement("div", { class: "menu-footer" }, footerContent)
							)
						)
					);

					if (target instanceof $) {
						SAHYG.on("click", target, this.toggle.bind(this));
						$(target).get(0)._menu = this;
					}
				}
				µclick({ target }) {
					if ($(target).is("menu")) this.close();
				}
				close() {
					this.$.removeClass("opened");
					return this;
				}
				open(mount = true) {
					if (mount && !this.isMounted()) this.mount();
					this.$.addClass("opened");
					return this;
				}
				toggle() {
					if (this.isOpened()) this.close();
					else this.open();
					return this;
				}
				isOpened() {
					return this.$.hasClass("opened");
				}
				isMounted() {
					return Boolean(this.$appendTo.find(this.$).length);
				}
				mount() {
					this.$appendTo.append(this.$);
					return this;
				}
				unmount() {
					if (!this.isMounted()) return this;
					this.$.remove();
					return this;
				}
				setContent(content) {
					this.content = content;
					this.$.find(".menu-body")
						.html("")
						.append(...(content instanceof Array ? content : [content]));
					return this;
				}
				setTitle(title) {
					this.title = title;
					this.$.find(".menu-title").text(title);
					return this;
				}
			},
		},
		toast: {
			$container: "toasts",
			errorOccured: async function () {
				SAHYG.Components.toast.Toast.danger({
					message: await SAHYG.translate("ERROR_OCCURRED"),
				}).show();
			},
			Toast: class Toast {
				timeout;
				events = {
					closed: (event) => {},
					clicked: (event) => {},
				};

				constructor({ message = "", type = "info", timeout = 5000, ...options }) {
					this.params = { message, type, timeout, ...options };
					this.container = $("toasts");
					this.element = SAHYG.createElement(
						"toast",
						{ type },
						SAHYG.createElement("span", { class: "content" }, message),
						SAHYG.createElement("div", { class: "close" }, "&#xf00d;")
					);
					SAHYG.on("click", this.element.children(".close"), this.remove.bind(this));

					this.element.get(0)._toast = this;
				}

				remove(event) {
					event?.preventDefault();
					event?.stopPropagation();
					this.element.removeClass("visible");
					setTimeout(() => {
						this.element.remove();
						this.events.closed(event || null);
					}, 200);
					return this;
				}

				show() {
					this.container.append(this.element);
					this.timeout = setTimeout(this.remove.bind(this), this.params.timeout);
					setTimeout(this.element.addClass.bind(this.element, "visible"), 0);
					return this;
				}

				closed(cb) {
					this.events.closed = (e) => cb(e, this);
					return this;
				}

				clicked(cb) {
					this.events.clicked = (e) => cb(e, this);
					this.element.addClass("clickable");
					SAHYG.on("click", this.element, this.events.clicked);
					return this;
				}

				static info({ message, timeout, ...options }) {
					return new SAHYG.Components.toast.Toast({ message, type: "info", timeout, ...options });
				}
				static success({ message, timeout, ...options }) {
					return new SAHYG.Components.toast.Toast({ message, type: "success", timeout, ...options });
				}
				static warning({ message, timeout, ...options }) {
					return new SAHYG.Components.toast.Toast({ message, type: "warning", timeout, ...options });
				}
				static danger({ message, timeout, ...options }) {
					return new SAHYG.Components.toast.Toast({ message, type: "danger", timeout, ...options });
				}
			},
		},
		tooltip: {
			$container: "tooltips",
			userTooltip: function (data) {
				return SAHYG.createElement(
					"div",
					{ class: "user-tooltip" },
					data.avatarUrl == null
						? SAHYG.createElement("span", { class: "lafs avatar" }, "&#xf007;")
						: SAHYG.createElement("img", { src: data.avatarUrl, class: "avatar" }),
					SAHYG.createElement(
						"div",
						{ class: "infos" },
						SAHYG.createElement("span", { class: "username" }, data.username),
						SAHYG.createElement(
							"div",
							{ class: "icons" },
							data.certified ? SAHYG.createElement("span", { class: "lafs", style: "color: var(--green-700)" }, "&#xf0a3;") : null,
							data.group?.name == "owner"
								? SAHYG.createElement("span", { class: "lafs", style: "color: var(--yellow-600)" }, "&#xf521;")
								: null,
							data.group?.name == "administrator"
								? SAHYG.createElement("span", { class: "lafs", style: "color: var(--red-600)" }, "&#xf7d9;")
								: null,
							data.group?.name == "vip"
								? SAHYG.createElement("span", { class: "lafr", style: "color: var(--blue-600)" }, "&#xf005;")
								: null
						)
					)
				).get(0).outerHTML;
			},
			menu: function (target, items, options = {}, mainInstance) {
				return tippy(typeof target == "string" ? target : $(target).get(0), {
					appendTo: document.querySelector("menus"),
					content: "",
					trigger: "click",
					interactive: true,
					placement: "bottom",
					duration: 200,
					onCreate(instance) {
						let menu = SAHYG.createElement("div", { class: "tooltip-menu" });
						for (let item of items) {
							if (item.type == "divider") menu.append(SAHYG.createElement("span", { class: "divider", ...(item.attributes || {}) }));
							else if (item.type == "button")
								menu.append(
									SAHYG.createElement(
										"div",
										{
											class: "item button",
											on: {
												click: function () {
													if (!item.keepOpen) instance.hide(), mainInstance?.hide?.();
													item.callback.call(this, instance, ...arguments);
												},
											},
											...(item.attributes || {}),
										},
										SAHYG.createElement("span", { class: "icon lafs" }, item.icon || ""),
										SAHYG.createElement("span", { class: "text" }, item.text)
									)
								);
							else if (item.type == "dropdown") {
								let dropdownTarget;
								menu.append(
									(dropdownTarget = SAHYG.createElement(
										"div",
										{ class: "item dropdown", ...(item.attributes || {}) },
										SAHYG.createElement("span", { class: "icon lafs" }, item.icon || ""),
										SAHYG.createElement("span", { class: "text" }, item.text),
										SAHYG.createElement("span", { class: "dropdown-icon lafs" }, "&#xf105;")
									))
								);
								SAHYG.Components.tooltip.menu(
									dropdownTarget,
									item.dropdown,
									{
										trigger: "mouseenter focus",
										placement: "right",
										appendTo: "parent",
										popperOptions: {
											modifiers: [
												{
													name: "flip",
													options: {
														fallbackPlacements: ["right", , "left", "bottom", "top"],
													},
												},
											],
										},
										interactiveBorder: 30,
										interactiveDebounce: 1,
									},
									instance
								);
							}
						}
						instance.setContent(menu.get(0));
					},
					...options,
				});
			},
		},
		loader: {
			$popups: "popups",
			$loader: "#components c-loader",
			replaceContent: function (element, loadingText = true) {
				element = $(element);
				let content = element.contents();
				let elem = this.$loader.clone().addClass("visible");
				if (!loadingText) elem.find(".status").remove();
				element.contents().remove();
				element.append(elem);
				elem.done = () => {
					element.contents().remove();
					element.append(content);
				};
				return elem;
			},
			center: function () {
				let elem = this.$loader.clone().addClass("visible center");
				this.$popups.append(elem);
				elem.done = () => {
					elem.remove();
				};
				return elem;
			},
		},
		headerMenu: {
			$menu: "header-menu",
			$menuIcon: "menu-icon",
			isOpened: function () {
				return SAHYG.Components.headerMenu.$menu.attr("status") == "opened";
			},
			toggle: function () {
				if (SAHYG.Components.headerMenu.isOpened()) SAHYG.Components.headerMenu.close();
				else SAHYG.Components.headerMenu.open();
			},
			close: function () {
				SAHYG.Components.headerMenu.$menu.attr("status", "closed");
				SAHYG.Components.headerMenu.$menuIcon.attr("status", "closed");
			},
			open: function () {
				SAHYG.Components.headerMenu.$menu.attr("status", "opened");
				SAHYG.Components.headerMenu.$menuIcon.attr("status", "opened");
			},
		},
		headerAccount: {
			$menu: "header .account .menu",
			toggle: function (e) {
				e?.stopPropagation();
				if (!SAHYG.Components.headerAccount.$menu.length) return true;
				if ($(e.target).closest("header .account .menu").length) return null;
				if (SAHYG.Components.headerAccount.isOpened()) return SAHYG.Components.headerAccount.close(), false;
				else return SAHYG.Components.headerAccount.open(), false;
			},
			open: function () {
				if (!SAHYG.Components.headerAccount.$menu.length) return true;
				SAHYG.Components.headerAccount.$menu.attr("status", "opened");
				return false;
			},
			close: function () {
				if (!SAHYG.Components.headerAccount.$menu.length) return true;
				SAHYG.Components.headerAccount.$menu.attr("status", "closed");
				return false;
			},
			outsideClose: function (e) {
				if (!SAHYG.Components.headerAccount.$menu.length) return true;
				if (SAHYG.Components.headerAccount.isOpened()) {
					if (e ? $(e.target).closest("header .account .menu").length || $(e.target).closest("popups").length : false) return true;
					e?.stopPropagation();
					SAHYG.Components.headerAccount.$menu.attr("status", "closed");
					return false;
				} else return true;
			},
			isOpened: function () {
				if (!SAHYG.Components.headerAccount.$menu.length) return null;
				return SAHYG.Components.headerAccount.$menu.attr("status") == "opened";
			},
		},
		input: {
			select: async function ({ options, defaultValue, events, placeholder }) {
				return SAHYG.createElement(
					"c-select",
					{
						events,
						placeholder: placeholder,
					},
					SAHYG.createElement("c-select-current", {}, options.find((option) => option.name == defaultValue)?.text),
					SAHYG.createElement(
						"c-select-options",
						{},
						...options.map(({ name, text, icon }) =>
							SAHYG.createElement(
								"c-select-option",
								{ "data-value": name },
								SAHYG.createElement("c-select-option-icon", {}), //TODO
								SAHYG.createElement("c-select-option-information", {}, SAHYG.createElement("c-select-option-title", {}, text))
							)
						)
					)
				);
			},
			boolean: async function ({ defaultValue, events }) {
				return SAHYG.createElement("c-boolean", { events, value: String(Boolean(defaultValue)) }, SAHYG.createElement("c-boolean-circle"));
			},
			list: async function ({ defaultValue, events }) {
				let values = SAHYG.createElement("c-input-list-values", {});

				let newEntry = (value) => {
					let valueElement = SAHYG.createElement("c-input-list-value", {}, SAHYG.createElement("c-input-list-value-text", {}, value));
					valueElement.append(SAHYG.createElement("c-input-list-value-remove"));
					values.append(valueElement);
				};
				defaultValue.forEach(newEntry);

				return SAHYG.createElement("c-input-list", { events }, values, SAHYG.createElement("c-input-list-add"));
			},
			color: async function ({ defaultValue, on = {} } = {}) {
				let input;

				on.input = on?.input
					? (function (inputHandler) {
							return async function () {
								input.attr("value", input.val());
								return await inputHandler.call(this, ...arguments);
							};
					  })(on.input)
					: function () {
							input.attr("value", input.val());
					  };

				input = SAHYG.createElement("input", {
					on,
					type: "color",
					value: defaultValue || "#000000",
				});
				return Object.assign(SAHYG.createElement("c-color-picker", {}, input), { input });
			},
		},
	},
	Utils: {
		selection: {
			clear() {
				(window.getSelection ? window.getSelection() : document.selection).empty();
			},
		},
		scroll: {
			$scrollContainer: "scroll-container",
			top(scrollContainer) {
				if (!(scrollContainer instanceof HTMLElement) || !(scrollContainer instanceof $)) scrollContainer = this.$scrollContainer;
				else scrollContainer = $(scrollContainer);
				scrollContainer.animate({ scrollTop: 0 }, "slow");
			},
			bottom(scrollContainer) {
				if (!(scrollContainer instanceof HTMLElement) || !(scrollContainer instanceof $)) scrollContainer = this.$scrollContainer;
				else scrollContainer = $(scrollContainer);
				scrollContainer.animate({ scrollTop: $(document).height() + scrollContainer.position().top }, "slow");
			},
			to(pos, scrollContainer) {
				if (!(scrollContainer instanceof HTMLElement) || !(scrollContainer instanceof $)) scrollContainer = this.$scrollContainer;
				else scrollContainer = $(scrollContainer);

				if (pos instanceof HTMLElement || pos instanceof $) pos = $(pos).get(0);
				else if (typeof pos === "string") pos = $(`[id="${pos}"]`).get(0);

				if (pos)
					scrollContainer.animate(
						{ scrollTop: pos.getBoundingClientRect().top + scrollContainer.scrollTop() - scrollContainer.position().top },
						"slow"
					);
			},
		},
		url: {
			getParams(url = location.href) {
				return Object.fromEntries(
					decodeURI(url)
						.match(/(?<=\?|&)[^&=]+[^&]+/gm)
						?.map((e) => (e.split("=").length == 1 ? [e, null] : e.split("="))) || []
				);
			},
			getStrParams(url = location.href) {
				return decodeURI(url).match(/(?<=\?).+/gm);
			},
			getAnchor(url = location.href) {
				return decodeURI(url).match(/(?<=#)[^?]+/gm)?.[0] || null;
			},
			setAnchor(anchor, url = location.href) {
				return decodeURI(url).replace(/#[^?]+|(?=\?.+$)/m, "#" + anchor);
			},
			setLocationAnchor(anchor) {
				return (location.href = `#${anchor}${((p = this.getStrParams()), p ? "?" + p : "")}`);
			},
			setParams(params, url = location.href) {
				return decodeURI(url).replace(
					/(?:\?|#).+/m,
					`${((a = this.getAnchor(url)), a ? "#" + a : "")}?${Object.entries({
						...this.getParams(url),
						...params,
					})
						.map((e) => e.join("="))
						.join("&")
						.replace(/\s/gm, "%20")}`
				);
			},
			setParam(name, value, url = location.href) {
				return decodeURI(url).replace(
					/(?:\?|#).+/m,
					`${((a = this.getAnchor(url)), a ? "#" + a : "")}?${Object.entries({
						...this.getParams(url),
						[name]: value,
					})
						.map((e) => e.join("="))
						.join("&")
						.replace(/\s/gm, "%20")}`
				);
			},
			removeParam(name, url = location.href) {
				return decodeURI(url).replace(
					/(?:\?|#).+/m,
					`${((a = this.getAnchor(url)), a ? "#" + a : "")}?${Object.entries(this.getParams())
						.filter(([paramName]) => name != paramName)
						.map((e) => e.join("="))
						.join("&")
						.replace(/\s/gm, "%20")}`
				);
			},
			removeParams(names, url = location.href) {
				return decodeURI(url).replace(
					/(?:\?|#).+/m,
					`${((a = this.getAnchor(url)), a ? "#" + a : "")}?${Object.entries(this.getParams())
						.filter(([paramName]) => !names.includes(paramName))
						.map((e) => e.join("="))
						.join("&")
						.replace(/\s/gm, "%20")}`
				);
			},
			setLocationParams(params) {
				let url = `${((a = this.getAnchor()), a ? "#" + a : "")}?${Object.entries({ ...this.getParams(), ...params })
					.map((e) => e.join("="))
					.join("&")
					.replace(/\s/gm, "%20")}`;
				return history.pushState({}, "", url);
			},
			setLocationParam(name, value) {
				let url = `${((a = this.getAnchor()), a ? "#" + a : "")}?${Object.entries({ ...this.getParams(), [name]: value })
					.map((e) => e.join("="))
					.join("&")
					.replace(/\s/gm, "%20")}`;
				return history.pushState({}, "", url);
			},
			removeLocationParam(name) {
				let url = `${((a = this.getAnchor()), a ? "#" + a : "")}?${Object.entries(this.getParams())
					.filter(([paramName]) => name != paramName)
					.map((e) => e.join("="))
					.join("&")
					.replace(/\s/gm, "%20")}`;
				return history.pushState({}, "", url);
			},
			removeLocationParams(names) {
				let url = `${((a = this.getAnchor()), a ? "#" + a : "")}?${Object.entries(this.getParams())
					.filter(([paramName]) => !names.includes(paramName))
					.map((e) => e.join("="))
					.join("&")
					.replace(/\s/gm, "%20")}`;
				return history.pushState({}, "", url);
			},
			parse(url = location.href) {
				url = new URL(url);
				url.params = this.getParams(url.href);
				url.anchor = this.getAnchor(url.href);
				return url;
			},
			isUrl(str) {
				return /^[a-z](?:[-a-z0-9\+\.])*:(?:\/\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:\xA0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|[\uD800-\uD83E\uD840-\uD87E\uD880-\uD8BE\uD8C0-\uD8FE\uD900-\uD93E\uD940-\uD97E\uD980-\uD9BE\uD9C0-\uD9FE\uDA00-\uDA3E\uDA40-\uDA7E\uDA80-\uDABE\uDAC0-\uDAFE\uDB00-\uDB3E\uDB44-\uDB7E][\uDC00-\uDFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F][\uDC00-\uDFFD])*@)?(?:\[(?:(?:(?:[0-9a-f]{1,4}:){6}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|::(?:[0-9a-f]{1,4}:){5}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:[0-9a-f]{1,4}:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|v[0-9a-f]+[-a-z0-9\._~!\$&'\(\)\*\+,;=:]+)\]|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3}|(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=@\xA0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|[\uD800-\uD83E\uD840-\uD87E\uD880-\uD8BE\uD8C0-\uD8FE\uD900-\uD93E\uD940-\uD97E\uD980-\uD9BE\uD9C0-\uD9FE\uDA00-\uDA3E\uDA40-\uDA7E\uDA80-\uDABE\uDAC0-\uDAFE\uDB00-\uDB3E\uDB44-\uDB7E][\uDC00-\uDFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F][\uDC00-\uDFFD])*)(?::[0-9]*)?(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|[\uD800-\uD83E\uD840-\uD87E\uD880-\uD8BE\uD8C0-\uD8FE\uD900-\uD93E\uD940-\uD97E\uD980-\uD9BE\uD9C0-\uD9FE\uDA00-\uDA3E\uDA40-\uDA7E\uDA80-\uDABE\uDAC0-\uDAFE\uDB00-\uDB3E\uDB44-\uDB7E][\uDC00-\uDFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F][\uDC00-\uDFFD]))*)*|\/(?:(?:(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|[\uD800-\uD83E\uD840-\uD87E\uD880-\uD8BE\uD8C0-\uD8FE\uD900-\uD93E\uD940-\uD97E\uD980-\uD9BE\uD9C0-\uD9FE\uDA00-\uDA3E\uDA40-\uDA7E\uDA80-\uDABE\uDAC0-\uDAFE\uDB00-\uDB3E\uDB44-\uDB7E][\uDC00-\uDFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F][\uDC00-\uDFFD]))+)(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|[\uD800-\uD83E\uD840-\uD87E\uD880-\uD8BE\uD8C0-\uD8FE\uD900-\uD93E\uD940-\uD97E\uD980-\uD9BE\uD9C0-\uD9FE\uDA00-\uDA3E\uDA40-\uDA7E\uDA80-\uDABE\uDAC0-\uDAFE\uDB00-\uDB3E\uDB44-\uDB7E][\uDC00-\uDFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F][\uDC00-\uDFFD]))*)*)?|(?:(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|[\uD800-\uD83E\uD840-\uD87E\uD880-\uD8BE\uD8C0-\uD8FE\uD900-\uD93E\uD940-\uD97E\uD980-\uD9BE\uD9C0-\uD9FE\uDA00-\uDA3E\uDA40-\uDA7E\uDA80-\uDABE\uDAC0-\uDAFE\uDB00-\uDB3E\uDB44-\uDB7E][\uDC00-\uDFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F][\uDC00-\uDFFD]))+)(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|[\uD800-\uD83E\uD840-\uD87E\uD880-\uD8BE\uD8C0-\uD8FE\uD900-\uD93E\uD940-\uD97E\uD980-\uD9BE\uD9C0-\uD9FE\uDA00-\uDA3E\uDA40-\uDA7E\uDA80-\uDABE\uDAC0-\uDAFE\uDB00-\uDB3E\uDB44-\uDB7E][\uDC00-\uDFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F][\uDC00-\uDFFD]))*)*|(?!(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|[\uD800-\uD83E\uD840-\uD87E\uD880-\uD8BE\uD8C0-\uD8FE\uD900-\uD93E\uD940-\uD97E\uD980-\uD9BE\uD9C0-\uD9FE\uDA00-\uDA3E\uDA40-\uDA7E\uDA80-\uDABE\uDAC0-\uDAFE\uDB00-\uDB3E\uDB44-\uDB7E][\uDC00-\uDFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F][\uDC00-\uDFFD])))(?:\?(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\/\?\xA0-\uD7FF\uE000-\uFDCF\uFDF0-\uFFEF]|[\uD800-\uD83E\uD840-\uD87E\uD880-\uD8BE\uD8C0-\uD8FE\uD900-\uD93E\uD940-\uD97E\uD980-\uD9BE\uD9C0-\uD9FE\uDA00-\uDA3E\uDA40-\uDA7E\uDA80-\uDABE\uDAC0-\uDAFE\uDB00-\uDB3E\uDB44-\uDB7E\uDB80-\uDBBE\uDBC0-\uDBFE][\uDC00-\uDFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F\uDBBF\uDBFF][\uDC00-\uDFFD])*)?(?:\#(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\/\?\xA0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|[\uD800-\uD83E\uD840-\uD87E\uD880-\uD8BE\uD8C0-\uD8FE\uD900-\uD93E\uD940-\uD97E\uD980-\uD9BE\uD9C0-\uD9FE\uDA00-\uDA3E\uDA40-\uDA7E\uDA80-\uDABE\uDAC0-\uDAFE\uDB00-\uDB3E\uDB44-\uDB7E][\uDC00-\uDFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F][\uDC00-\uDFFD])*)?$/i.test(
					str
				);
			},
		},
		cookie: {
			parse() {
				return Object.fromEntries(document.cookie.split(";").map((cookie) => cookie.trim().split("=")));
			},
			get(name) {
				return this.parse()?.[name];
			},
			set(name, value) {
				document.cookie = `${name}=${value}; expires=Fri, 31 Dec 9999 23:59:59 GMT`;
				return true;
			},
			remove(name) {
				document.cookie = `${name}=; Max-Age=-1`;
				return true;
			},
			async consentPopup() {
				let popup = new SAHYG.Components.popup.Popup();
				popup
					.title("🍪 " + (await SAHYG.translate("COOKIES")))
					.content(
						SAHYG.createElement(
							"div",
							{},
							await SAHYG.translate("COOKIES_CONSENT"),
							SAHYG.createElement("br"),
							SAHYG.createElement(
								"a",
								{ href: "/about#cookies", on: { click: popup.close } },
								await SAHYG.translate("MORE_INFORMATIONS")
							)
						)
					)
					.button("ok", {
						text: await SAHYG.translate("OK"),
						callback: (btn, event) => {
							btn.close();
							this.consent();
						},
					})
					.show();
				return null;
			},
			consent() {
				localStorage.setItem("cookie_consent", "true");
				return true;
			},
		},
		settings: {
			theme: {
				setDark(save = true) {
					$("html").attr("theme", "dark");
					SAHYG.Utils.cookie.set("theme", "dark");
					if (save) this.save();
					return true;
				},
				setLight(save = true) {
					$("html").attr("theme", "light");
					SAHYG.Utils.cookie.set("theme", "light");
					if (save) this.save();
					return true;
				},
				set(theme, save = true) {
					if (theme == "light") this.setLight(save);
					else if (theme == "dark") this.setDark(save);
					else return false;
				},
				current() {
					return $("html").attr("theme");
				},
				async toggle() {
					if (this.current() == "dark") return this.setLight(), "light";
					else return this.setDark(), "dark";
				},
				async save() {
					if (SAHYG.Utils.user.isConnected())
						SAHYG.Components.toast.Toast.info({ message: await SAHYG.translate("CLICK_TO_SAVE") })
							.clicked(async function (event, btn) {
								btn.remove();
								SAHYG.Api.post("/settings", { theme: $("html").attr("theme") == "light" ? "light" : "dark" })
									.then(async () => SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("SAVED") }).show())
									.catch(async () =>
										SAHYG.Components.toast.Toast.error({
											message: await SAHYG.translate("ERROR_OCCURRED"),
										}).show()
									);
							})
							.show();
					else return $("html").attr("theme");
				},
			},
			locale: {
				async set(locale, reload = true, saveIfPossible = true) {
					SAHYG.Utils.cookie.set("locale", locale);
					if (saveIfPossible && SAHYG.Utils.user.isConnected()) {
						SAHYG.Api.post("/settings", { locale })
							.then(() => (reload ? location.reload() : null))
							.cacth(() => {});
					} else if (reload) location.reload();
					return null;
				},
			},
		},
		user: {
			isConnected() {
				return $("html").attr("connected") == "";
			},
			async logout(confirm = true) {
				if (confirm)
					SAHYG.Components.popup.Popup.confirm(await SAHYG.translate("LOGOUT_CONFIRM")).then((result) =>
						result.confirm ? (window.location.href = "/logout") : null
					);
				else window.location.href = "/logout";
				return false;
			},
			username() {
				return $("header .account > .username").text();
			},
		},
		element: {
			getDataAttribute(elem, name) {
				return $(elem).attr("data-" + name);
			},
			resizeTextarea(target) {
				target = $(target);

				let maxHeight = parseFloat(target.css("max-height")) || 300;
				let minHeight = parseFloat(target.css("mix-height")) || 25;
				let bordersHeight =
					parseFloat(target.css("border-top-width")) +
					parseFloat(target.css("border-bottom-width")) +
					parseFloat(target.css("padding-top")) +
					parseFloat(target.css("padding-bottom"));

				target.height(0);
				target.height(Math.max(Math.min(target.get(0).scrollHeight, maxHeight), minHeight) - bordersHeight + "px");

				if (target.height() > maxHeight) target.css({ "overflow-y": "scroll" });
				else target.css({ "overflow-y": "hidden" });
			},
		},
		units: {
			formatOctets(octets, decimals = 2) {
				let [int, str] =
					octets / 10 ** 12 > 0.5
						? [10 ** 12, "To"]
						: octets / 10 ** 9 > 0.5
						? [10 ** 9, "Go"]
						: octets / 10 ** 6 > 0.5
						? [10 ** 6, "Mo"]
						: octets / 10 ** 3 > 0.5
						? [10 ** 3, "Ko"]
						: [1, "o"];
				return `${(octets / int).toFixed(decimals)} ${str}`;
			},
		},
		input: {
			/**
			 * Select file(s)
			 * @param {String} type content type; Ex: 'image/jpeg' or '.png, .pdf'
			 * @param {Boolean} multiple
			 * @returns {Promise<File|File[]>}
			 */
			file(type, multiple) {
				return new Promise((resolve) => {
					SAHYG.createElement("input", {
						type: "file",
						multiple: multiple,
						accept: type,
						events: {
							input: (e) => {
								let files = Array.from(e.target.files);
								e.target.remove();
								if (multiple) resolve(files);
								else resolve(files[0]);
							},
						},
					})
						.appendTo("hidden-content")
						.trigger("click");
				});
			},
			async text({ title, description, defaultValue, placeholder, largeText = false, validator = () => true } = {}) {
				let id = Math.random().toString(36).substring(2);
				return (
					await SAHYG.Components.popup.Popup.input(
						title,
						[
							{
								name: id,
								placeholder,
								type: "text",
								defaultValue,
								description,
								validator,
							},
						],
						largeText
					)
				)?.[id];
			},
			icon(target) {
				return new Promise(async (resolve) => {
					await SAHYG.Utils.icons.getAll();

					let eventsClick = [],
						eventsHover = [],
						eventTarget;

					tippy(target, {
						placement: "bottom",
						trigger: "manual",
						content: "",
						appendTo: $("menus").get(0),
						interactive: true,
						maxWidth: "none",
						onClickOutside(instance) {
							resolve(null);
						},
						onHidden(instance) {
							instance.destroy();
							eventsClick.forEach((e) => SAHYG.off("click", e));
							eventsHover.forEach((e) => SAHYG.off("mouseover", e));
							SAHYG.off("click", eventTarget);
						},
						async onCreate(instance) {
							let body, nameContainer;
							let timeout;

							SAHYG.once("click", target, instance.hide);

							instance.setContent(
								SAHYG.createElement(
									"icon-picker",
									{},
									SAHYG.createElement(
										"div",
										{ class: "header" },
										SAHYG.createElement(
											"div",
											{ class: "search-bar" },
											SAHYG.createElement("input", {
												on: {
													input: async ({ target }) => {
														let search = async () => {
															let query = $(target).val();
															if (!query.length) body.children().removeClass("hidden");
															SAHYG.Cache.icons.forEach((icon) => {
																if (SAHYG.Utils.icons.check(icon, query))
																	body.children(`[data-name="${icon.name}"]`).removeClass("hidden");
																else body.children(`[data-name="${icon.name}"]`).addClass("hidden");
															});
														};

														if (timeout) clearTimeout(timeout);
														timeout = setTimeout(search, 500);
													},
												},
												placeholder: await SAHYG.translate("SEARCH"),
											})
										)
									),
									(body = SAHYG.createElement(
										"div",
										{ class: "body" },
										SAHYG.Cache.icons.map((icon) => {
											let click = () => {
												instance.hide();
												resolve(icon);
											};
											let hover = () => nameContainer.text(icon.names[1] || icon.name);
											eventsClick.push(click);
											eventsHover.push(hover);
											return SAHYG.createElement(
												"span",
												{
													class: "icon " + icon.styles?.join(" "),
													on: { click, mouseover: hover },
													"data-name": icon.name,
												},
												`&#x${icon.unicode};`
											);
										})
									)),
									SAHYG.createElement(
										"div",
										{ class: "footer" },
										(nameContainer = SAHYG.createElement("div", { class: "icon-name" }))
									)
								).get(0)
							);
						},
					}).show();
				});
			},
			color(target, defaultColor) {
				let inputEvent, clickEvent, targetEvent;

				return new Promise((resolve) => {
					tippy(target, {
						placement: "bottom",
						trigger: "manual",
						content: "",
						appendTo: $("menus").get(0),
						interactive: true,
						maxWidth: "none",
						onClickOutside(instance) {
							resolve(null);
						},
						onHidden(instance) {
							SAHYG.off("input", inputEvent);
							SAHYG.off("click", clickEvent);
							SAHYG.off("click", targetEvent);
							instance.destroy();
						},
						async onCreate(instance) {
							let input;

							SAHYG.once("click", target, instance.hide);

							let picker = SAHYG.createElement(
								"color-picker",
								{},
								(input = await SAHYG.Components.input.color({ defaultValue: defaultColor })),
								SAHYG.createElement(
									"btn",
									{
										class: "btn-full",
										on: {
											click: (clickEvent = () => {
												instance.hide();
												resolve(input.input.val());
											}),
										},
									},
									await SAHYG.translate("CONFIRM")
								)
							);
							instance.setContent(picker.get(0));
						},
					}).show();
				});
			},
		},
		icons: {
			async getAll() {
				if (SAHYG.Cache.icons.length) return true;
				let icons = (await SAHYG.Api.getStatic("/line-awesome.json").catch(() => {})) || {};
				if (!icons) return false;
				SAHYG.Cache.icons = icons;
				return true;
			},
			check(icon, queries, disabledQuery = ["name", "category", "categories", "styles", "unicode"]) {
				if (typeof queries == "string" || queries instanceof Array)
					queries = Object.fromEntries(
						["name", "names", "category", "categories", "tags", "styles", "unicode"]
							.filter((k) => !disabledQuery.includes(k))
							.map((k) => [k, queries])
					);
				return Object.entries(queries).some(([queryName, queryValue]) =>
					icon[queryName]
						? queryValue instanceof Array
							? queryValue.some((qValue) =>
									icon[queryName] instanceof Array
										? icon[queryName].some((v) => v.includes(qValue))
										: icon[queryName].includes(qValue)
							  )
							: icon[queryName] instanceof Array
							? icon[queryName].some((v) => v.includes(queryValue))
							: icon[queryName].includes(queryValue)
						: false
				);
			},
			async get(query) {
				if (!SAHYG.Cache.icons.length) await SAHYG.Utils.icons.getAll();
				let icons = SAHYG.Cache.icons;

				let filteredIcons = icons.filter((icon) => SAHYG.Utils.icons.check(icon, query));
				if (filteredIcons.length == 0) return null;
				if (filteredIcons.length == 1) return filteredIcons[0];
				return filteredIcons;
			},
		},
		file: {
			toDataUrl(blob) {
				return new Promise((resolve) => {
					let fr = new FileReader();
					fr.onload = () => resolve(fr.result);
					fr.readAsDataURL(blob);
				});
			},
		},
	},
	Api: {
		_request(type, link, content = {}) {
			return axios({
				method: type,
				url: SAHYG.Api.domain + link,
				data: content,
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Accept: "application/json",
				},
			});
		},
		async login(login, password) {
			return axios({
				method: "POST",
				url: SAHYG.Api.domain + "/login",
				data: { login, password },
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Accept: "application/json",
				},
			});
		},
		async status() {
			let { content } = await SAHYG.Api._request("GET", "/status"); // TODO
		},
		async post(url, content, full) {
			let res = await SAHYG.Api._request("POST", url, content);
			return full ? res.data : res.data.content;
		},
		async get(url, content, full) {
			let res = await SAHYG.Api._request("GET", url, content);
			return full ? res.data : res.data.content;
		},
		async getStatic(url) {
			return (await SAHYG.Api._request("GET", url))?.data;
		},
	},
	RequestEvents: {
		async request(response) {
			// console.log(response);
			if (response.data?.success === false) {
				let error;
				switch (response.data?.status) {
					case "UNAUTHORIZED": {
						error = new Error("UNAUTHORIZED");
						await SAHYG.RequestEvents.notAuthorized();
						break;
					}
					default: {
						if (response.data?.description) {
							SAHYG.Components.toast.Toast.danger({
								message: response.data.description,
							}).show();
						} else {
							error = new Error("SERVER_ERROR");
							await SAHYG.RequestEvents.error();
						}
					}
				}
				return Promise.reject(error);
			}
			return response;
		},
		async notAuthorized() {
			new SAHYG.Components.popup.Popup({
				title: await SAHYG.translate("ERROR_OCCURRED"),
				content: await SAHYG.translate("ERROR_UNAUTHORIZED_LOGIN"),
				buttons: {
					refresh: {
						text: await SAHYG.translate("REFRESH"),
						style: undefined,
						callback: (popup, event) => {
							popup.close();
							location.reload();
						},
					},
					ok: {
						text: await SAHYG.translate("OK"),
						style: "fullColor",
						callback: (popup, event) => {
							popup.close();
						},
					},
				},
			}).show();
		},
		async error(event) {
			SAHYG.Components.toast.Toast.danger({
				message: await SAHYG.translate("ERROR_OCCURRED"),
			}).show();
			return false;
		},
	},
};

SAHYG.Api.domain = SAHYG.Constants.api_domain;
axios.interceptors.response.use(SAHYG.RequestEvents.request, SAHYG.RequestEvents.error);

$(async function () {
	(bind = (obj) => {
		Object.entries(obj).forEach(([k, v]) => {
			if (v.toString?.().startsWith("class")) obj[k] = v;
			else if (typeof v == "function") obj[k] = v; // v.bind(obj) (to replace this with current parent object);
			else if (!(v instanceof Array) && typeof v == "object") bind(obj[k]);
			else if (k.startsWith("$")) obj[k] = $(v);
		});
	}),
		(bind(SAHYG.Utils), bind(SAHYG.Components));

	if (SAHYG.Utils.url.getAnchor()) SAHYG.Utils.scroll.to(SAHYG.Utils.url.getAnchor());

	if (!$("html").attr("theme")) $("html").attr("theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
	SAHYG.Utils.cookie.set("locale", $("html").attr("lang"));
	SAHYG.Utils.cookie.set("theme", $("html").attr("theme"));
	// remove useless tippy stylesheet
	$("[data-tippy-stylesheet]").remove();
	//close header  expandable menu
	$("header-menu .expandable .menu").slideUp(0);
	// ANCHOR Cookies consent
	if (!localStorage.getItem("cookie_consent") && location.pathname != "/about") SAHYG.Utils.cookie.consentPopup();

	SAHYG.eventsList =
		"input blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error";
	SAHYG.Events = Object.fromEntries(SAHYG.eventsList.split(" ").map((e) => [e, []]));

	// ANCHOR Add redirect to /login links
	SAHYG.on("click", 'a[href="/login"]', function (event) {
		event.preventDefault();
		if (!/login/.test(document.location.href)) document.location.href = "/login?redirect=" + document.location.pathname;
		else document.location.href = "/login";
	});
	SAHYG.on("click", ".return-top", SAHYG.Utils.scroll.top);
	SAHYG.on("click", "[data-viewer]", (e) => new SAHYG.Components.popup.Viewer({ img: e.target.src }).show());
	SAHYG.on("click", 'a[href^="#"]:not([href="#"])', (event) => (SAHYG.Utils.scroll.to($(event.target).attr("href").substring(1)), false));
	// Show / hide menu
	SAHYG.on("click", "menu-icon icon", SAHYG.Components.headerMenu.toggle);
	// change language when locale flag was clicked
	SAHYG.on("click", "header-menu .commands .locale dropdown > *", function () {
		SAHYG.Utils.settings.locale.set(this.id);
	});
	// ANCHOR Language
	SAHYG.on("click", "header-menu .commands .locale .current", () => $("header-menu .commands .locale dropdown").toggleClass("visible"));
	// ANCHOR Theme
	SAHYG.on("click", "header-menu .commands .theme", SAHYG.Utils.settings.theme.toggle);
	// ANCHOR Expandable menu
	SAHYG.on("click", "header-menu .expandable > a", (e) =>
		window.innerWidth <= 1024 ? $(e.target).parent().toggleClass("expanded").find(".menu").slideToggle(200) : null
	);
	// ANCHOR Open / close menu
	SAHYG.on("click", "header-menu", function (e) {
		if ($(e.target).is(this)) SAHYG.Components.headerMenu.close();
	});
	// ANCHOR Account logout
	SAHYG.on("click", "header .account .menu .logout", SAHYG.Utils.user.logout);
	// ANCHOR Account menu
	SAHYG.on("click", "header .account", SAHYG.Components.headerAccount.toggle);
	// ANCHOR Easter egg: heart
	SAHYG.on("click", "heart", async () => SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("MADE_WITH_HEART") }).show());
	// ANCHOR Close account menu
	SAHYG.on("click", "html", SAHYG.Components.headerAccount.outsideClose);

	SAHYG.on("mouseenter", "header-menu .expandable", (e) =>
		window.innerWidth > 1024 ? $(e.target).addClass("expanded").children(".menu").slideDown(0) : null
	);

	SAHYG.on("mouseover", "[data-tooltip]", function () {
		if (!this._tippy)
			tippy(this, {
				appendTo: SAHYG.Components.tooltip.$container[0],
				content: $(this).attr("data-tooltip"),
			});
	});
	/**
	 * Display a popup with information about the user when the mouse hovers over the link to the user's profile.
	 */
	SAHYG.on("mouseenter", 'a[href*="/user/"]', function () {
		if ($(this).attr("data-no-tooltip")) return;
		if (!this._tippy)
			tippy(this, {
				delay: [500, 0],
				appendTo: document.querySelector("tooltips"),
				allowHTML: true,
				content: $("#components .svg-loader").clone().addClass("visible").get(0).outerHTML,
				onMount: async function (instance, event) {
					let username = $(this)
						.attr("href")
						?.match(/(?<=\/user\/)[a-z0-9_]{3,10}/)?.[0];
					if (SAHYG.Cache.users[username]) {
						instance.setContent(SAHYG.Components.tooltip.userTooltip(SAHYG.Cache.users[username]));
					} else {
						let data = await SAHYG.Api.get("/resources/user/" + username);
						let element;
						if (!data) element = await SAHYG.translate("UNKNOWN_USER");
						else {
							SAHYG.Cache.users[username] = data;
							element = SAHYG.Components.tooltip.userTooltip(data);
						}
						instance.setContent(element);
					}
				}.bind(this),
			});
	});

	// Bind all event
	$(window).bind(Object.keys(SAHYG.Events).join(" "), async function (event, ...datas) {
		for (eventInformations of SAHYG.Events[event.type]) {
			let target = $(event.target).closest(eventInformations.element);
			if (target.length) {
				let result = await eventInformations.callback.call(target[0], event, ...datas);
				// console.log({ eventType: event.type, result: result, target: eventInformations.element });
				if (result != true) return false;
			}
		}
		return;
	});
});
