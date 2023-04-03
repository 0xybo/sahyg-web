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
		Array.from(document.querySelectorAll('head meta[name*="sahyg-"]'))?.map(($) => {
			let name = $.getAttribute("name");
			let value = $.getAttribute("content");
			let type = $.getAttribute("type");

			if (type == "number") value = Number(value);

			return [name.substring(6).replace(/-/g, "_"), value];
		}) || []
	),
	get popupsContainer() {
		return document.querySelector("#popups");
	},
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
			SAHYG.Cache.translations = SAHYG.Api.get("/resources/translate", {
				locale: SAHYG.$("html")?.[0]?.getAttribute("lang"),
			}).catch((e) => (SAHYG.Cache.translationsFetchError = true));
		}

		if (SAHYG.Cache.translations instanceof Promise) SAHYG.Cache.translations = await SAHYG.Cache.translations;

		let result = SAHYG.Cache.translations[name] || name;
		if (options) {
			Object.entries(options).forEach(([k, v]) => {
				result = result.replace(new RegExp(`{{${k}}}`, "gmi"), String(v));
			});
		}
		return result;
	},
	/**
	 * Create an array of HTMLElement with specified attributes and bind event on it if specified
	 * @param {String} type Element name (ex: `div`) or html (ex: `<div></div>`)
	 * @param {{on: {[eventName: String]: Function}, once: {[eventName: String]: Function}, [attributeName: String]: String}} attr Element attributes
	 * @param  {...HTMLELement | String} children
	 * @returns {HTMLElement}
	 */
	createElement(name, attributes = {}, ...children) {
		let element = document.createElement(name);
		if (attributes.on) {
			Object.entries(attributes.on).forEach(([eventType, callbacks]) => {
				if (!(callbacks instanceof Array)) callbacks = [callbacks];

				callbacks.forEach((callback) => element.addEventListener(eventType, callback));
			});
			delete attributes.on;
		}
		if (attributes.once) {
			Object.entries(attributes.once).forEach(([eventType, callbacks]) => {
				if (!(callbacks instanceof Array)) callbacks = [callbacks];

				callbacks.forEach((callback) => {
					eventListener = element.addEventListener(eventType, callback, { signal: new AbortController().signal });
				});
			});
			delete attributes.once;
		}
		Object.entries(attributes).forEach(([attributeName, attributeValue]) =>
			element.setAttribute(SAHYG.Utils.text.camelToKebab(attributeName), attributeValue)
		);
		element.append(
			...children
				.filter((elem) => elem != undefined && elem != null && elem != NaN)
				.reduce((prev, curr) => (curr instanceof Array ? prev.push(...curr) : prev.push(curr), prev), [])
				.map((elem) => (elem instanceof Element || typeof elem == "string" ? elem : JSON.stringify(elem)))
		);
		return element;
	},
	registerCustomElement(name, element, options = {}) {
		if (this.CustomElements[name]) throw new Error(`sahyg-${name} already exists`);

		this.CustomElements[name] = element;
		customElements.define("sahyg-" + name, element, options);
	},
	html(htmlString) {
		let virtualElement = SAHYG.createElement("div");
		virtualElement.innerHTML = htmlString;
		let children = virtualElement.children;
		return children.length > 1 ? SAHYG.createNodeList(Array.from(virtualElement.children)) : children[0];
	},
	/**
	 * Bind event to an element(s) and return off function
	 * @param {String} type Event type to bind on specified element
	 * @param {String | HTMLElement} element Element
	 * @param  {...Function} callbacks
	 * @returns {{callback: Function, type: String, element: HTMLElement, off: Function}[]}
	 */
	on(type, elements, ...callbacks) {
		if (typeof elements == "string") elements = SAHYG.$(elements);

		if (elements instanceof HTMLCollection) elements = Array.from(elements);
		else if (!(elements instanceof NodeList) && !(elements instanceof Array)) elements = [elements];

		return elements.map((element) =>
			callbacks.map((callback) => {
				element.addEventListener(type, callback);
				return { callback, type, element, off: element.removeEventListener.bind(element, type, callback) };
			})
		);
	},
	/**
	 * Bind event once to an element(s) and return off function
	 * @param {String} type Event type to bind on specified element
	 * @param {String | HTMLElement} element Element
	 * @param  {...Function} callbacks
	 * @returns {{callback: Function, type: String, element: HTMLElement, off: Function}[]}
	 */
	once(type, elements, ...callbacks) {
		if (typeof elements == "string") elements = SAHYG.$(elements);

		if (elements instanceof Array || elements instanceof HTMLCollection) elements = Array.fron(elements);
		else elements = [elements];

		return elements.map((element) =>
			callbacks.map((callback) => {
				element.addEventListener(type, callback, { once: true });
				return { callback, type, element, off: element.removeEventListener.bind(element, type, callback) };
			})
		);
	},
	/**
	 * Bind event to an element(s) (this) and return off function
	 * @param {String} type Event type to bind on specified element
	 * @param  {...Function} callbacks
	 * @returns {{callback: Function, type: String, element: HTMLElement, off: Function}[]}
	 */
	onThis(type, ...callbacks) {
		return SAHYG.on(type, this, ...callbacks);
	},
	/**
	 * Bind event once to an element(s) (this) and return off function
	 * @param {String} type Event type to bind on specified element
	 * @param  {...Function} callbacks
	 * @returns {{callback: Function, type: String, element: HTMLElement, off: Function}[]}
	 */
	onceThis(type, ...callbacks) {
		return SAHYG.once(type, this, ...callbacks);
	},
	dynamicOn(type, selector, ...callbacks) {
		document.addEventListener(type, async function (event) {
			if (SAHYG.$(selector).contains(event.target)) {
				let propagate = true;
				event.stopPropagation = ((stopPropagation) =>
					function () {
						propagate = false;
						stopPropagation.call(this, ...arguments);
					})(event.stopPropagation);
				event.stopImmediatePropagation = ((stopImmediatePropagation) =>
					function () {
						propagate = false;
						stopImmediatePropagation.call(this, ...arguments);
					})(event.stopImmediatePropagation);

				for (let callback of callbacks) {
					if (propagate) await callback.call(event.target, ...arguments);
					else return false;
				}
				return true;
			}
		});
	},
	/**
	 * Select HTMLElements from DOM to array and apply some useful function to it
	 * @param {String} selector CSS selector
	 * @returns {HTMLELement[]}
	 */
	$(selector) {
		if (selector instanceof HTMLElement) return SAHYG.createNodeList(...arguments);

		try {
			let elements = Array.from(document.querySelectorAll(selector));
			if (elements) elements = SAHYG.createNodeList(elements);
			return elements;
		} catch (e) {
			console.error(e);
			return null;
		}
	},
	/**
	 * Select HTMLElement from DOM
	 * @param {String} selector CSS selector
	 * @returns {HTMLELement}
	 */
	$0(selector) {
		try {
			return document.querySelectorAll(selector)[0];
		} catch (e) {
			console.error(e);
			return null;
		}
	},
	createNodeList(...arguments) {
		let nodeList = Reflect.construct(Array, [], NodeList);
		arguments.forEach((arg) => {
			if (arg instanceof HTMLElement || arg instanceof Node) nodeList.push(arg);
			else if (arg instanceof String) nodeList.push(document.createTextNode(arg));
			else if (typeof arg[Symbol.iterator] === "function") nodeList.push(...arg);
		});
		return nodeList;
	},
	/**
	 * Execute the function provided when DOM is ready
	 * @param {Function} fn function to execute
	 */
	onload(fn) {
		document.addEventListener("DOMContentLoaded", fn, { once: true });
	},
	/**
	 * Bind event to an element(s) by adding specified informations to SAHYG.Events variable
	 * @deprecated
	 * @param {String} type Event type to bind on specified element
	 * @param {String | HTMLElement | JQuery} element Element
	 * @param  {...Function} callbacks
	 * @returns {String [ HTMLElement | JQuery]}
	 */
	oldOn(type, element, callback, important = false) {
		if (!SAHYG.Events[type]) SAHYG.Events[type] = [];

		let event = {
			element,
			callback,
			id: ++SAHYG.currentEventID,
		};

		if (important) SAHYG.Events[type]?.unshift(event);
		else SAHYG.Events[type]?.push(event);
		return { id: SAHYG.currentEventID, remove: SAHYG.oldOff.bind(null, SAHYG.currentEventID) };
	},
	/**
	 * Create a JQuery element with specified attributes and bind event on it if specified
	 * @deprecated
	 * @param {String} type Element name (ex: `div`) or html (ex: `<div></div>`)
	 * @param {{events: {[eventName: String]: Function}, [attributeName: String]: String}} attr Element attributes
	 * @param  {...HTMLELement | String | JQuery} children
	 * @returns {JQuery}
	 */
	oldCreateElement(type, attr = {}, ...children) {
		let e = type.startsWith("<") ? $(type) : $(`<${type}></${type}>`);
		if (attr.events || attr.on) {
			Object.entries(attr.events || attr.on).forEach(([name, callback]) => {
				if (callback) SAHYG.oldOn(name, e, callback, true);
			});
			delete attr.events;
			delete attr.on;
		}
		if (attr.once) {
			Object.entries(attr.once).forEach(([name, callback]) => {
				if (callback) SAHYG.oldOnce(name, e, callback, true);
			});
			delete attr.once;
		}
		Object.entries(attr).forEach(([k, v]) => {
			e.attr(k, v);
		});
		children.forEach((child) => (child ? e.append(child) : null));
		return e;
	},
	/**
	 *
	 * @deprecated
	 * @param {*} typeOrID
	 * @param {*} elementOrCallback
	 * @returns
	 */
	oldOff(typeOrID, elementOrCallback) {
		if (typeof typeOrID == "number") {
			type = SAHYG.oldFindEventById(typeOrID)[0]?.type;
			if (!type) return false;
			if (SAHYG.Events[type]) SAHYG.Events[type] = SAHYG.Events[type]?.filter((event) => event.id != typeOrID);
		} else if (SAHYG.Events[typeOrID])
			SAHYG.Events[typeOrID] = SAHYG.Events[typeOrID]?.filter(
				(event) => event.element != elementOrCallback && event.callback != elementOrCallback
			);
	},
	/**
	 *
	 * @deprecated
	 * @param {*} id
	 * @param {*} type
	 * @returns
	 */
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

					this.popup = SAHYG.oldCreateElement(
						"popup",
						{},
						(this.backdrop = SAHYG.oldCreateElement("div", {
							class: "backdrop",
							events: { click: this.close.bind(this) },
						})),
						SAHYG.oldCreateElement(
							"div",
							{ class: "container" },
							SAHYG.oldCreateElement("div", { class: "header" }, SAHYG.oldCreateElement("h3", { class: "title" })),
							SAHYG.oldCreateElement("div", { class: "content" }),
							SAHYG.oldCreateElement("div", { class: "buttons" })
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
							this.buttons.ok.$ = SAHYG.oldCreateElement("input", {
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
					SAHYG.oldOff("click", this.backdrop);
					for (let i in this.buttons) {
						SAHYG.oldOff("click", this.buttons[i].$);
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
					this.buttons[eventName].$ = SAHYG.oldCreateElement("input", {
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
								SAHYG.oldCreateElement(
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
												inputElement = SAHYG.oldCreateElement("input", {
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
												inputElement = SAHYG.oldCreateElement(
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
												inputElement = SAHYG.createElement("sahyg-select", {
													options: JSON.stringify(input.options),
													selected: JSON.stringify([input.defaultValue]),
													placeholder: input.placeholder,
													multiple: "false",
												}).on("input", async ({ target }) => {
													let value = target.getAttribute("data-value");

													let parent = target.closest("[data-input-type]");
													if (!(await input.validator(value))) {
														parent.classList.add("invalid");
														parent.classList.remove("valid");
														return;
													} else {
														parent.classList.remove("invalid");
														parent.classList.add("valid");
													}

													data[input.name] = value;
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
												inputElement = SAHYG.createElement("sahyg-input-list", {
													values: JSON.stringify(input.defaultValue),
												}).on("input", async ({ target, values, added, removed }) => {
													if (!(await input.validator(added))) {
														let parentElement = target.closest("[data-input-type]");
														parentElement.classList.add("invalid");
														parentElement.classList.remove("valid");
														return;
													} else {
														let parentElement = target.closest("[data-input-type]");
														parentElement.classList.add("valid");
														parentElement.classList.remove("invalid");

														data[input.name] = values.map((val) => val.value);
													}
												});
											else if (input.type == "color") {
												inputElement = SAHYG.oldCreateElement("input", {
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

											return SAHYG.oldCreateElement(
												"div",
												{ class: input.inline ? "inline" : "" },
												SAHYG.oldCreateElement("label", { for: input.name }, input.label),
												SAHYG.oldCreateElement("span", { class: "description" }, input.description),
												(input.$container = SAHYG.oldCreateElement("div", { "data-input-type": input.type }, inputElement))
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
					this.popup = SAHYG.oldCreateElement(
						"viewer",
						{},
						SAHYG.oldCreateElement("div", { class: "backdrop", events: { click: this.close.bind(this) } }),
						(this.container = SAHYG.oldCreateElement("div", { class: "container" })),
						SAHYG.oldCreateElement("div", { class: "close-button lafs", events: { click: this.close.bind(this) } }, "\uf00d")
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
					this.container.append((this.infos = SAHYG.oldCreateElement("div", { class: "infos" })));

					if (this.options.title) this.infos.append(SAHYG.oldCreateElement("span", { class: "title" }, decodeURI(this.options.title)));
					else
						this.infos.append(
							SAHYG.oldCreateElement("span", { class: "title" }, decodeURI((this.options.title = this.options.img.split("/").pop())))
						);
					if (this.options.type) this.infos.append(SAHYG.oldCreateElement("span", {}, this.options.type));
					else
						this.infos.append(
							SAHYG.oldCreateElement("span", {}, (this.options.type = this.imageBlob.type.split("/").pop().toUpperCase()))
						);
					if (this.options.widthHeight) this.infos.append(SAHYG.oldCreateElement("span", {}, this.options.widthHeight));
					else
						this.infos.append(
							SAHYG.oldCreateElement("span", {}, (this.options.widthHeight = this.image.width + "x" + this.image.height))
						);
					if (this.options.size) this.infos.append(SAHYG.oldCreateElement("span", {}, SAHYG.Utils.units.formatOctets(this.options.size)));
					else
						this.infos.append(
							SAHYG.oldCreateElement("span", {}, (this.options.size = SAHYG.Utils.units.formatOctets(this.imageBlob.size)))
						);

					if (this.options.openOriginal)
						this.infos.append(
							SAHYG.oldCreateElement(
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
								loader.remove();
							})
							.then(() => {
								loader.remove();
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
					over = true,
				} = {}) {
					this.content = content;
					this.footerContent = footerContent;
					this.title = title;
					this.$target = target;
					this.fullHeight = fullHeight;
					this.$appendTo = appendTo;

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
								SAHYG.createElement("div", { class: "menu-close-icon lafs", on: { click: this.close.bind(this) } }, "\uf00d"),
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

					if (target?.on) {
						target.on("click", this.toggle.bind(this));
						target._menu = this;
					}

					if (over === true) this.$.addClass("over");
					else if (typeof over == "number") {
						if (document.body.clientWidth < over) this.$.addClass("over");
						SAHYG.on("resize", window, ({ target }) => {
							if (document.body.clientWidth < over) this.$.addClass("over");
							else this.$.removeClass("over");
							return true;
						});
					}
				}
				µclick({ target }) {
					if (target.contains("menu")) return this.close(), false;
					return true;
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
					return Boolean(this.$appendTo.contains(this.$));
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
					let body = this.$.querySelector(".menu-body");
					body.innerHTML = "";
					body.append(...(content instanceof Array ? content : [content]));
					return this;
				}
				setTitle(title) {
					this.title = title;
					this.$.querySelector(".menu-title").textContent = title;
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
					this.container = SAHYG.Components.toast.$container;
					this.element = SAHYG.createElement(
						"toast",
						{ type },
						SAHYG.createElement("span", { class: "content" }, message),
						SAHYG.createElement("div", { class: "close" }, "\uf00d").on("click", this.remove.bind(this))
					);

					this.element._toast = this;
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
				return SAHYG.oldCreateElement(
					"div",
					{ class: "user-tooltip" },
					data.avatarUrl == null
						? SAHYG.oldCreateElement("span", { class: "lafs avatar" }, "\uf007")
						: SAHYG.oldCreateElement("img", { src: data.avatarUrl, class: "avatar" }),
					SAHYG.oldCreateElement(
						"div",
						{ class: "infos" },
						SAHYG.oldCreateElement("span", { class: "username" }, data.username),
						SAHYG.oldCreateElement(
							"div",
							{ class: "icons" },
							data.certified ? SAHYG.oldCreateElement("span", { class: "lafs", style: "color: var(--green-700)" }, "\uf0a3") : null,
							data.group?.name == "owner"
								? SAHYG.oldCreateElement("span", { class: "lafs", style: "color: var(--yellow-600)" }, "\uf521")
								: null,
							data.group?.name == "administrator"
								? SAHYG.oldCreateElement("span", { class: "lafs", style: "color: var(--red-600)" }, "\uf7d9")
								: null,
							data.group?.name == "vip"
								? SAHYG.oldCreateElement("span", { class: "lafr", style: "color: var(--blue-600)" }, "\uf005")
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
						let menu = SAHYG.oldCreateElement("div", { class: "tooltip-menu" });
						for (let item of items) {
							if (item.type == "divider") menu.append(SAHYG.oldCreateElement("span", { class: "divider", ...(item.attributes || {}) }));
							else if (item.type == "button")
								menu.append(
									SAHYG.oldCreateElement(
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
										SAHYG.oldCreateElement("span", { class: "icon lafs" }, item.icon || ""),
										SAHYG.oldCreateElement("span", { class: "text" }, item.text)
									)
								);
							else if (item.type == "dropdown") {
								let dropdownTarget;
								menu.append(
									(dropdownTarget = SAHYG.oldCreateElement(
										"div",
										{ class: "item dropdown", ...(item.attributes || {}) },
										SAHYG.oldCreateElement("span", { class: "icon lafs" }, item.icon || ""),
										SAHYG.oldCreateElement("span", { class: "text" }, item.text),
										SAHYG.oldCreateElement("span", { class: "dropdown-icon lafs" }, "\uf105")
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
			replaceContent: function (element, loadingText = true) {
				let content = SAHYG.createNodeList(element.children).cloneNode(true);
				let loader = SAHYG.createElement("sahyg-loader", { "loading-text": String(loadingText) });
				SAHYG.createNodeList(element.children).remove();
				element.append(loader);

				loader.done = () => {
					SAHYG.createNodeList(element.children).remove();
					element.append(...content);
				};
				loader.replacedContent = content;

				return loader;
			},
			center: function (loadingText = true) {
				let loader = SAHYG.createElement("sahyg-loader", { class: "center", "loading-text": String(loadingText) });

				SAHYG.Components.loader.$popups.append(loader);

				return loader;
			},
		},
		headerMenu: {
			$menu: "header-menu",
			$menuIcon: "menu-icon",
			isOpened: function () {
				return SAHYG.Components.headerMenu.$menu.getAttribute("status") == "opened";
			},
			toggle: function () {
				if (SAHYG.Components.headerMenu.isOpened()) SAHYG.Components.headerMenu.close();
				else SAHYG.Components.headerMenu.open();
			},
			close: function () {
				SAHYG.Components.headerMenu.$menu.setAttribute("status", "closed");
				SAHYG.Components.headerMenu.$menuIcon.setAttribute("status", "closed");
			},
			open: function () {
				SAHYG.Components.headerMenu.$menu.setAttribute("status", "opened");
				SAHYG.Components.headerMenu.$menuIcon.setAttribute("status", "opened");
			},
		},
		headerAccount: {
			$menu: "header .account .menu",
			toggle: function (e) {
				e?.stopPropagation();
				if (!SAHYG.Components.headerAccount.$menu) return true;
				if (e.target.closest("header .account .menu")) return null;
				if (SAHYG.Components.headerAccount.isOpened()) return SAHYG.Components.headerAccount.close(), false;
				else return SAHYG.Components.headerAccount.open(), false;
			},
			open: function () {
				if (!SAHYG.Components.headerAccount.$menu) return true;
				SAHYG.Components.headerAccount.$menu.setAttribute("status", "opened");
				return false;
			},
			close: function () {
				if (!SAHYG.Components.headerAccount.$menu) return true;
				SAHYG.Components.headerAccount.$menu.setAttribute("status", "closed");
				return false;
			},
			outsideClose: function (e) {
				if (!SAHYG.Components.headerAccount.$menu) return true;
				if (SAHYG.Components.headerAccount.isOpened()) {
					if (e ? e.target.closest("header .account .menu") || e.target.closest("popups") : false) return true;
					e?.stopPropagation();
					SAHYG.Components.headerAccount.$menu.setAttribute("status", "closed");
					return false;
				} else return true;
			},
			isOpened: function () {
				if (!SAHYG.Components.headerAccount.$menu) return null;
				return SAHYG.Components.headerAccount.$menu.getAttribute("status") == "opened";
			},
		},
		input: {
			select: async function ({ options, defaultValue, events, placeholder }) {
				return SAHYG.oldCreateElement(
					"c-select",
					{
						events,
						placeholder: placeholder,
					},
					SAHYG.oldCreateElement("c-select-current", {}, options.find((option) => option.name == defaultValue)?.text),
					SAHYG.oldCreateElement(
						"c-select-options",
						{},
						...options.map(({ name, text, icon }) =>
							SAHYG.oldCreateElement(
								"c-select-option",
								{ "data-value": name },
								SAHYG.oldCreateElement("c-select-option-icon", {}), //TODO
								SAHYG.oldCreateElement("c-select-option-information", {}, SAHYG.oldCreateElement("c-select-option-title", {}, text))
							)
						)
					)
				);
			},
			boolean: async function ({ defaultValue, events }) {
				return SAHYG.oldCreateElement(
					"c-boolean",
					{ events, value: String(Boolean(defaultValue)) },
					SAHYG.oldCreateElement("c-boolean-circle")
				);
			},
			list: async function ({ defaultValue, events }) {
				// return SAHYG.oldCreateElement(
				// 	"sahyg-input-list",
				// 	{ on: events },
				// 	SAHYG.oldCreateElement(
				// 		"div",
				// 		{ class: "sahyg-input-list-values" },
				// 		defaultValue.map((value) =>
				// 			SAHYG.oldCreateElement(
				// 				"div",
				// 				{ class: "sahyg-input-list-value" },
				// 				SAHYG.oldCreateElement("div", { class: "sahyg-input-list-value-text" }, value),
				// 				SAHYG.oldCreateElement("sahyg-input-list-value-remove")
				// 			)
				// 		)
				// 	),
				// 	SAHYG.oldCreateElement("div", { class: "sahyg-input-list-add" })
				// );
				let values = SAHYG.oldCreateElement("sahyg-input-list-values", {});

				let newEntry = (value) => {
					let valueElement = SAHYG.oldCreateElement(
						"sahyg-input-list-value",
						{},
						SAHYG.oldCreateElement("sahyg-input-list-value-text", {}, value)
					);
					valueElement.append(SAHYG.oldCreateElement("sahyg-input-list-value-remove"));
					values.append(valueElement);
				};
				defaultValue.forEach(newEntry);

				return SAHYG.oldCreateElement("sahyg-input-list", { events }, values, SAHYG.oldCreateElement("sahyg-input-list-add"));
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

				input = SAHYG.oldCreateElement("input", {
					on,
					type: "color",
					value: defaultValue || "#000000",
				});
				return Object.assign(SAHYG.oldCreateElement("c-color-picker", {}, input), { input });
			},
			datetime: function ({ defaultValue } = {}) {
				return SAHYG.oldCreateElement("sahyg-datetime", {}, SAHYG.oldCreateElement("input", { type: "datetime-local" }));
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
				if (!(scrollContainer instanceof HTMLElement) || !(scrollContainer instanceof $))
					scrollContainer = SAHYG.Utils.scroll.$scrollContainer;

				scrollContainer.scrollTo({
					top: 0,
					behavior: "smooth",
				});
			},
			bottom(scrollContainer) {
				if (!(scrollContainer instanceof HTMLElement) || !(scrollContainer instanceof $))
					scrollContainer = SAHYG.Utils.scroll.$scrollContainer;
				scrollContainer.scrollTo({
					top: document.body.clientHeight + scrollContainer.offsetTop,
					behavior: "smooth",
				});
			},
			to(pos, scrollContainer) {
				if (!(scrollContainer instanceof HTMLElement) || !(scrollContainer instanceof $))
					scrollContainer = SAHYG.Utils.scroll.$scrollContainer;

				if (typeof pos === "string") pos = SAHYG.$0(`[id="${pos}"]`);

				if (pos)
					scrollContainer.scrollTo({
						top: pos.getBoundingClientRect().top + scrollContainer.scrollTop - scrollContainer.offsetTop,
						behavior: "smooth",
					});
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
				return /^[a-z](?:[-a-z0-9\+\.])*:(?:\/\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:\xA0-\ufD7FF\ufF900-\ufFDCF\ufFDF0-\ufFFEF]|[\ufD800-\ufD83E\ufD840-\ufD87E\ufD880-\ufD8BE\ufD8C0-\ufD8FE\ufD900-\ufD93E\ufD940-\ufD97E\ufD980-\ufD9BE\ufD9C0-\ufD9FE\ufDA00-\ufDA3E\ufDA40-\ufDA7E\ufDA80-\ufDABE\ufDAC0-\ufDAFE\ufDB00-\ufDB3E\ufDB44-\ufDB7E][\ufDC00-\ufDFFF]|[\ufD83F\ufD87F\ufD8BF\ufD8FF\ufD93F\ufD97F\ufD9BF\ufD9FF\ufDA3F\ufDA7F\ufDABF\ufDAFF\ufDB3F\ufDB7F][\ufDC00-\ufDFFD])*@)?(?:\[(?:(?:(?:[0-9a-f]{1,4}:){6}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|::(?:[0-9a-f]{1,4}:){5}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:[0-9a-f]{1,4}:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|v[0-9a-f]+[-a-z0-9\._~!\$&'\(\)\*\+,;=:]+)\]|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3}|(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=@\xA0-\ufD7FF\ufF900-\ufFDCF\ufFDF0-\ufFFEF]|[\ufD800-\ufD83E\ufD840-\ufD87E\ufD880-\ufD8BE\ufD8C0-\ufD8FE\ufD900-\ufD93E\ufD940-\ufD97E\ufD980-\ufD9BE\ufD9C0-\ufD9FE\ufDA00-\ufDA3E\ufDA40-\ufDA7E\ufDA80-\ufDABE\ufDAC0-\ufDAFE\ufDB00-\ufDB3E\ufDB44-\ufDB7E][\ufDC00-\ufDFFF]|[\ufD83F\ufD87F\ufD8BF\ufD8FF\ufD93F\ufD97F\ufD9BF\ufD9FF\ufDA3F\ufDA7F\ufDABF\ufDAFF\ufDB3F\ufDB7F][\ufDC00-\ufDFFD])*)(?::[0-9]*)?(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\ufD7FF\ufF900-\ufFDCF\ufFDF0-\ufFFEF]|[\ufD800-\ufD83E\ufD840-\ufD87E\ufD880-\ufD8BE\ufD8C0-\ufD8FE\ufD900-\ufD93E\ufD940-\ufD97E\ufD980-\ufD9BE\ufD9C0-\ufD9FE\ufDA00-\ufDA3E\ufDA40-\ufDA7E\ufDA80-\ufDABE\ufDAC0-\ufDAFE\ufDB00-\ufDB3E\ufDB44-\ufDB7E][\ufDC00-\ufDFFF]|[\ufD83F\ufD87F\ufD8BF\ufD8FF\ufD93F\ufD97F\ufD9BF\ufD9FF\ufDA3F\ufDA7F\ufDABF\ufDAFF\ufDB3F\ufDB7F][\ufDC00-\ufDFFD]))*)*|\/(?:(?:(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\ufD7FF\ufF900-\ufFDCF\ufFDF0-\ufFFEF]|[\ufD800-\ufD83E\ufD840-\ufD87E\ufD880-\ufD8BE\ufD8C0-\ufD8FE\ufD900-\ufD93E\ufD940-\ufD97E\ufD980-\ufD9BE\ufD9C0-\ufD9FE\ufDA00-\ufDA3E\ufDA40-\ufDA7E\ufDA80-\ufDABE\ufDAC0-\ufDAFE\ufDB00-\ufDB3E\ufDB44-\ufDB7E][\ufDC00-\ufDFFF]|[\ufD83F\ufD87F\ufD8BF\ufD8FF\ufD93F\ufD97F\ufD9BF\ufD9FF\ufDA3F\ufDA7F\ufDABF\ufDAFF\ufDB3F\ufDB7F][\ufDC00-\ufDFFD]))+)(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\ufD7FF\ufF900-\ufFDCF\ufFDF0-\ufFFEF]|[\ufD800-\ufD83E\ufD840-\ufD87E\ufD880-\ufD8BE\ufD8C0-\ufD8FE\ufD900-\ufD93E\ufD940-\ufD97E\ufD980-\ufD9BE\ufD9C0-\ufD9FE\ufDA00-\ufDA3E\ufDA40-\ufDA7E\ufDA80-\ufDABE\ufDAC0-\ufDAFE\ufDB00-\ufDB3E\ufDB44-\ufDB7E][\ufDC00-\ufDFFF]|[\ufD83F\ufD87F\ufD8BF\ufD8FF\ufD93F\ufD97F\ufD9BF\ufD9FF\ufDA3F\ufDA7F\ufDABF\ufDAFF\ufDB3F\ufDB7F][\ufDC00-\ufDFFD]))*)*)?|(?:(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\ufD7FF\ufF900-\ufFDCF\ufFDF0-\ufFFEF]|[\ufD800-\ufD83E\ufD840-\ufD87E\ufD880-\ufD8BE\ufD8C0-\ufD8FE\ufD900-\ufD93E\ufD940-\ufD97E\ufD980-\ufD9BE\ufD9C0-\ufD9FE\ufDA00-\ufDA3E\ufDA40-\ufDA7E\ufDA80-\ufDABE\ufDAC0-\ufDAFE\ufDB00-\ufDB3E\ufDB44-\ufDB7E][\ufDC00-\ufDFFF]|[\ufD83F\ufD87F\ufD8BF\ufD8FF\ufD93F\ufD97F\ufD9BF\ufD9FF\ufDA3F\ufDA7F\ufDABF\ufDAFF\ufDB3F\ufDB7F][\ufDC00-\ufDFFD]))+)(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\ufD7FF\ufF900-\ufFDCF\ufFDF0-\ufFFEF]|[\ufD800-\ufD83E\ufD840-\ufD87E\ufD880-\ufD8BE\ufD8C0-\ufD8FE\ufD900-\ufD93E\ufD940-\ufD97E\ufD980-\ufD9BE\ufD9C0-\ufD9FE\ufDA00-\ufDA3E\ufDA40-\ufDA7E\ufDA80-\ufDABE\ufDAC0-\ufDAFE\ufDB00-\ufDB3E\ufDB44-\ufDB7E][\ufDC00-\ufDFFF]|[\ufD83F\ufD87F\ufD8BF\ufD8FF\ufD93F\ufD97F\ufD9BF\ufD9FF\ufDA3F\ufDA7F\ufDABF\ufDAFF\ufDB3F\ufDB7F][\ufDC00-\ufDFFD]))*)*|(?!(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\xA0-\ufD7FF\ufF900-\ufFDCF\ufFDF0-\ufFFEF]|[\ufD800-\ufD83E\ufD840-\ufD87E\ufD880-\ufD8BE\ufD8C0-\ufD8FE\ufD900-\ufD93E\ufD940-\ufD97E\ufD980-\ufD9BE\ufD9C0-\ufD9FE\ufDA00-\ufDA3E\ufDA40-\ufDA7E\ufDA80-\ufDABE\ufDAC0-\ufDAFE\ufDB00-\ufDB3E\ufDB44-\ufDB7E][\ufDC00-\ufDFFF]|[\ufD83F\ufD87F\ufD8BF\ufD8FF\ufD93F\ufD97F\ufD9BF\ufD9FF\ufDA3F\ufDA7F\ufDABF\ufDAFF\ufDB3F\ufDB7F][\ufDC00-\ufDFFD])))(?:\?(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\/\?\xA0-\ufD7FF\ufE000-\ufFDCF\ufFDF0-\ufFFEF]|[\ufD800-\ufD83E\ufD840-\ufD87E\ufD880-\ufD8BE\ufD8C0-\ufD8FE\ufD900-\ufD93E\ufD940-\ufD97E\ufD980-\ufD9BE\ufD9C0-\ufD9FE\ufDA00-\ufDA3E\ufDA40-\ufDA7E\ufDA80-\ufDABE\ufDAC0-\ufDAFE\ufDB00-\ufDB3E\ufDB44-\ufDB7E\ufDB80-\ufDBBE\ufDBC0-\ufDBFE][\ufDC00-\ufDFFF]|[\ufD83F\ufD87F\ufD8BF\ufD8FF\ufD93F\ufD97F\ufD9BF\ufD9FF\ufDA3F\ufDA7F\ufDABF\ufDAFF\ufDB3F\ufDB7F\ufDBBF\ufDBFF][\ufDC00-\ufDFFD])*)?(?:\#(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~!\$&'\(\)\*\+,;=:@\/\?\xA0-\ufD7FF\ufF900-\ufFDCF\ufFDF0-\ufFFEF]|[\ufD800-\ufD83E\ufD840-\ufD87E\ufD880-\ufD8BE\ufD8C0-\ufD8FE\ufD900-\ufD93E\ufD940-\ufD97E\ufD980-\ufD9BE\ufD9C0-\ufD9FE\ufDA00-\ufDA3E\ufDA40-\ufDA7E\ufDA80-\ufDABE\ufDAC0-\ufDAFE\ufDB00-\ufDB3E\ufDB44-\ufDB7E][\ufDC00-\ufDFFF]|[\ufD83F\ufD87F\ufD8BF\ufD8FF\ufD93F\ufD97F\ufD9BF\ufD9FF\ufDA3F\ufDA7F\ufDABF\ufDAFF\ufDB3F\ufDB7F][\ufDC00-\ufDFFD])*)?$/i.test(
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
						SAHYG.oldCreateElement(
							"div",
							{},
							await SAHYG.translate("COOKIES_CONSENT"),
							SAHYG.oldCreateElement("br"),
							SAHYG.oldCreateElement(
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
					SAHYG.$0("html").setAttribute("theme", "dark");
					SAHYG.Utils.cookie.set("theme", "dark");
					if (save) SAHYG.Utils.settings.theme.save();
					return true;
				},
				setLight(save = true) {
					SAHYG.$0("html").setAttribute("theme", "light");
					SAHYG.Utils.cookie.set("theme", "light");
					if (save) SAHYG.Utils.settings.theme.save();
					return true;
				},
				set(theme, save = true) {
					if (theme == "light") SAHYG.Utils.settings.theme.setLight(save);
					else if (theme == "dark") SAHYG.Utils.settings.theme.setDark(save);
					else return false;
				},
				current() {
					return SAHYG.$0("html").getAttribute("theme");
				},
				async toggle() {
					if (SAHYG.Utils.settings.theme.current() == "dark") return SAHYG.Utils.settings.theme.setLight(), "light";
					else return SAHYG.Utils.settings.theme.setDark(), "dark";
				},
				async save() {
					if (SAHYG.Utils.user.isConnected())
						SAHYG.Components.toast.Toast.info({ message: await SAHYG.translate("CLICK_TO_SAVE") })
							.clicked(async function (event, btn) {
								btn.remove();
								SAHYG.Api.post("/settings", { theme: SAHYG.$0("html").getAttribute("theme") == "light" ? "light" : "dark" })
									.then(async () => SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("SAVED") }).show())
									.catch(async () =>
										SAHYG.Components.toast.Toast.error({
											message: await SAHYG.translate("ERROR_OCCURRED"),
										}).show()
									);
							})
							.show();
					else return SAHYG.$0("html").getAttribute("theme");
				},
			},
			locale: {
				async set(locale, reload = true, saveIfPossible = true) {
					SAHYG.Utils.cookie.set("locale", locale);
					if (saveIfPossible && SAHYG.Utils.user.isConnected()) {
						SAHYG.Api.post("/settings", { locale })
							.then(() => (reload ? location.reload() : null))
							.catch(console.error);
					} else if (reload) location.reload();
					return null;
				},
				is(locale) {
					return SAHYG.Utils.settings.locale.get().includes(locale);
				},
				get() {
					return SAHYG.Utils.cookie.get("locale");
				},
			},
		},
		user: {
			isConnected() {
				return SAHYG.$0("html").getAttribute("connected") == "";
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
				return SAHYG.$0("header .account > .username").textContent;
			},
		},
		element: {
			getDataAttribute(elem, name) {
				if (typeof elem == "string") elem = SAHYG.$0(elem);
				return elem.getAttribute("data-" + name);
			},
			resizeTextarea(target) {
				target.style.height = 0;

				let maxHeight = parseFloat(target.getStyle("max-height")) || 300;
				let minHeight = parseFloat(target.getStyle("min-height")) || 25;
				let bordersHeight =
					parseFloat(target.getStyle("border-top-width")) +
					parseFloat(target.getStyle("border-bottom-width")) +
					parseFloat(target.getStyle("padding-top")) +
					parseFloat(target.getStyle("padding-bottom"));
				let newHeight = Math.max(Math.min(target.scrollHeight, maxHeight), minHeight);

				target.style.height = newHeight - bordersHeight + "px";

				if (newHeight == maxHeight) target.style.overflowY = "scroll";
				else target.style.overflowY = "hidden";
			},
			parseHtml(string) {
				return new DOMParser().parseFromString(string, "text/html");
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
					SAHYG.oldCreateElement("input", {
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
						appendTo: SAHYG.$0("menus"),
						interactive: true,
						maxWidth: "none",
						onClickOutside(instance) {
							resolve(null);
						},
						onHidden(instance) {
							instance.destroy();
							eventsClick.forEach((e) => SAHYG.oldOff("click", e));
							eventsHover.forEach((e) => SAHYG.oldOff("mouseover", e));
							SAHYG.oldOff("click", eventTarget);
						},
						async onCreate(instance) {
							let body, nameContainer;
							let timeout;

							SAHYG.oldOnce("click", target, instance.hide);

							instance.setContent(
								SAHYG.oldCreateElement(
									"icon-picker",
									{},
									SAHYG.oldCreateElement(
										"div",
										{ class: "header" },
										SAHYG.oldCreateElement(
											"div",
											{ class: "search-bar" },
											SAHYG.oldCreateElement("input", {
												on: {
													input: async ({ target }) => {
														let search = async () => {
															let query = target.value;
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
									(body = SAHYG.oldCreateElement(
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
											return SAHYG.oldCreateElement(
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
									SAHYG.oldCreateElement(
										"div",
										{ class: "footer" },
										(nameContainer = SAHYG.oldCreateElement("div", { class: "icon-name" }))
									)
								).get(0)
							);
						},
					}).show();
				});
			},
			color(target, defaultColor) {
				return new Promise((resolve) => {
					tippy(target, {
						placement: "bottom",
						trigger: "manual",
						content: "",
						appendTo: SAHYG.popupsContainer,
						interactive: true,
						maxWidth: "none",
						showOnCreate: true,
						onClickOutside(instance) {
							resolve(null);
						},
						onHidden(instance) {
							instance.destroy();
						},
						async onCreate(instance) {
							let input;
							SAHYG.once("click", target, instance.hide);

							let picker = SAHYG.createElement(
								"color-picker",
								{},
								(input = SAHYG.createElement("sahyg-color", { value: defaultColor })),
								SAHYG.createElement("btn", { class: "btn-full" }, await SAHYG.translate("CONFIRM")).on("click", () => {
									instance.hide();
									resolve(input.value);
								})
							);
							instance.setContent(picker);
						},
					});
				});
			},
		},
		icons: {
			async getAll() {
				if (SAHYG.Cache.icons.length) return true;
				let icons = (await SAHYG.Api.getStatic("/line-awesome.json")) || [];
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
			askCropImage(img) {},
		},
		style: {
			objectToString(style) {
				return Object.entries(style)
					.map(([key, value]) => {
						if (typeof value == "string") return `${key}{${value}}`;
						else if (value instanceof Array) return `${key}{${value.join("\n")}}`;
						else
							return `${key}{${Object.entries(value)
								.map(([propertyName, propertyValue]) => {
									if (typeof propertyValue == "string")
										return `${SAHYG.Utils.style.replaceUpperCase(propertyName)}:${propertyValue};`;
									else
										return `${SAHYG.Utils.style.replaceUpperCase(propertyName)}{${Object.entries(propertyValue)
											.map(([k, v]) => `${k}:${v};`)
											.join("")}};`;
								})
								.join("")}}`;
					})
					.join("");
			},
			replaceUpperCase(string) {
				return string.replace(/[A-Z]/gm, (value) => "-" + value.toLowerCase());
			},
			replaceDashedLetter(string) {
				return string.replace(/-[a-z]/gim, (value) => value[1].toUpperCase());
			},
		},
		text: {
			kebabToCamel(text) {
				return text.replace(/(?<!^)-./gm, (match) => match[1].toUpperCase());
			},
			camelToKebab(text) {
				return text.replace(/(?<!^)\p{Lu}/gmu, (match) => "-" + match.toLowerCase());
			},
		},
		dialog: {
			showCustomDialog(content) {
				SAHYG.createElement("sahyg-dialog").setContent(content).show();
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
			return full ? res?.data : res?.data?.content;
		},
		async get(url, content, full) {
			let res = await SAHYG.Api._request("GET", url, content);
			return full ? res?.data : res?.data?.content;
		},
		async getStatic(url) {
			return (await SAHYG.Api._request("GET", url))?.data;
		},
	},
	RequestEvents: {
		async request(response) {
			if (response.data.success === false) {
				await SAHYG.RequestEvents.error(response.data?.description);
				return null;
			}
			return response;
		},
		async error(description) {
			SAHYG.Components.toast.Toast.danger({
				message: typeof description == "string" ? description : await SAHYG.translate("ERROR_OCCURRED"),
			}).show();
		},
	},
	CustomElements: {},
};

SAHYG.CustomElements.inputList = class InputList extends HTMLElement {
	connectedCallback() {
		this.defaultValues = JSON.parse(this.getAttribute("values")) || [];
		this.values = [];

		this.$values = SAHYG.createElement(
			"div",
			{
				class: "values",
			},
			...this.defaultValues.map((value) => {
				value = typeof value == "string" ? value : value.text || value.value;
				let id = value.id || Math.random().toString(32).substring(2, 10);
				this.values.push({ id, value });

				return SAHYG.createElement(
					"div",
					{ class: "value", id },
					SAHYG.createElement("div", { class: "text" }, value),
					SAHYG.createElement("div", { class: "remove", on: { click: this.removeValue.bind(this, id) } })
				);
			})
		);

		Array.from(this.children).forEach((child) => child.remove());
		this.append(this.$values, SAHYG.createElement("div", { class: "add", on: { click: this.addValue.bind(this) } }));

		this.setAttribute("tabindex", "1");
	}
	removeValue(id) {
		let removed = this.values.splice(
			this.values.findIndex((value) => value.id == id),
			1
		)?.[0];

		this.querySelector(`.value[id="${id}"]`).remove();

		this.dispatch(removed, "remove");
	}
	async addValue() {
		let value = await SAHYG.Utils.input.text({ title: await SAHYG.translate("ADD") });
		if (!value) return;
		let id = Math.random().toString(32).substring(2, 10);

		let added = { id, value };

		this.values.push(added);

		this.$values.append(
			SAHYG.createElement(
				"div",
				{ class: "value", id },
				SAHYG.createElement("div", { class: "text" }, value),
				SAHYG.createElement("div", { class: "remove", on: { click: this.removeValue.bind(this, id) } })
			)
		);

		this.dispatch(added, "add");
	}
	dispatch(change, type) {
		let changeEvent = new Event("change");
		let inputEvent = new Event("input");
		changeEvent.removed = inputEvent.removed = type == "remove" ? change : null;
		changeEvent.added = inputEvent.added = type == "add" ? change : null;
		changeEvent.values = inputEvent.values = this.values;
		this.dispatchEvent(changeEvent);
		this.dispatchEvent(inputEvent);
	}
};
SAHYG.CustomElements.inputArray = class InputArray extends HTMLElement {
	async connectedCallback() {
		this.columns = JSON.parse(this.getAttribute("columns")) || [];
		this.defaultValues = JSON.parse(this.getAttribute("values")) || [];
		this.value = this.values = JSON.parse(JSON.stringify(this.defaultValues));
		this.minWidth = this.getAttribute("min-width") || this.columns.length * 300 + "px";
		if (typeof this.minWidth === "number") this.minWidth = this.minWidth + "px";

		if (!this.columns.length) {
			this.clear();
			this.append(await SAHYG.translate("NO_COLUMNS"));
			return;
		}

		for (let column of this.columns) {
			column.name = await this.translate(column.name);
			column.placeholder = await this.translate(column.placeholder);
		}
		this.columnsFullWidth = this.columns.reduce((fullWidth, column) => fullWidth + (column.width || column.name.length), 0);
		this.columns.forEach((column) => (column.width = ((column.width || column.name.length) / this.columnsFullWidth) * 100));
		this.rows = this.values.map((value, index) => {
			return { id: Math.random().toString(32).substring(2, 10), index, values: value };
		});

		this.$header = SAHYG.createElement("div", { class: "header" }, ...(await Promise.all(this.columns.map(this.columnHeader.bind(this)))));
		this.$body = SAHYG.createElement("div", { class: "body", replacementText: await SAHYG.translate("NO_DATA_CLICK_TO_ADD") });
		this.$buttons = SAHYG.createElement(
			"div",
			{ class: "buttons" },
			SAHYG.createElement("sahyg-button", { iconBefore: String.fromCharCode(0xf067), class: "add" }, await SAHYG.translate("ADD")).on(
				"click",
				this.addRow.bind(this)
			),
			SAHYG.createElement("sahyg-button", { iconBefore: String.fromCharCode(0xf2ed), class: "clear" }, await SAHYG.translate("CLEAR")).on(
				"click",
				this.clearRows.bind(this)
			)
		);

		for (let row of this.rows) {
			this.$body.append(await this.row(row));
		}

		this.$arrayContainer = SAHYG.createElement("div", { class: "array-container" }, this.$header, this.$body);
		this.$body.style.minWidth = this.$header.style.minWidth = this.minWidth;
		this.append(this.$arrayContainer, this.$buttons);
	}
	async cellValue(column, row) {
		switch (column.type) {
			case "text": {
				let input = SAHYG.createElement("sahyg-textarea", {
					multiline: false,
					showCharacterCounter: true,
					placeholder: column.name,
					defaultValue: row.values[column.id] || "",
					borderBottom: false,
				}).on("input", this.textInputHandler.bind(this, column, row));

				if (column.validator) {
					try {
						let regex = new RegExp(column.validator);
						input.setValidator((text) => regex.test(text));
					} catch (e) {
						console.warn("Invalid regex validator");
					}
				}
				return input;
			}
		}
	}
	async columnHeader(column) {
		let columnHeader = SAHYG.createElement(
			"div",
			{ class: "column-header", columnId: column.id },
			SAHYG.createElement("span", { class: "column-name" }, column.name)
		);
		columnHeader.style.width = column.width + "%";
		return columnHeader;
	}
	async translate(text) {
		if (text.startsWith("i18n:")) return await SAHYG.translate(text.substring(5));
		return text;
	}
	textInputHandler(column, row, event) {
		event.stopPropagation();

		row.values[column.id] = event.target.value;
		this.values[row.index][column.id] = event.target.value;
		this.dispatchInput({ columnId: column.id, rowId: row.id, value: event.value, action: "edit" });
	}
	async row(row) {
		let $row = SAHYG.createElement("div", { class: "row" });
		for (let column of this.columns) {
			let $cell = SAHYG.createElement("div", { class: "cell", columnId: column.id }, await this.cellValue(column, row));
			$cell.style.width = column.width + "%";
			$row.append($cell);
		}
		return $row;
	}
	async addRow() {
		let row = {
			id: Math.random().toString(32).substring(2, 10),
			index: this.rows.length,
			values: Object.fromEntries(this.columns.map((column) => [column.id, this.emptyValue(column.type)])),
		};
		this.rows.push(row);
		this.values.push(row.values);
		this.$body.append(await this.row(row));
		this.dispatchInput({ rowId: row.id, action: "add" });
	}
	async clearRows() {
		this.rows = [];
		this.$body.clear();
		this.values = this.value = [];
		this.dispatchInput({ action: "clear" });
	}
	emptyValue(type) {
		return type === "text" ? "" : type === "switch" ? false : type === "select" || type === "selectOne" ? [] : null;
	}
	dispatchInput({ columnId, rowId, value, action } = {}) {
		let changeEvent = new Event("change");
		let inputEvent = new Event("input");

		changeEvent.editedColumn = inputEvent.editedColumn = columnId;
		changeEvent.editedRow = inputEvent.editedRow = rowId;
		changeEvent.newValue = inputEvent.newValue = value;
		changeEvent.action = inputEvent.action = action;

		this.dispatchEvent(changeEvent);
		this.dispatchEvent(inputEvent);
	}
};
SAHYG.CustomElements.select = class Select extends HTMLElement {
	static get observedAttributes() {
		return ["multiple", "selected", "options", "min-width-to-show-selected", "placeholder"];
	}
	async attributeChangedCallback(name, oldValue, newValue) {
		if (!this.loaded) return;

		switch (name) {
			case "multiple": {
				this.multiple = newValue === "true";
				if (!this.multiple) this.selected = this.selected.length ? [this.selected[0]] : [];

				await this.update$Options();
				this.update$Selected();
				break;
			}
			case "selected": {
				this.selected = JSON.parse(this.getAttribute("selected")) || [];
				if (typeof this.selected === "string") this.selected = [this.selected];

				await this.update$Selected();
				break;
			}
			case "options": {
				this.options = JSON.parse(this.getAttribute("options"));
				if (this.options instanceof Array)
					this.options = this.options.map((option) => {
						if (option?.name) option.id = option.name;
						if (option?.text) option.value = option.text;
						if (option?.id && option?.value) return option;
						return { id: Math.random().toString(32).substring(2, 10), value: String(option) };
					});
				else
					this.options = Object.entries(this.options).map(([id, value]) => {
						return { id, value };
					});

				await this.update$Options();
				break;
			}
			case "min-width-to-show-selected": {
				this.minWidthSelected = Number(newValue);
				break;
			}
			case "placeholder": {
				this.placeholder = newValue || (await SAHYG.translate("SELECT"));
				this.$selected.setAttribute("data-placeholder", this.placeholder);
				break;
			}
			case "placeholder": {
				this.label = newValue || "";
				this.$selected.setAttribute("data-label", this.label);
				break;
			}
		}
	}
	async connectedCallback() {
		this.options = JSON.parse(this.getAttribute("options") || "[]");
		if (this.options instanceof Array)
			this.options = this.options.map((option) => {
				if (option?.name) option.id = option.name;
				if (option?.text) option.value = option.text;
				if (option?.id && option?.value) return option;
				return { id: Math.random().toString(32).substring(2, 10), value: String(option) };
			});
		else
			this.options = Object.entries(this.options).map(([id, value]) => {
				return { id, value };
			});

		this.selected = JSON.parse(this.getAttribute("selected")) || [];
		if (typeof this.selected === "string") this.selected = [this.selected];

		this.multiple = this.getAttribute("multiple") === "true";
		this.search = this.getAttribute("search") === "true";
		this.minWidthSelected = Number(this.getAttribute("min-width-to-show-selected"));
		this.placeholder = this.getAttribute("placeholder") || (await SAHYG.translate("SELECT"));
		this.label = this.getAttribute("label") || false;

		this.$selected = SAHYG.createElement(
			"div",
			{
				class: "selected",
				on: { click: this.open.bind(this) },
				"data-placeholder": this.placeholder,
			},
			this.search
				? (this.$textarea = SAHYG.createElement("sahyg-textarea", {}).setValidator((value) => {
						let options = this.options.filter(
							(option) =>
								option.value.toLowerCase().includes(value.toLowerCase()) || option.id.toLowerCase().includes(value.toLowerCase())
						);
						this.update$Options(options);
						if (options.length == 0) return false;
						return true;
				  }))
				: null
		);
		if (this.label) this.$selected.setAttribute("data-label", this.label);

		this.tippy = tippy(this, {
			content: "",
			trigger: "click",
			interactive: true,
			placement: "bottom",
			arrow: false,
			duration: 200,
			appendTo: this,
			hideOnClick: false,
			allowHTML: true,
			onClickOutside: (instance, event) => {
				instance.hide();
			},
			onHidden: () => {
				this.removeAttribute("opened");
				this.$textarea?.clear({ focus: false });
			},
			popperOptions: {
				modifiers: [
					{
						name: "flip",
						options: {
							fallbackPlacements: ["bottom", "top"],
						},
					},
				],
			},
		});

		await this.update$Options();
		await this.update$Selected();

		this.append(this.$selected);

		this.addEventListener("input", (e) => {
			if (this.$textarea?.contains(e.target)) return e.stopPropagation(), false;
			return true;
		});
		this.addEventListener("change", (e) => {
			if (this.$textarea?.contains(e.target)) return e.stopPropagation(), false;
			return true;
		});
		window.addEventListener("resize", (e) => {
			if (!this.minWidthSelected) return;
			if (document.body.clientWidth < this.minWidthSelected) this.classList.add("selected-hidden");
			else this.classList.remove("selected-hidden");
		});
		if (this.minWidthSelected) {
			if (document.body.clientWidth < this.minWidthSelected) this.classList.add("selected-hidden");
			else this.classList.remove("selected-hidden");
		}

		this.loaded = true;
		this.setAttribute("tabindex", "1");
	}
	async open({ target }) {
		if (target.closest("sahyg-textarea") && this.getAttribute("aria-expanded") == "true") return;
		await this.update$Options();
		this.tippy.setProps({ maxWidth: this.clientWidth });
	}
	async update$Options(options) {
		this.$options = SAHYG.createElement(
			"div",
			{
				class: "options",
			},
			...(options || this.options || []).map((option) =>
				SAHYG.createElement(
					"div",
					{
						class: "option",
						id: option.id,
						on: { click: this.select.bind(this, option.id) },
						selected: this.selected.includes(option.id),
					},
					SAHYG.createElement("div", { class: "select-icon" }),
					SAHYG.createElement("div", { class: "text" }, option.value)
				)
			)
		);
		this.tippy.setContent(this.$options);
	}
	async select(id) {
		let option = this.options.find((option) => option.id == id);
		if (!option) return;

		if (!this.multiple) {
			if (this.selected.includes(id)) this.selected = [];
			else this.selected = [id];
		} else if (this.selected.includes(id))
			this.selected.splice(
				this.selected.findIndex((optionId) => optionId == id),
				1
			);
		else this.selected.push(id);

		if (!this.multiple)
			Array.from(this.querySelectorAll(`[data-tippy-root] .option:not([id="${id}"])`)).forEach((elem) =>
				elem.setAttribute("selected", "false")
			);
		this.querySelector(`[data-tippy-root] .option[id="${id}"]`)?.setAttribute("selected", String(this.selected.includes(id)));
		await this.update$Selected();

		this.dispatch(id, this.selected.includes(id) ? "add" : "remove");
	}
	async update$Selected() {
		Array.from(this.$selected.children).forEach((child) => (child.nodeName != "SAHYG-TEXTAREA" ? child.remove() : null));

		this.$selected.prepend(
			...this.selected.map((id) => SAHYG.createElement("div", { id }, this.options.find((option) => option.id == id)?.value))
		);
	}
	dispatch(change, type) {
		let changeEvent = new Event("change");
		let inputEvent = new Event("input");
		changeEvent.removed = inputEvent.removed = type == "remove" ? change : null;
		changeEvent.added = inputEvent.added = type == "add" ? change : null;
		changeEvent.selected = inputEvent.selected = this.selected;
		this.dispatchEvent(changeEvent);
		this.dispatchEvent(inputEvent);
	}
};
SAHYG.CustomElements.textarea = class Textarea extends HTMLElement {
	validator = () => true;
	value = null;
	static get observedAttributes() {
		return [
			"multiline",
			"dynamic-height",
			"max-length",
			"min-length",
			"character-counter",
			"placeholder",
			"default-value",
			"max-height",
			"min-height",
			"border-bottom",
			"resize",
		];
	}
	attributeChangedCallback(name, oldValue, newValue) {
		this.updateAttributes();

		if (!this.$textarea) return;

		if (name == "placeholder") this.$textarea.setAttribute("placeholder", newValue);
		else if (name == "default-value" && (oldValue == this.$textarea.value || this.$textarea.value == "")) {
			this.$textarea.innerText = newValue;
			this.$counterValue.innerText == newValue.length;
		} else if (name == "min-height") this.$textarea.style.minHeight = newValue;
		else if (name == "max-height") this.$textarea.style.maxHeight = newValue;
		else if (name == "resize") this.$textarea.style.resize = newValue;
	}
	updateAttributes() {
		this.multiline = this.getAttribute("multiline") === "true";
		this.dynamicHeight = this.getAttribute("dynamic-height") === "true";
		this.showCharacterCounter = this.getAttribute("character-counter") === "true";
		this.maxLength = Number(this.getAttribute("max-length")) || null;
		this.minLength = Number(this.getAttribute("min-length")) || null;
		this.placeholder = this.getAttribute("placeholder") || "";
		this.defaultValue = this.getAttribute("default-value") || "";
		this.maxHeight = this.getAttribute("max-height");
		this.minHeight = this.getAttribute("min-height");
		this.borderBottom = this.getAttribute("border-bottom") === "true";
		this.clearIcon = this.getAttribute("clear-icon") === "true";
		this.resize = this.getAttribute("resize") || "none";
	}
	connectedCallback() {
		if (!this.id) this.id = Math.random().toString(32).substring(2, 10);

		this.updateAttributes();

		this.addEventListener("keydown", (e) => {
			if (e.key == "Enter" && !this.multiline) {
				e.preventDefault();
			}
			return false;
		});
		this.addEventListener("input", () => {
			if (this.dynamicHeight) SAHYG.Utils.element.resizeTextarea(this.$textarea);

			this.value = this.$textarea.value;

			if (typeof this.validator == "function") {
				if (
					this.validator(this.$textarea.value) &&
					(typeof this.maxLength == "number" ? this.maxLength >= this.$textarea.value.length : true) &&
					(typeof this.minLength == "number" ? this.minLength <= this.$textarea.value.length : true)
				) {
					this.classList.remove("invalid");
				} else {
					this.classList.add("invalid");
				}
			} else if (typeof this.maxLength == "number") {
				if (this.maxLength < this.$textarea.value.length) {
					this.classList.add("invalid");
				} else {
					this.classList.remove("invalid");
				}
			}

			if (this.showCharacterCounter) this.$counterValue.innerText = this.$textarea.value.length;
		});
		this.addEventListener("focusin", (e) => {
			if (this.$textarea.contains(e.target)) return;
			e.stopPropagation();
			e.preventDefault();
			this.$textarea.focus();
		});

		this.append(
			SAHYG.createElement(
				"div",
				{ class: "textarea-container" },
				(this.$textarea = SAHYG.createElement("textarea", { placeholder: this.placeholder }, this.defaultValue)),
				this.clearIcon ? SAHYG.createElement("div", { class: "clear-icon", on: { click: this.clear.bind(this) } }) : null
			)
		);
		if (this.maxHeight) this.$textarea.style.maxHeight = typeof Number(this.maxHeight) ? this.maxHeight + "px" : this.maxHeight;
		if (this.minHeight) this.$textarea.style.minHeight = typeof Number(this.minHeight) ? this.minHeight + "px" : this.minHeight;
		if (this.resize) this.$textarea.style.resize = this.resize;

		if (typeof this.maxLength == "string" || this.showCharacterCounter === true || this.borderBottom)
			this.append(
				SAHYG.createElement(
					"div",
					{ class: "bottom" },
					this.borderBottom ? (this.$borderBottom = SAHYG.createElement("span", { class: "border-bottom" })) : null,
					this.showCharacterCounter === true
						? SAHYG.createElement(
								"span",
								{ class: "character-counter" },
								(this.$counterValue = SAHYG.createElement(
									"span",
									{ class: "character-counter-value" },
									this.defaultValue?.length || "0"
								)),
								typeof this.maxLength == "number" ? " / " : null,
								typeof this.maxLength == "number"
									? SAHYG.createElement("span", { class: "character-counter-max" }, this.maxLength)
									: null
						  )
						: null
				)
			);

		this.setAttribute("tabindex", "1");
	}
	setValidator(validator) {
		if (!validator) return this;

		if (validator instanceof RegExp) validator = ((validator, val) => validator.test(val)).bind(null, validator);

		if (typeof validator !== "function") return this;

		this.validator = validator;
		return this;
	}
	clear({ focus = true } = {}) {
		this.$textarea.value = "";
		this.dispatch();
		if (focus) this.$textarea.focus();
	}
	dispatch() {
		let changeEvent = new Event("change");
		let inputEvent = new Event("input");
		changeEvent.value = inputEvent.value = this.$textarea.value;
		this.dispatchEvent(changeEvent);
		this.dispatchEvent(inputEvent);
	}
};
SAHYG.CustomElements.loader = class Loader extends HTMLElement {
	static get observedAttributes() {
		return ["loader-height", "loader-width"];
	}
	attributeChangedCallback() {
		if (!this.shadowRoot) return;
		this.shadowRoot.setStyle({
			svg: {
				width: this.getAttribute("loader-width") || "3rem",
				height: this.getAttribute("loader-height") || "3rem",
			},
		});
	}
	async connectedCallback() {
		this.openShadow();

		this.shadowRoot.setStyle({
			"@keyframes svg-loader": {
				"100%": {
					transform: "rotate(360deg)",
				},
			},
			":host": {
				display: "flex",
				MsFlexDirection: "column",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				height: "100%",
				width: "100%",
			},
			svg: {
				maxHeight: "100%",
				maxWidth: "100%",
				minWidth: "2rem",
				minHeight: "2rem",
				display: "block",
			},
			circle: {
				fill: "none",
				strokeWidth: "3.5",
				transformOrigin: "170px 170px",
				willChange: "transform",
				animation: "svg-loader normal 1.5s infinite cubic-bezier(0.81, 0.35, 0.21, 0.68)",
			},
			"circle:nth-of-type(1)": {
				strokeDasharray: "550px",
				WebkitAnimationDelay: "-0.15s",
				animationDelay: "-0.15s",
			},
			"circle:nth-of-type(2)": {
				strokeDasharray: "500px",
				WebkitAnimationDelay: "-0.3s",
				animationDelay: "-0.3s",
			},
			"circle:nth-of-type(3)": {
				strokeDasharray: "450px",
				WebkitAnimationDelay: "-0.45s",
				animationDelay: "-0.45s",
			},
			"circle:nth-of-type(4)": {
				strokeDasharray: "300px",
				WebkitAnimationDelay: "-0.6s",
				animationDelay: "-0.6s",
			},
			".status": {
				marginTop: "1rem",
				WebkitUserSelect: "none",
				MozUserSelect: "none",
				MsUserSelect: "none",
				userSelect: "none",
			},
			":host(.center)": {
				backgroundColor: "rgb(0 0 0 / 60%)",
				position: "fixed!important",
				top: "0",
				left: "0",
				width: "100%",
				height: "100%",
				color: "var(--base-white)",
			},
			":host(.center) .svg-loader": {
				width: "10vw",
				height: "10vh",
				color: "var(--base-white)",
			},
		});
		this.shadowRoot.setStyle({
			svg: {
				width: this.getAttribute("loader-width") || "3rem",
				height: this.getAttribute("loader-height") || "3rem",
			},
		});

		this.shadowRoot.append(
			SAHYG.createElement(
				"div",
				{ class: "svg-container" },
				SAHYG.html(
					'<svg class="svg-loader" viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg"><circle cx="170" cy="170" r="160" stroke="currentcolor"></circle><circle cx="170" cy="170" r="135" stroke="var(--color-primary-text)"></circle><circle cx="170" cy="170" r="110" stroke="currentcolor"></circle><circle cx="170" cy="170" r="85" stroke="var(--color-primary-text)"></circle></svg>'
				)
			),
			this.getAttribute("loading-text") === "true" ? SAHYG.createElement("div", { class: "status" }, await SAHYG.translate("LOADING")) : null
		);
	}
};
SAHYG.CustomElements.color = class Color extends HTMLElement {
	connectedCallback() {
		this.openShadow();

		this.$input = SAHYG.createElement("input", {
			type: "color",
			value: this.getAttribute("value") || this.getAttribute("defaultValue"),
		}).on("input", () => {
			this.value = this.$input.value;
			this.setAttribute("value", this.$input.value);
		});

		this.shadowRoot.setStyle(
			(this.style = {
				":host": {
					width: "-moz-fit-content",
					width: "fit-content",
					borderRadius: "0.5rem",
					backgroundColor: "transparent",
					border: "2px solid var(--divider-color)",
				},
				input: {
					appearance: "none",
					background: "transparent",
					border: "none",
					height: "3rem",
					width: "auto",
					cursor: "pointer",
					borderRadius: "1rem",
					display: "-ms-grid",
					display: "grid",
					alignItems: "center",
					padding: "0.5rem",
					MsGridColumns: "1fr 0fr",
					gridTemplateColumns: "1fr 0fr",
					columnGap: "0.5rem",
				},
				"input:before": {
					content: "attr(value)",
					fontFamily: "var(--font-code)",
					fontSize: "1rem",
					fontWeight: "bold",
					letterSpacing: "1px",
				},
				"input::-webkit-color-swatch": {
					borderRadius: "0.5rem",
					border: "none",
					width: "2rem",
					height: "1.5rem",
				},
			})
		);
		this.shadowRoot.append(this.$input);
	}
};
SAHYG.CustomElements.tabs = class Tabs extends HTMLElement {
	connectedCallback() {
		this.tabs = JSON.parse(this.getAttribute("tabs")) || [];
		this.default = this.getAttribute("default");
		this.currentOpened = SAHYG.Utils.url.getParams()?.[this.id] || this.default;

		this.$tabsIcon = SAHYG.createElement("div", { class: "tabs-icon" }).on("click", this.toggleMenu.bind(this));
		this.$tabs = SAHYG.createElement(
			"div",
			{ class: "tabs-container" },
			SAHYG.createElement(
				"div",
				{ class: "tabs" },
				this.tabs.map((tab) =>
					SAHYG.createElement("div", { class: "tab" + (this.currentOpened == tab.id ? " opened" : ""), "tab-id": tab.id }, tab.text).on(
						"click",
						this.open.bind(this, tab.id)
					)
				)
			)
		);
		this.waitLoaded('[sahyg-tab="' + this.currentOpened + '"]').then((target) => target.addClass("opened"));

		this.append(this.$tabsIcon, this.$tabs);
	}
	toggleMenu() {
		if (this.hasClass("opened")) this.closeMenu();
		else this.openMenu();
	}
	closeMenu() {
		this.removeClass("opened");
	}
	openMenu() {
		this.addClass("opened");
	}
	open(id) {
		if (this.currentOpened == id) return;

		this.$tabs.$("[tab-id].opened").removeClass("opened");
		this.$tabs.$0(`[tab-id="${id}"]`)?.addClass("opened");

		this.$("[sahyg-tab]").removeClass("opened");
		this.$0(`[sahyg-tab="${id}"]`)?.addClass("opened");

		this.currentOpened = id;
		if (this.id) SAHYG.Utils.url.setLocationParam(this.id, id);

		this.closeMenu();
	}
};
SAHYG.CustomElements.cropper = class Cropper extends HTMLElement {
	connectedCallback() {
		this.openShadow();

		this.url = this.getAttribute("url") || "";
		this.minWidth = Number(this.getAttribute("minWidth") || 50);

		this.$overlay = SAHYG.createElement(
			"div",
			{ class: "overlay" },
			(this.$overlayImage = SAHYG.createElement("img", { src: this.url, draggable: false, crossorigin: "anonymous" }))
		)
			.on("mousedown", this.startMove.bind(this))
			.on("mouseup", () => (this.onPinch = this.onDrag = false))
			.on("touchstart", this.startMove.bind(this))
			.on("touchend", () => (this.onPinch = this.onDrag = false));
		this.$image = SAHYG.createElement("img", { src: this.url, draggable: false, crossorigin: "anonymous" });

		this.shadowRoot.setStyle({
			".overlay": {
				position: "absolute",
				"z-index": "999",
				// "margin-left": "calc(-25% + 3px)",
				// "margin-top": "calc(-25% + 3px)",
				border: "3px var(--color-text) solid",
				overflow: "hidden",
				"box-sizing": "content-box",
				"-webkit-user-select": "none",
				"-moz-user-select": "none",
				"-ms-user-select": "none",
				"user-select": "none",
				cursor: "move",
			},
			".overlay > img": {
				display: "block",
				"object-fit": "contain",
				"object-position": "center",
				position: "absolute",
			},
			".container > img": {
				display: " block",
				position: " relative",
				"pointer-events": " none",
				height: " auto",
				width: " 100%",
				"object-fit": " contain",
				"object-position": " center",
				"-webkit-filter": "blur(8px) sepia(0.2)",
				filter: "blur(8px) sepia(0.2)",
			},
			".container": {
				border: "var(--color-text) 3px solid",
				overflow: "hidden",
			},
		});

		this.shadowRoot.append(
			(this.$container = SAHYG.createElement("div", { class: "container" }, this.$overlay, this.$image)
				.on("mousemove", this.moveOverlay.bind(this))
				.on("touchmove", this.moveOverlay.bind(this))
				.on("wheel", this.resizeHandler.bind(this)))
		);

		if (this.$image.complete) this.updateSize();
		else this.$image.on("load", this.updateSize.bind(this));
	}
	updateSize() {
		this.ratio = this.getAttribute("ratio");
		if (typeof this.ratio === "string") {
			this.ratio = this.ratio.split(":");
			this.ratio = Number(this.ratio[1]) / Number(this.ratio[0]);
		}
		if (!(typeof this.ratio === "number") || !this.ratio) this.ratio = this.$image.height / this.$image.width;

		this.$overlay.style.width = this.$image.width / 2 + "px";
		this.$overlay.style.height = (this.ratio * this.$image.width) / 2 + "px";
		this.$overlay.style.left = this.$image.width / 2 - this.$overlay.clientWidth / 2 + "px";
		this.$overlay.style.top = this.$image.height / 2 - this.$overlay.clientHeight / 2 + "px";

		this.$overlayImage.style.width = this.$image.width + "px";
		this.$overlayImage.style.left = -this.$image.width / 2 + this.$overlay.clientWidth / 2 + "px";
		this.$overlayImage.style.top = -this.$image.height / 2 + this.$overlay.clientHeight / 2 + "px";
	}
	resizeHandler(e) {
		this.resize((e.deltaY > 0 ? 1 : -1) * 6);
	}
	pinchToZoom(event) {
		if (this.onPinch)
			return this.resize(
				(this.pinchWidth >
				(this.pinchWidth = Math.hypot(event.touches[0].pageX - event.touches[1].pageX, event.touches[0].pageY - event.touches[1].pageY))
					? -1
					: 1) * 6
			);

		this.onPinch = true;
		this.pinchWidth = Math.hypot(event.touches[0].pageX - event.touches[1].pageX, event.touches[0].pageY - event.touches[1].pageY);
	}
	resize(delta) {
		let imageBoundingRect = this.$image.getBoundingClientRect();

		let width = this.$overlay.clientWidth + delta;
		let height = (this.$overlay.clientHeight / this.$overlay.clientWidth) * width;

		if (width < this.minWidth) return;
		if (height < this.minHeight) return;
		if (this.$overlay.offsetLeft - delta / 2 < 0) return;
		if (this.$overlay.offsetTop - delta / 2 < 0) return;
		if (this.$overlay.offsetLeft + width - delta / 2 > imageBoundingRect.width) return;
		if (this.$overlay.offsetTop + height - delta / 2 > imageBoundingRect.height) return;

		this.$overlayImage.style.left = this.$overlayImage.offsetLeft + delta / 2 + "px";
		this.$overlayImage.style.top = this.$overlayImage.offsetTop + delta / 2 + "px";

		this.$overlay.style.left = this.$overlay.offsetLeft - delta / 2 + "px";
		this.$overlay.style.top = this.$overlay.offsetTop - delta / 2 + "px";

		this.$overlay.style.height = height + "px";
		this.$overlay.style.width = width + "px";
	}
	startMove(event) {
		event.preventDefault();
		event.stopPropagation();

		if (event.touches?.length > 1) {
			this.onDrag = false;
			return this.pinchToZoom(event);
		}

		this.onDrag = true;

		this.startMovePosition = {
			x: event.clientX || event.pageX || (event.touches && event.touches[0].clientX),
			y: event.clientY || event.pageY || (event.touches && event.touches[0].clientY),
			overlayLeft: this.$overlay.offsetLeft,
			overlayTop: this.$overlay.offsetTop,
		};

		if (event.type === "mousedown")
			document.body.once("mouseup", () => {
				this.onDrag = false;
				this.dragType = "mouse";
			});
		else
			document.body.once("touchend", () => {
				this.onDrag = false;
				this.dragType = "touch";
			});
	}
	moveOverlay(event) {
		if (event.touches?.length > 1) {
			this.onDrag = false;
			return this.pinchToZoom(event);
		}

		if (!this.onDrag) return;

		let mouseX = event.clientX || event.pageX || (event.touches && event.touches[0].clientX),
			mouseY = event.clientY || event.pageY || (event.touches && event.touches[0].clientY);

		let moveLeft = mouseX - this.startMovePosition.x,
			moveTop = mouseY - this.startMovePosition.y;

		let containerBoundingRect = this.$container.getBoundingClientRect(),
			overlayBoundingRect = this.$overlay.getBoundingClientRect();

		if (this.startMovePosition.overlayLeft + moveLeft < 0) moveLeft = -this.startMovePosition.overlayLeft;
		if (this.startMovePosition.overlayTop + moveTop < 0) moveTop = -this.startMovePosition.overlayTop;
		if (this.startMovePosition.overlayLeft + moveLeft > containerBoundingRect.width - overlayBoundingRect.width)
			moveLeft = containerBoundingRect.width - overlayBoundingRect.width - this.startMovePosition.overlayLeft;
		if (this.startMovePosition.overlayTop + moveTop > containerBoundingRect.height - overlayBoundingRect.height)
			moveTop = containerBoundingRect.height - overlayBoundingRect.height - this.startMovePosition.overlayTop;

		this.$overlay.style.left = this.startMovePosition.overlayLeft + moveLeft + "px";
		this.$overlay.style.top = this.startMovePosition.overlayTop + moveTop + "px";

		this.$overlayImage.style.left = -(this.startMovePosition.overlayLeft + moveLeft) + "px";
		this.$overlayImage.style.top = -(this.startMovePosition.overlayTop + moveTop) + "px";
	}
	crop() {
		let canvas = SAHYG.createElement("canvas", { width: this.$overlay.clientWidth, height: this.$overlay.clientHeight });
		let ctx = canvas.getContext("2d");
		ctx.drawImage(
			this.$overlayImage,
			-this.$overlay.offsetLeft,
			-this.$overlay.offsetTop,
			this.$overlayImage.clientWidth,
			this.$overlayImage.clientHeight
		);

		try {
			return canvas.toDataURL("image/png", 1.0);
		} catch (e) {
			return null;
		}
	}
	close() {
		document.body.off("keypress", this.keyHandler.bind(this));
	}
};
SAHYG.CustomElements.dialog = class Dialog extends HTMLElement {
	buttons = [];
	constructor() {
		super();

		this.$backdrop = SAHYG.createElement("sahyg-backdrop").on("click", this.close.bind(this));
		this.$dialog = SAHYG.createElement(
			"div",
			{ class: "dialog" },
			(this.$header = SAHYG.createElement("div", { class: "header" })),
			(this.$body = SAHYG.createElement("div", { class: "body" })),
			(this.$footer = SAHYG.createElement("div", { class: "footer" }))
		);
	}
	async connectedCallback() {
		this.content = this.getAttribute("content");

		await this.preConnectedCallback();

		if (!this.displayed) return void this.remove();

		if (!this.buttons.length) await this.generateDefaultButtons();
		if (!this.content) this.$body.text((this.content = this.getAttribute("content") || ""));
		if (!this.title) this.$header.text((this.title = this.getAttribute("title") || (await SAHYG.translate("INFORMATION"))));

		this.append(this.$backdrop, this.$dialog);
	}
	async preConnectedCallback() {}
	async generateDefaultButtons() {
		this.buttons = [];
		this.addButton({
			text: await SAHYG.translate("OK"),
			style: "full",
		});
		this.updateButton();
		return this;
	}
	setContent(content) {
		this.content = content;
		this.$body.clear();
		this.$body.append(content);
		return this;
	}
	addContent(content) {
		if (!(this.content instanceof Array)) this.content = [this.content, content];
		else this.content.push(content);

		this.$body.append(content);
		return this;
	}
	setTitle(title) {
		this.title = title;
		this.$header.text(title);
		return this;
	}
	show() {
		this.displayed = true;
		document.body.append(this);
		return this;
	}
	close() {
		this.remove();
		this.displayed = false;
		return this;
	}
	addButton({ text, style = "", callback = () => {}, position, closeOnClick = true }) {
		let boundCallback = async function (event) {
			await callback.call(null, event);
			if (closeOnClick) this.close();
		}.bind(this);

		let button = {
			style,
			text,
			callback: boundCallback,
			position,
			closeOnClick,
			$: SAHYG.createElement("input", { type: "button", value: text, class: style }).on("click", boundCallback),
		};
		if (position instanceof Number) this.buttons.splice(position, 0, button);
		else this.buttons.push(button);

		this.updateButton();

		return this;
	}
	updateButton() {
		this.$footer.clear();

		this.buttons.forEach((button) => {
			this.$footer.prepend(button.$);
		});

		return this;
	}
};
SAHYG.CustomElements.confirmDialog = class ConfirmDialog extends SAHYG.CustomElements.dialog {
	extends = "sahyg-dialog";
	constructor() {
		super();
	}
	async preConnectedCallback() {
		this.setTitle(await SAHYG.translate("CONFIRM"));
		this.addButton({
			text: await SAHYG.translate("CONFIRM"),
			style: "full",
			callback: this.confirm.bind(this),
		}).addButton({
			text: await SAHYG.translate("CANCEL"),
			callback: this.cancel.bind(this),
		});
	}
	toPromise() {
		return new Promise((resolve, reject) => (this.promise = { resolve, reject }));
	}
	confirm() {
		if (this.promise) this.promise.resolve(true);
		if (this.callback) this.callback.call(null, true);
		return this;
	}
	cancel() {
		if (this.promise) this.promise.resolve(false);
		if (this.callback) this.callback.call(null, false);
		return this;
	}
	setCallback(callback) {
		if (callback instanceof Function) this.callback = callback;
		return this;
	}
};
SAHYG.CustomElements.cropperDialog = class CropperDialog extends SAHYG.CustomElements.dialog {
	extends = "sahyg-dialog";
	constructor() {
		super();
	}
	async preConnectedCallback() {
		this.imgURL = this.getAttribute("image");
		this.ratio = this.getAttribute("ratio");

		if (!this.imgURL) throw new Error("Image URL not specified");

		this.cropper = SAHYG.createElement("sahyg-cropper", { url: this.imgURL, ratio: this.ratio });

		this.setTitle(await SAHYG.translate("CROP"))
			.addButton({ text: await SAHYG.translate("SUBMIT"), style: "full", callback: this.valid.bind(this) })
			.addButton({
				text: await SAHYG.translate("CANCEL"),
				callback: this.cancel.bind(this),
			})
			.setContent(this.cropper);
	}
	toPromise() {
		return new Promise((resolve, reject) => (this.promise = { resolve, reject }));
	}
	valid() {
		let imgURL = this.cropper.crop();
		if (!imgURL) return this.cancel();

		if (this.promise) this.promise.resolve(imgURL);
		if (this.callback) this.callback.call(null, imgURL);
		return this;
	}
	cancel() {
		if (this.promise) this.promise.resolve(null);
		if (this.callback) this.callback.call(null, null);
		return this;
	}
	setCallback(callback) {
		if (callback instanceof Function) this.callback = callback;
		return this;
	}
};

SAHYG.Api.domain = SAHYG.Constants.api_domain;
axios.interceptors.response.use(SAHYG.RequestEvents.request, SAHYG.RequestEvents.error);
Object.entries(SAHYG.CustomElements).forEach(([name, element]) =>
	customElements.define("sahyg-" + SAHYG.Utils.text.camelToKebab(name), element, { extends: element.extends })
);

HTMLElement.prototype.on = function () {
	SAHYG.onThis.call(this, ...arguments);
	return this;
};
HTMLElement.prototype.once = function () {
	SAHYG.onceThis.call(this, ...arguments);
	return this;
};
HTMLElement.prototype._on = SAHYG.onThis;
HTMLElement.prototype._once = SAHYG.onceThis;
HTMLElement.prototype.addClass = function () {
	this.classList.add(...arguments);
	return this;
};
HTMLElement.prototype.removeClass = function () {
	this.classList.remove(...arguments);
	return this;
};
HTMLElement.prototype.toggleClass = function () {
	this.classList.toggle(...arguments);
	return this;
};
HTMLElement.prototype.hasClass = function () {
	return this.classList.contains(...arguments);
};
HTMLElement.prototype.slideHide = function (duration = 0) {
	this.style.transitionDuration = duration + "ms";
	this.style.transitionTimingFunction = "ease-in-out";
	this.style.transitionProperty = "height";
	this.style.overflow = "hidden";
	this.style.height = this.clientHeight + "px";
	setTimeout(() => (this.style.height = 0));

	setTimeout(() => {
		this.style.display = "none";
		this.style.transitionDuration = "";
		this.style.transitionTimingFunction = "";
		this.style.transitionProperty = "";
		this.style.overflow = "";
	}, duration);
	return this;
};
HTMLElement.prototype.slideShow = function (duration = 0) {
	this.style.transitionDuration = duration + "ms";
	this.style.transitionTimingFunction = "ease-in-out";
	this.style.transitionProperty = "height";
	this.style.overflow = "hidden";
	this.style.display = "";
	this.style.height = "";

	let height = this.clientHeight;
	this.style.height = 0;

	setTimeout(() => (this.style.height = height + "px"));

	setTimeout(() => {
		this.style.transitionDuration = "";
		this.style.transitionTimingFunction = "";
		this.style.transitionProperty = "";
		this.style.overflow = "";
		this.style.display = "";
		this.style.height = "";
	}, duration);

	return this;
};
HTMLElement.prototype.slideToggle = function () {
	if (this.style.display == "none") this.slideShow(...arguments);
	else this.slideHide(...arguments);
	return this;
};
HTMLElement.prototype.show = function () {
	this.style.display = "";
	return this;
};
HTMLElement.prototype.hide = function () {
	this.style.display = "node";
	return this;
};
HTMLElement.prototype.toggle = function () {
	if (this.style.display == "none") this.show(...arguments);
	else this.hide(...arguments);
	return this;
};
/**
 * Return style of the element
 * {@link https://gist.github.com/cms/369133}
 * @author Christian C. Salvadó
 * @returns {any}
 */
HTMLElement.prototype.getStyle = function (styleProp) {
	try {
		var value,
			defaultView = this.ownerDocument.defaultView;
		// W3C standard way:
		if (defaultView && defaultView.getComputedStyle) {
			// sanitize property name to css notation (hypen separated words eg. font-Size)
			styleProp = styleProp.replace(/([A-Z])/g, "-$1").toLowerCase();
			return defaultView.getComputedStyle(this, null).getPropertyValue(styleProp);
		} else if (this.currentStyle) {
			// IE
			// sanitize property name to camelCase
			styleProp = styleProp.replace(/\-(\w)/g, function (str, letter) {
				return letter.toUpperCase();
			});
			value = this.currentStyle[styleProp];
			// convert other units to pixels on IE
			if (/^\d+(em|pt|%|ex)?$/i.test(value)) {
				return (function (value) {
					var oldLeft = this.style.left,
						oldRsLeft = this.runtimeStyle.left;
					this.runtimeStyle.left = this.currentStyle.left;
					this.style.left = value || 0;
					value = this.style.pixelLeft + "px";
					this.style.left = oldLeft;
					this.runtimeStyle.left = oldRsLeft;
					return value;
				})(value);
			}
			return value;
		}
	} catch (e) {
		console.error(e);
		return null;
	}
};
HTMLElement.prototype.setStyle = function (name, value) {
	name = SAHYG.Utils.style.replaceDashedLetter(name);
	if (this.style[name] === undefined) {
		console.error(new Error(`"${name}" is not a valid property name`));
		return this;
	}
	this.style[name] = value;
};
HTMLElement.prototype.openShadow = function () {
	return this.attachShadow({ mode: "open" });
};
HTMLElement.prototype.setContent = function () {
	this.clear();
	this.append(...arguments);
	return this;
};
HTMLElement.prototype.clear = function () {
	this.children.remove();
	this.textContent = "";
	return this;
};
HTMLElement.prototype.text = function () {
	if (arguments.length) this.textContent = Array.from(arguments).join(" ");
	else return this.textContent;
	return this;
};
HTMLElement.prototype.$ = HTMLElement.prototype.querySelectorAll;
HTMLElement.prototype.$0 = HTMLElement.prototype.querySelector;
HTMLElement.prototype.waitLoaded = function (selector, options = {}) {
	return new Promise((resolve) =>
		new MutationObserver((mutations, observer) => {
			for (let mutation of mutations) {
				if (mutation.type == "childList" && mutation.addedNodes) {
					let target = this.$0(selector);
					if (target) {
						observer.disconnect();
						resolve(target);
					}
				}
			}
		}).observe(this, {
			subtree: false,
			childList: true,
			attributes: false,
			...options,
		})
	);
};
HTMLElement.prototype.querySelectorAll = ((querySelectorAll) =>
	function () {
		return SAHYG.createNodeList(querySelectorAll.call(this, ...arguments));
	})(HTMLElement.prototype.querySelectorAll);
HTMLElement.prototype.contains = ((contains) =>
	function () {
		if (typeof arguments[0] == "string")
			return SAHYG.$(arguments[0]).every((elem) => {
				arguments[0] = elem;
				return contains.call(this, ...arguments);
			});
		else return contains.call(this, ...arguments);
	})(HTMLElement.prototype.contains);
HTMLElement.prototype.setAttribute = ((setAttribute) =>
	function () {
		setAttribute.call(this, ...arguments);
		return this;
	})(HTMLElement.prototype.setAttribute);
HTMLElement.prototype.append = ((append) =>
	function () {
		args = [...arguments].filter((arg) => arg != undefined && arg != null && arg != NaN);
		append.call(this, ...args);
		return this;
	})(HTMLElement.prototype.append);
Object.defineProperty(HTMLElement.prototype, "children", {
	get: ((children) =>
		function () {
			return SAHYG.createNodeList(children.call(this, ...arguments));
		})(Object.getOwnPropertyDescriptor(Element.prototype, "children").get),
});

ShadowRoot.prototype.setStyle = function (style) {
	if (typeof style == "string") {
		this.append(SAHYG.createElement("style", {}, style));
		return this;
	} else if (style instanceof Array) {
		style.forEach((css) => this.setStyle(css));
	} else {
		this.append(SAHYG.createElement("style", {}, SAHYG.Utils.style.objectToString(style)));
	}
};
ShadowRoot.prototype.append = ((append) =>
	function () {
		args = [...arguments].filter((arg) => arg != undefined && arg != null && arg != NaN);
		append.call(this, ...args);
		return this;
	})(ShadowRoot.prototype.append);

NodeList.prototype.map = Array.prototype.map;
NodeList.prototype.every = Array.prototype.every;
NodeList.prototype.some = Array.prototype.some;
NodeList.prototype.find = Array.prototype.find;
NodeList.prototype.push = Array.prototype.push;
NodeList.prototype.remove = function () {
	this.forEach((node) => node.remove.call(node, ...arguments));
	return this;
};
NodeList.prototype.setAttribute = function () {
	this.forEach((node) => node.setAttribute.call(node, ...arguments));
	return this;
};
NodeList.prototype.getAttribute = function () {
	return this.map((node) => node.getAttribute.call(node, ...arguments));
};
NodeList.prototype.on = function () {
	this.forEach((node) => node.on.call(node, ...arguments));
	return this;
};
NodeList.prototype.dynamicOn = function () {
	this.forEach((node) => node.dynamicOn.call(node, ...arguments));
	return this;
};
NodeList.prototype.once = function () {
	this.forEach((node) => node.once.call(node, ...arguments));
	return this;
};
NodeList.prototype.contains = function () {
	return this.some((elem) => elem.contains.call(elem, ...arguments));
};
NodeList.prototype.allContains = function () {
	return this.every((elem) => elem.contains.call(elem, ...arguments));
};
NodeList.prototype.querySelector = function () {
	for (let elem of this) {
		let selected = elem.querySelector.call(elem, ...arguments);
		if (selected) return selected;
	}
	return null;
};
NodeList.prototype.querySelectorAll = function () {
	return SAHYG.createNodeList(this.map((elem) => elem.querySelectorAll.call(elem, ...arguments)).reduce((curr, prev) => prev.concat(curr), []));
};
NodeList.prototype.addClass = function () {
	this.forEach((elem) => elem.classList.add(...arguments));
	return this;
};
NodeList.prototype.removeClass = function () {
	this.forEach((elem) => elem.classList.remove(...arguments));
	return this;
};
NodeList.prototype.toggleClass = function () {
	this.forEach((elem) => elem.classList.toggle(...arguments));
	return this;
};
NodeList.prototype.hasClass = function () {
	return this.some((elem) => elem.classList.contains(...arguments));
};
NodeList.prototype.allHasClass = function () {
	return this.every((elem) => elem.classList.contains(...arguments));
};
NodeList.prototype.parent = function () {
	return SAHYG.createNodeList(this.map((elem) => elem.parentElement));
};
NodeList.prototype.cloneNode = function () {
	return SAHYG.createNodeList(this.map((elem) => elem.cloneNode(...arguments)));
};
NodeList.prototype.text = function () {
	if (!arguments.length) return this.map((elem) => elem.text(elem));
	this.forEach((elem) => elem.text(...arguments));
	return this;
};
NodeList.prototype.last = function () {
	return this[this.length - 1];
};

SAHYG.onload(async function () {
	(bind = (obj) => {
		Object.entries(obj).forEach(([k, v]) => {
			if (v.toString?.().startsWith("class")) obj[k] = v;
			else if (typeof v == "function") obj[k] = v; // v.bind(obj) (to replace this with current parent object);
			else if (!(v instanceof Array) && typeof v == "object") bind(obj[k]);
			else if (k.startsWith("$")) obj[k] = SAHYG.$0(v);
		});
	}),
		(bind(SAHYG.Utils), bind(SAHYG.Components));

	if (SAHYG.Utils.url.getAnchor()) SAHYG.Utils.scroll.to(SAHYG.Utils.url.getAnchor());

	if (!SAHYG.$0("html").getAttribute("theme"))
		SAHYG.$0("html").setAttribute("theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
	SAHYG.Utils.cookie.set("locale", SAHYG.$0("html").getAttribute("lang"));
	SAHYG.Utils.cookie.set("theme", SAHYG.$0("html").getAttribute("theme"));

	// remove useless tippy stylesheet
	SAHYG.$0("[data-tippy-stylesheet]").remove();

	//close header  expandable menu
	SAHYG.$("header-menu .expandable .menu").forEach((elem) => (elem.style.display = "none"));

	//Cookies consent
	if (!localStorage.getItem("cookie_consent") && location.pathname != "/about") SAHYG.Utils.cookie.consentPopup();

	SAHYG.eventsList =
		"input blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error";
	SAHYG.Events = Object.fromEntries(SAHYG.eventsList.split(" ").map((e) => [e, []]));

	// ANCHOR Add redirect to /login links
	SAHYG.dynamicOn("click", 'a[href="/login"]', function (event) {
		event.preventDefault();
		if (!/login/.test(document.location.href)) document.location.href = "/login?redirect=" + document.location.pathname;
		else document.location.href = "/login";
	});
	SAHYG.dynamicOn("click", ".return-top", SAHYG.Utils.scroll.top);
	SAHYG.dynamicOn("click", "[data-viewer]", (e) =>
		e.target.getAttribute("src") ? new SAHYG.Components.popup.Viewer({ img: e.target.src }).show() : null
	);
	SAHYG.dynamicOn("click", 'a[href^="#"]:not([href="#"])', (event) => {
		event.preventDefault();
		SAHYG.Utils.scroll.to(event.target.getAttribute("href").substring(1));
	});
	// Show / hide menu
	SAHYG.on("click", "menu-icon icon", SAHYG.Components.headerMenu.toggle);
	// change language when locale flag was clicked
	SAHYG.on("click", "header-menu .commands .locale dropdown > *", function () {
		SAHYG.Utils.settings.locale.set(this.id);
	});
	// ANCHOR Language
	SAHYG.on("click", "header-menu .commands .locale .current", () => SAHYG.$("header-menu .commands .locale dropdown").toggleClass("visible"));
	// ANCHOR Theme
	SAHYG.on("click", "header-menu .commands .theme", SAHYG.Utils.settings.theme.toggle);
	// ANCHOR Expandable menu
	SAHYG.on("click", "header-menu .expandable > a", (e) =>
		window.innerWidth <= 1024 ? e.target.parentElement.toggleClass("expanded").querySelector(".menu").slideToggle(200) : null
	);
	// ANCHOR Open / close menu
	SAHYG.on("click", "header-menu", function (e) {
		if (e.target.isSameNode(SAHYG.$0("header-menu"))) SAHYG.Components.headerMenu.close();
	});
	// ANCHOR Account logout
	SAHYG.on("click", "header .account .menu .logout", SAHYG.Utils.user.logout);
	// ANCHOR Account menu
	SAHYG.on("click", "header .account", SAHYG.Components.headerAccount.toggle);
	// ANCHOR Easter egg: heart
	SAHYG.on("click", "heart", async () => SAHYG.Components.toast.Toast.success({ message: await SAHYG.translate("MADE_WITH_HEART") }).show());
	// ANCHOR Close account menu
	SAHYG.on("click", "html", SAHYG.Components.headerAccount.outsideClose);

	SAHYG.on("mouseover", "header-menu .expandable", (e) =>
		window.innerWidth > 1024 ? e.target.addClass("expanded").querySelector(".menu")?.show(0) : null
	);

	SAHYG.dynamicOn("mouseover", "[data-tooltip]", function () {
		if (!this._tippy)
			tippy(this, {
				appendTo: SAHYG.Components.tooltip.$container[0],
				content: this.getAttribute("data-tooltip"),
			});
	});
	/**
	 * Display a popup with information about the user when the mouse hovers over the link to the user's profile.
	 */
	SAHYG.dynamicOn("mouseover", 'a[href*="/user/"]', function () {
		if (this.getAttribute("data-no-tooltip")) return;
		if (!this._tippy)
			tippy(this, {
				delay: [500, 0],
				appendTo: document.querySelector("tooltips"),
				allowHTML: true,
				content: SAHYG.createElement("sahyg-loader"),
				onMount: async function (instance, event) {
					let username = this.getAttribute("href")?.match(/(?<=\/user\/)[a-z0-9_]{3,10}/)?.[0];
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
			if (event.target instanceof window.constructor && eventInformations.element instanceof window.constructor) {
				let result = await eventInformations.callback.call(window, event, ...datas);
				// console.log({ eventType: event.type, result: result, target: eventInformations.element });
				if (result != true) return false;
			} else {
				let target = $(event.target).closest(eventInformations.element);
				if (target.length) {
					let result = await eventInformations.callback.call(target[0], event, ...datas);
					// console.log({ eventType: event.type, result: result, target: eventInformations.element });
					if (result != true) return false;
				}
			}
		}
		return;
	});
});
