const SAHYG = {
	Cache: {
		// To store var for access it later
		users: {},
		translations: null,
		translationsFetchError: false,
		icons: [],
	},
	Classes: {},
	Instances: {}, // Store class instance associate with specific page
	Constants: Object.fromEntries(
		Array.from(document.querySelectorAll('head meta[name*="sahyg-"]'))?.map(($) => {
			let name = $.getAttribute("name");
			let value = $.getAttribute("content");
			let type = $.getAttribute("type");

			if (type === "number") value = Number(value);

			return [name.substring(6).replace(/-/g, "_").toUpperCase(), value];
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
		if (SAHYG.Cache.translationsFetchError) return name;

		if (!SAHYG.Cache.translations) {
			SAHYG.Cache.translations = SAHYG.Api.get("/resources/translate", {
				locale: SAHYG.$("html")?.[0]?.getAttribute("lang"),
			});
		}

		if (SAHYG.Cache.translations instanceof Promise) {
			let res = await SAHYG.Cache.translations;
			if (!res.success) SAHYG.Cache.translationsFetchError = true;
			else SAHYG.Cache.translations = res.content;
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
					eventListener = element.addEventListener(eventType, callback, {
						signal: new AbortController().signal,
					});
				});
			});
			delete attributes.once;
		}
		Object.entries(attributes).forEach(([attributeName, attributeValue]) => {
			if (
				attributeValue === false ||
				attributeValue === undefined ||
				attributeValue === NaN ||
				attributeValue === null ||
				attributeValue === "false"
			)
				return;
			element.setAttribute(
				SAHYG.Utils.text.camelToKebab(attributeName),
				typeof attributeValue === "string" ? attributeValue : JSON.stringify(attributeValue)
			);
		});
		element.append(
			...children
				.filter((elem) => elem !== undefined && elem !== null && elem !== NaN && elem !== false)
				.reduce((prev, curr) => (curr instanceof Array ? prev.push(...curr) : prev.push(curr), prev), [])
				.map((elem) => (elem instanceof Element || typeof elem === "string" ? elem : JSON.stringify(elem)))
		);
		return element;
	},
	registerCustomElement(name, element, options = {}) {
		if (this.Components[name]) throw new Error(`sahyg-${name} already exists`);

		this.Components[name] = element;
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
		if (typeof elements === "string") elements = SAHYG.$(elements);

		if (elements instanceof HTMLCollection) elements = Array.from(elements);
		else if (!(elements instanceof NodeList) && !(elements instanceof Array)) elements = [elements];

		return elements.map((element) =>
			callbacks.map((callback) => {
				element.addEventListener(type, callback);
				return {
					callback,
					type,
					element,
					off: element.removeEventListener.bind(element, type, callback),
				};
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
		if (typeof elements === "string") elements = SAHYG.$(elements);

		if (elements instanceof Array || elements instanceof HTMLCollection) elements = Array.fron(elements);
		else elements = [elements];

		return elements.map((element) =>
			callbacks.map((callback) => {
				element.addEventListener(type, callback, { once: true });
				return {
					callback,
					type,
					element,
					off: element.removeEventListener.bind(element, type, callback),
				};
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
			if (SAHYG.$$(selector).contains(event.target)) {
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
			}
			return true;
		});
	},
	/**
	 * Select HTMLElements from DOM to array and apply some useful function to it
	 * @param {String} selector CSS selector
	 * @returns {HTMLELement[]}
	 */
	$(selector, root = document) {
		if (selector instanceof HTMLElement) return SAHYG.createNodeList(...arguments);

		try {
			let elements = Array.from(root.querySelectorAll(selector));
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
	$0(selector, root = document) {
		try {
			return root.querySelectorAll(selector)[0];
		} catch (e) {
			console.error(e);
			return null;
		}
	},
	/**
	 * Select all elements that match the selector. Use `::shadow` to represent shadowed elements.
	 *
	 * Don't use `:is` or other functions that accept `,` inside parentheses.
	 *
	 * `:is` should be used only if it doesn't contain `::shadow`.
	 *
	 * Multiple selectors can be used, separated by `,`.
	 *
	 * Example: `div ::shadow .class, div > .class::shadow, ::shadow > .class`
	 *
	 * Inspired by https://stackoverflow.com/a/75241202
	 *
	 * @param {String} selector
	 * @param {HTMLElement} root
	 * @returns {NodeList}
	 */
	$$(selector, root = document) {
		try {
			let selectors = selector.split(/(?<!:is\([^)]+),/gm);
			if (selectors.length > 1) return SAHYG.createNodeList(...[].concat(...selectors.map((selector) => SAHYG.$$(selector, root))));

			selector = selector.replace(/(?<=[\s>~+|\])])(?=::shadow)|(?<=::shadow)(?=(?:\s)?[>~+|\[])/gm, "*");
			let partials = selector.split("::shadow");

			if (partials.length === 1) return root.querySelectorAll(selector);

			let elems = root.querySelectorAll(partials.shift() || "*");
			let elemsList = [];

			for (let elem of elems) {
				if (elem.shadowRoot) elemsList.push(...SAHYG.$$(partials.join("::shadow") || "*", elem.shadowRoot));
			}

			return SAHYG.createNodeList(...elemsList);
		} catch (e) {
			console.error(e);
			return null;
		}
	},
	/**
	 * Select the first element that match the selector. Use `::shadow` to represent shadowed elements.
	 *
	 * Don't use `:is` or other functions that accept `,` inside parentheses.
	 *
	 * `:is` should be used only if it doesn't contain `::shadow`.
	 *
	 * Multiple selectors can be used, separated by `,`.
	 *
	 * Example: `div ::shadow .class, div > .class::shadow, ::shadow > .class`
	 *
	 * Inspired by https://stackoverflow.com/a/75241202
	 *
	 * @param {String} selector
	 * @param {HTMLElement} root
	 * @returns {HTMLElement}
	 */
	$$0(selector, root = document) {
		try {
			let selectors = selector.split(/(?<!:is\([^)]+),/gm);
			if (selectors.length > 1) return [].concat(...selectors.map((selector) => SAHYG.$$0(selector, root)))?.[0];

			selector = selector.replace(/(?<=[\s>~+|\])])(?=::shadow)|(?<=::shadow)(?=(?:\s)?[>~+|\[])/gm, "*");
			let partials = selector.split("::shadow");

			if (partials.length === 1) return root.querySelector(selector);

			let elems = root.querySelectorAll(partials.shift() || "*");
			for (let elem of elems) {
				if (elem.shadowRoot) return SAHYG.$$0(partials.join("::shadow") || "*", elem.shadowRoot);
			}

			return null;
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
	createAkeeInstance() {
		let options = {};
		if (SAHYG.Constants.ENVIRONMENT === "development") {
			options.ignoreLocalhost = false;
			options.ignoreOwnVisits = false;
			options.detailed = true;
		} else if (localStorage.getItem("accept_detailed_stats") === "true") options.detailed = true;

		SAHYG.ackeeInstance = ackeeTracker.create(SAHYG.Constants.STATS_DOMAIN, options).record(SAHYG.Constants.STATS_TOKEN);
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
						?.map((e) => (e.split("=").length === 1 ? [e, null] : e.split("="))) || []
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
					/(?:\?|#|$).*$/m,
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
					/(?:\?|#|$).*$/m,
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
					/(?:\?|#|$).*$/m,
					`${((a = this.getAnchor(url)), a ? "#" + a : "")}?${Object.entries(this.getParams())
						.filter(([paramName]) => name != paramName)
						.map((e) => e.join("="))
						.join("&")
						.replace(/\s/gm, "%20")}`
				);
			},
			removeParams(names, url = location.href) {
				return decodeURI(url).replace(
					/(?:\?|#|$).*$/m,
					`${((a = this.getAnchor(url)), a ? "#" + a : "")}?${Object.entries(this.getParams())
						.filter(([paramName]) => !names.includes(paramName))
						.map((e) => e.join("="))
						.join("&")
						.replace(/\s/gm, "%20")}`
				);
			},
			setLocationParams(params) {
				let url = `${((a = this.getAnchor()), a ? "#" + a : "")}?${Object.entries({
					...this.getParams(),
					...params,
				})
					.map((e) => e.join("="))
					.join("&")
					.replace(/\s/gm, "%20")}`;
				return history.pushState({}, "", url);
			},
			setLocationParam(name, value) {
				let url = `${((a = this.getAnchor()), a ? "#" + a : "")}?${Object.entries({
					...this.getParams(),
					[name]: value,
				})
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
				let dialog = SAHYG.createElement("sahyg-input-dialog", {
					header: "🍪 " + (await SAHYG.translate("COOKIES")),
					inputs: [
						{
							type: "staticText",
							text: await SAHYG.translate("COOKIES_CONSENT"),
						},
						{
							type: "switch",
							id: "accept_detailed",
							title: await SAHYG.translate("ACCEPT_DETAILED_STATS"),
							description: await SAHYG.translate("ACCEPT_DETAILED_STATS_DESC"),
							defaultValue: true,
							singleLine: true,
						},
					],
					noButtons: true,
				});
				dialog.addButtons([
					{
						text: await SAHYG.translate("OK"),
						options: {
							fullColor: true,
						},
						callback: dialog.submit.bind(dialog),
					},
					{
						text: await SAHYG.translate("MORE_INFORMATIONS"),
						callback: () => (location.href = "/about#cookies"),
						closeOnClick: false,
					},
				]);
				dialog.show();
				dialog.toPromise().then((result) => {
					localStorage.setItem("cookie_consent", "true");

					if (!result?.data || result?.data?.accept_detailed) localStorage.setItem("accept_detailed_stats", "true");
					else localStorage.setItem("accept_detailed_stats", "false");

					SAHYG.createAkeeInstance();
				});
				return null;
			},
		},
		settings: {
			theme: {
				setDark(save = true) {
					document.documentElement.setAttribute("theme", "dark");
					SAHYG.Utils.cookie.set("theme", "dark");
					if (save) SAHYG.Utils.settings.theme.save();
					return true;
				},
				setLight(save = true) {
					document.documentElement.setAttribute("theme", "light");
					SAHYG.Utils.cookie.set("theme", "light");
					if (save) SAHYG.Utils.settings.theme.save();
					return true;
				},
				set(theme, save = true) {
					if (theme === "light") SAHYG.Utils.settings.theme.setLight(save);
					else if (theme === "dark") SAHYG.Utils.settings.theme.setDark(save);
					else return false;
				},
				current() {
					return document.documentElement.getAttribute("theme");
				},
				async toggle() {
					if (SAHYG.Utils.settings.theme.current() === "dark") return SAHYG.Utils.settings.theme.setLight(), "light";
					else return SAHYG.Utils.settings.theme.setDark(), "dark";
				},
				async save() {
					if (SAHYG.Utils.user.isConnected()) {
						let toast = SAHYG.createElement("sahyg-toast", {
							content: await SAHYG.translate("CLICK_TO_SAVE"),
						});
						toast.on("click", async function (event) {
							toast.close();
							let response = await SAHYG.Api.post("/settings/set", {
								theme: document.documentElement.getAttribute("theme") === "light" ? "light" : "dark",
							});
							if (response?.success)
								SAHYG.createElement("sahyg-toast", {
									content: await SAHYG.translate("SAVED"),
								}).show();
						});
						toast.show();
					} else return document.documentElement.getAttribute("theme");
				},
			},
			locale: {
				async set(locale, reload = true, saveIfPossible = true) {
					SAHYG.Utils.cookie.set("locale", locale);
					if (saveIfPossible && SAHYG.Utils.user.isConnected()) {
						SAHYG.Api.post("/settings/set", { locale })
							.then((res) => res?.success && reload && location.reload())
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
				return SAHYG.Constants.USERNAME !== "guest";
			},
			async logout(confirm = true) {
				if (confirm)
					SAHYG.createElement("sahyg-confirm-dialog", {
						content: await SAHYG.translate("LOGOUT_CONFIRM"),
					})
						.show()
						.toPromise()
						.then((confirmed) => confirmed && (window.location.href = "/logout"));
				else window.location.href = "/logout";
				return false;
			},
			username() {
				return SAHYG.$0("header .account > .username").textContent;
			},
		},
		element: {
			getDataAttribute(elem, name) {
				if (typeof elem === "string") elem = SAHYG.$0(elem);
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

				if (newHeight === maxHeight) target.style.overflowY = "scroll";
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
		icons: {
			async getAll() {
				if (SAHYG.Cache.icons.length) return true;
				let icons = (await SAHYG.Api.get(location.origin + "/line-awesome.json")) || [];
				if (!icons) return false;
				SAHYG.Cache.icons = icons;
				return true;
			},
			check(icon, queries, disabledQuery = ["name", "category", "categories", "styles", "unicode"]) {
				if (typeof queries === "string" || queries instanceof Array)
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
				if (filteredIcons.length === 0) return null;
				if (filteredIcons.length === 1) return filteredIcons[0];
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
						if (typeof value === "string") return `${key}{${value}}`;
						else if (value instanceof Array) return `${key}{${value.join("\n")}}`;
						else
							return `${key}{${Object.entries(value)
								.map(([propertyName, propertyValue]) => {
									if (typeof propertyValue === "string" || typeof propertyValue === "number")
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
		headerMenu: {
			$menu: "header-menu",
			$menuIcon: "menu-icon",
			isOpened: function () {
				return SAHYG.Utils.headerMenu.$menu.getAttribute("status") === "opened";
			},
			toggle: function () {
				if (SAHYG.Utils.headerMenu.isOpened()) SAHYG.Utils.headerMenu.close();
				else SAHYG.Utils.headerMenu.open();
			},
			close: function () {
				SAHYG.Utils.headerMenu.$menu.setAttribute("status", "closed");
				SAHYG.Utils.headerMenu.$menuIcon.setAttribute("status", "closed");
			},
			open: function () {
				SAHYG.Utils.headerMenu.$menu.setAttribute("status", "opened");
				SAHYG.Utils.headerMenu.$menuIcon.setAttribute("status", "opened");
			},
		},
		headerAccount: {
			$menu: "header .account .menu",
			toggle: function (e) {
				if (!SAHYG.Utils.headerAccount.$menu) return true;
				if (e.target.closest("header .account .menu")) return true;

				e?.stopPropagation();
				if (SAHYG.Utils.headerAccount.isOpened()) return SAHYG.Utils.headerAccount.close(), false;
				else return SAHYG.Utils.headerAccount.open(), false;
			},
			open: function () {
				if (!SAHYG.Utils.headerAccount.$menu) return true;
				SAHYG.Utils.headerAccount.$menu.setAttribute("status", "opened");
				return false;
			},
			close: function () {
				if (!SAHYG.Utils.headerAccount.$menu) return true;
				SAHYG.Utils.headerAccount.$menu.setAttribute("status", "closed");
				return false;
			},
			outsideClose: function (e) {
				if (!SAHYG.Utils.headerAccount.$menu) return true;
				if (SAHYG.Utils.headerAccount.isOpened()) {
					if (e && (e.target.closest("header .account .menu") || e.target.closest("popups"))) return true;
					e?.stopPropagation();
					SAHYG.Utils.headerAccount.$menu.setAttribute("status", "closed");
					return false;
				}
				return true;
			},
			isOpened: function () {
				if (!SAHYG.Utils.headerAccount.$menu) return null;
				return SAHYG.Utils.headerAccount.$menu.getAttribute("status") === "opened";
			},
		},
		clearToast() {
			SAHYG.$0("sahyg-toasts")?.children.forEach((child) => {
				if (child instanceof SAHYG.Components.Toast) child.close();
				else child.remove();
			});
		},
		createRandomId() {
			return Math.random().toString(32).substring(2, 10);
		},
	},
	Api: {
		async request(type, path, content = {}) {
			if (!path.startsWith("https")) path = SAHYG.Constants.API_DOMAIN + path;

			let res = await axios({
				method: type,
				url: path,
				data: content,
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Accept: "application.json",
				},
			});
			// console.log("request", res);
			return res?.data;
		},
		async get(url, content = {}) {
			return await SAHYG.Api.request("GET", url, content);
		},
		async post(url, content = {}) {
			return await SAHYG.Api.request("POST", url, content);
		},
		emptyData({ statusText, status, success, content, loggedWith } = {}) {
			return {
				success: success || false,
				content: content || null,
				statusText: statusText || "SERVER_ERROR",
				loggedWith: loggedWith || null,
				status: status || 500,
			};
		},
		async translateError(name) {
			let translation = await SAHYG.translate("AXIOS_" + name);
			if (translation === "AXIOS_" + name) return undefined;
			return translation;
		},
		async responseInterceptor(response) {
			// console.log("response", response);
			if (!response.data)
				response.data = SAHYG.Api.emptyData({
					status: response.status,
					statusText: response.statusText,
				});
			else if (response.data && response.data.success === false) {
				return await SAHYG.Api.errorInterceptor({ response });
			}

			return response;
		},
		async errorInterceptor(error) {
			console.log("error", error);
			let description =
				error.response?.data?.description ||
				(await SAHYG.Api.translateError(error.code)) ||
				error.message ||
				(await SAHYG.translate("ERROR_OCCURRED"));

			SAHYG.createElement("sahyg-toast", {
				type: "error",
				content: description,
			}).show();

			if (!error.response.data)
				error.response.data = SAHYG.Api.emptyData({
					status: error.response.status,
					statusText: error.response.statusText,
				});

			return error;
		},
	},
	ask: {
		colorByTooltip({ target, defaultColor, appendTo = document.body } = {}) {
			return new Promise((resolve) => {
				let input;
				tippy(target, {
					placement: "bottom",
					trigger: "manual",
					content: "",
					appendTo,
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
						SAHYG.once("click", target, instance.hide);

						let picker = SAHYG.createElement(
							"color-picker",
							{},
							(input = SAHYG.createElement("sahyg-input-color", {
								value: defaultColor || "#000000",
							})),
							SAHYG.createElement("sahyg-button", { fullColor: true, content: await SAHYG.translate("CONFIRM") }).on("click", () => {
								instance.hide();
								resolve(input.value);
							})
						);
						instance.setContent(picker);
					},
				});
			});
		},
		iconByTooltip({ target, appendTo = document.body } = {}) {
			return new Promise(async (resolve) => {
				typeof target === "string" && (target = SAHYG.$0(target));

				await SAHYG.Utils.icons.getAll();

				let eventsClick = [],
					eventsHover = [],
					eventTarget;

				tippy(target, {
					placement: "bottom",
					trigger: "manual",
					content: "",
					appendTo,
					interactive: true,
					maxWidth: "none",
					onClickOutside(instance) {
						resolve(null);
					},
					onHidden(instance) {
						instance.destroy();
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
														let query = target.value;
														if (!query.length) body.children?.removeClass("hidden");
														SAHYG.Cache.icons.forEach((icon) => {
															if (SAHYG.Utils.icons.check(icon, query))
																body.$(`[data-name="${icon.name}"]`)?.removeClass("hidden");
															else body.$(`[data-name="${icon.name}"]`)?.addClass("hidden");
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
											String.fromCharCode(`0x${icon.unicode}`)
										);
									})
								)),
								SAHYG.createElement("div", { class: "footer" }, (nameContainer = SAHYG.createElement("div", { class: "icon-name" })))
							)
						);
					},
				}).show();
			});
		},
	},
	Components: {
		tooltipMenu: function ({ target, items, options = {}, mainInstance, appendTo = document.body } = {}) {
			return tippy(typeof target !== "string" ? target : SAHYG.$0(target), {
				appendTo,
				content: "",
				trigger: "click",
				interactive: true,
				placement: "bottom",
				duration: 200,
				onCreate(instance) {
					let menu = SAHYG.createElement("div", { class: "tooltip-menu" });
					for (let item of items) {
						switch (item.type) {
							case "divider": {
								menu.append(SAHYG.createElement("span", { class: "divider", ...(item.attributes || {}) }));
								break;
							}
							case "button": {
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
											...(item.options || item.attributes || {}),
										},
										SAHYG.createElement("span", { class: "icon lafs" }, item.icon || ""),
										SAHYG.createElement("span", { class: "text" }, item.text)
									)
								);
								break;
							}
							case "dropdown": {
								let dropdownTarget;
								menu.append(
									(dropdownTarget = SAHYG.createElement(
										"div",
										{ class: "item dropdown", ...(item.attributes || {}) },
										SAHYG.createElement("span", { class: "icon lafs" }, item.icon || ""),
										SAHYG.createElement("span", { class: "text" }, item.text),
										SAHYG.createElement("span", { class: "dropdown-icon lafs" }, String.fromCharCode(0xf105))
									))
								);
								SAHYG.Components.tooltipMenu({
									target: dropdownTarget,
									items: item.dropdown,
									options: {
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
									mainInstance: instance,
								});
								break;
							}
						}
					}
					instance.setContent(menu);
				},
				...options,
			});
		},
	},
};

SAHYG.Components.InputList = class InputList extends HTMLElement {
	connectedCallback() {
		this.openShadow();

		this.defaultValues = JSON.parse(this.getAttribute("values") || this.getAttribute("default-values") || "[]");
		this.values = [];

		this.$values = SAHYG.createElement(
			"div",
			{
				class: "values",
			},
			...this.defaultValues.map((value) => {
				value = typeof value === "string" ? value : value.text || value.value;
				let id = value.id || Math.random().toString(32).substring(2, 10);
				this.values.push({ id, value });

				return SAHYG.createElement(
					"div",
					{ class: "value", id },
					SAHYG.createElement("div", { class: "text" }, value),
					SAHYG.createElement("div", {
						class: "remove",
						on: { click: this.removeValue.bind(this, id) },
					})
				);
			})
		);
		this.$addButton = SAHYG.createElement("div", {
			class: "add",
			on: { click: this.addValue.bind(this) },
		});

		this.$container = SAHYG.createElement("div", { class: "container" }, this.$values, this.$addButton);

		this.shadowRoot.setStyle({
			".container": {
				backgroundColor: "var(--background-tertiary-color)",
				padding: "0.5rem",
				borderRadius: "0.25rem",
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
			},
			".values": {
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
				flexWrap: "wrap",
				flex: "1",
				gap: "0.5rem",
			},
			".value": {
				padding: "0.2rem 0.5rem",
				backgroundColor: "var(--background-secondary-color)",
				borderRadius: "0.25rem",
				display: "flex",
				flexWrap: "nowrap",
				flexDirection: "row",
				alignItems: "center",
				gap: "0.5rem",
			},
			".value .remove:before": {
				transition: "var(--transition)",
				fontFamily: '"Line Awesome Free Solid"',
				content: '"\\f00d"',
				cursor: "pointer",
			},
			".value .remove:hover:before": {
				color: "var(--danger-color)",
			},
			".add:before": {
				fontFamily: '"Line Awesome Free Solid"',
				content: '"\\f067"',
				cursor: "pointer",
				padding: "0.5rem 0.5rem",
				borderRadius: "0.25rem",
			},
			".add:hover:before": {
				transition: "var(--transition)",
				backgroundColor: "var(--background-secondary-color)",
				color: "var(--success-color)",
			},
		});
		this.shadowRoot.append(this.$container);

		this.setAttribute("tabindex", "1");
	}
	removeValue(id) {
		let removed = this.values.splice(
			this.values.findIndex((value) => value.id === id),
			1
		)?.[0];

		this.$container.$0(`.value[id="${id}"]`).remove();

		this.dispatch(removed, "remove");
	}
	async addValue() {
		let value = (
			await SAHYG.createElement("sahyg-input-dialog", {
				header: await SAHYG.translate("ADD"),
				inputs: [
					{
						type: "text",
						id: "value",
						options: {
							fullWidth: true,
							borderBottom: true,
							placeholder: await SAHYG.translate("VALUE"),
						},
					},
				],
			})
				.show()
				.toPromise()
		)?.data?.value;

		if (!value) return;
		let id = Math.random().toString(32).substring(2, 10);

		let added = { id, value };

		this.values.push(added);

		this.$values.append(
			SAHYG.createElement(
				"div",
				{ class: "value", id },
				SAHYG.createElement("div", { class: "text" }, value),
				SAHYG.createElement("div", {
					class: "remove",
					on: { click: this.removeValue.bind(this, id) },
				})
			)
		);

		this.dispatch(added, "add");
	}
	dispatch(change, type) {
		let changeEvent = new Event("change");
		let inputEvent = new Event("input");
		changeEvent.removed = inputEvent.removed = type === "remove" ? change : null;
		changeEvent.added = inputEvent.added = type === "add" ? change : null;
		changeEvent.values = inputEvent.values = this.values;
		this.dispatchEvent(changeEvent);
		this.dispatchEvent(inputEvent);
	}
};
SAHYG.Components.InputArray = class InputArray extends HTMLElement {
	async connectedCallback() {
		this.openShadow(["url"]);
		this.columns = JSON.parse(this.getAttribute("columns")) || [];
		this.defaultValues = JSON.parse(this.getAttribute("values")) || [];
		this.value = this.values = JSON.parse(JSON.stringify(this.defaultValues));
		this.confirmClear = String(this.getAttribute("confirm-clear")) === "true";
		this.minWidth = this.getAttribute("min-width");
		// this.minWidth = this.getAttribute("min-width") || this.columns.length * 300 + "px";
		// if (typeof this.minWidth === "number") this.minWidth = this.minWidth + "px";

		if (!this.columns.length) {
			this.clear();
			this.append(await SAHYG.translate("NO_COLUMNS"));
			return;
		}

		for (let column of this.columns) {
			column.name = await this.translate(column.name);
			column.placeholder = await this.translate(column.placeholder || "");

			if (typeof column.width === "number") column.width = column.width + "%";
		}

		this.rows = this.values.map((value, index) => {
			return {
				id: Math.random().toString(32).substring(2, 10),
				index,
				values: value,
			};
		});

		this.$header = SAHYG.createElement("div", { class: "header" }, ...(await Promise.all(this.columns.map(this.columnHeader.bind(this)))));
		this.$body = SAHYG.createElement("div", {
			class: "body",
			replacementText: await SAHYG.translate("NO_DATA_CLICK_TO_ADD"),
		});
		this.$buttons = SAHYG.createElement(
			"div",
			{ class: "buttons" },
			SAHYG.createElement("sahyg-button", {
				icon: String.fromCharCode(0xf067),
				class: "add",
				content: await SAHYG.translate("ADD"),
			}).on("click", this.addRow.bind(this, null)),
			SAHYG.createElement("sahyg-button", {
				icon: String.fromCharCode(0xf2ed),
				class: "clear",
				content: await SAHYG.translate("CLEAR"),
			}).on("click", this.clearRows.bind(this))
		);

		for (let row of this.rows) {
			this.$body.append(await this.row(row));
		}

		this.$arrayContainer = SAHYG.createElement("div", { class: "array-container" }, this.$header, this.$body);
		if (this.minWidth) this.$body.style.minWidth = this.$header.style.minWidth = this.minWidth;

		this.$container = SAHYG.createElement("div", { class: "container" }, this.$arrayContainer, this.$buttons);

		this.shadowRoot.setStyle({
			".container": {
				width: "100%",
				display: "flex",
				flexDirection: "column",
				border: "solid var(--divider-color) 2px",
				borderRadius: "0.5rem",
				overflow: "hidden",
			},
			".array-container": {
				overflowX: "scroll",
			},
			".header": {
				display: "flex",
				flexDirection: "row",
				backgroundColor: "var(--background-secondary-color)",
				WebkitUserSelect: "none",
				MozUserSelect: "none",
				MsUserSelect: "none",
				userSelect: "none",
				minWidth: "40rem",
			},
			".body": {
				minWidth: "40rem",
			},
			".body[replacement-text]:empty": {
				display: "flex",
				padding: "0.5rem",
			},
			".body[replacement-text]:empty:before": {
				content: '"\\f3bf"',
				fontFamily: "var(--font-icon-solid)",
				fontSize: "2rem",
				display: "block",
				transform: "rotate(-180deg)",
				color: "var(--accent-color)",
				height: "3rem",
				marginRight: "0.5rem",
			},
			".body[replacement-text]:empty:after": {
				content: "attr(replacement-text)",
				display: "flex",
				alignItems: "center",
			},
			".row": {
				display: "flex",
				flexDirection: "row",
				borderBottom: "var(--divider-color) solid 2px",
			},
			".column-header": {
				padding: "0.5rem 0.5rem",
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "flex-start",
			},
			".cell": {
				padding: "0.25rem 0.5rem",
				minHeight: "2rem",
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "flex-start",
				overflowX: "scroll",
			},
			":is(.cell, .column-header):not(:first-child)": {
				borderLeft: "var(--divider-color) solid 2px",
			},
			':is(.cell, .column-header)[align="right"]': {
				textAlign: "right",
				justifyContent: "flex-end",
				// paddingRight: "1rem",
			},
			':is(.cell, .column-header)[align="center"]': {
				textAlign: "center",
				justifyContent: "center",
			},
			"sahyg-textarea": {
				width: "100%",
			},
			".cell .buttons": {
				display: "flex",
				flexDirection: "row",
				flexWrap: "wrap",
				// width: "100%",
			},
		});
		this.shadowRoot.append(this.$container);
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
					clearIcon: true,
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
			case "url":
			case "link": {
				return SAHYG.createElement("a", { href: row.values[column.id], ...(column.options || {}) }, row.values[column.id]);
			}
			case "staticText": {
				return SAHYG.createElement("span", { class: "static-text" }, row.values[column.id] || "");
			}
			case "buttons": {
				return SAHYG.createElement(
					"div",
					{ class: "buttons" },
					...(column.buttons?.map((button) =>
						SAHYG.createElement(
							"sahyg-tooltip-target",
							{ content: button.tooltip },
							SAHYG.createElement("sahyg-button", {
								...(button || {}),
							})
						)
					) || [])
				);
			}
		}
	}
	async columnHeader(column) {
		let columnHeader = SAHYG.createElement(
			"div",
			{
				class: "column-header",
				columnId: column.id,
				align: column.align || "left",
			},
			SAHYG.createElement("span", { class: "column-name" }, column.name)
		);
		columnHeader.style.width = column.width;
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
		this.dispatchInput({
			columnId: column.id,
			rowId: row.id,
			value: event.value,
			action: "edit",
		});
	}
	async row(row) {
		let $row = SAHYG.createElement("div", { class: "row", rowId: row.id });
		for (let column of this.columns) {
			let $cell = SAHYG.createElement(
				"div",
				{ class: "cell", columnId: column.id, align: column.align || "left" },
				await this.cellValue(column, row)
			);
			$cell.style.width = column.width;
			$row.append($cell);
		}
		row.$ = $row;
		return $row;
	}
	async addRow(values) {
		let row = {
			id: Math.random().toString(32).substring(2, 10),
			index: this.rows.length,
			values: values || Object.fromEntries(this.columns.map((column) => [column.id, this.emptyValue(column.type)])),
		};

		this.rows.push(row);
		this.values.push(row.values);
		this.$body.append((row.$ = await this.row(row)));
		this.dispatchInput({ rowId: row.id, action: "add" });

		return row;
	}
	async clearRows(forceClear = false) {
		if (
			forceClear ||
			!this.confirmClear ||
			(await SAHYG.createElement("sahyg-confirm-dialog", {
				content: await SAHYG.translate("CONFIRM_CLEAR"),
			})
				.show()
				.toPromise())
		) {
			this.rows = [];
			this.$body.clear();
			this.values = this.value = [];
			this.dispatchInput({ action: "clear" });
		}
	}
	async removeRow(id) {
		let row = this.rows.splice(
			this.rows.findIndex((row) => row.id === id),
			1
		)?.[0];
		this.values.splice(row.index, 1);
		this.values.splice(row.index, 1);
		this.$body.$0(`[row-id="${id}"]`).remove();
		this.updateIndex();
		this.dispatchInput({ rowId: id, action: "remove" });
	}
	updateIndex() {
		this.rows.sort((a, b) => a.index - b.index);
		for (let i = 0; i < this.rows.length; i++) {
			this.rows[i].index = i;
		}
	}
	emptyValue(type) {
		switch (type) {
			case "text":
				return "";
			case "switch":
				return false;
			case "select":
			case "selectOne":
				return [];
			default:
				return null;
		}
	}
	updateCell(rowId, columnId, value) {
		let column = this.columns.find((column) => column.id === columnId);
		let row = typeof rowId === "number" ? this.rows.find((row) => row.index === rowId) : this.rows.find((row) => row.id === rowId);

		if (!column || !row) return;
		switch (column.type) {
			case "text": {
				let textarea = row.$.$0(`[column-id=${columnId}] sahyg-textarea`);
				if (!textarea) break;

				textarea.setAttribute("value", value);
				this.values[row.index][columnId] = row.values[columnId] = value;
				break;
			}
			case "staticText": {
				let span = row.$.$0(`[column-id=${columnId}] .static-text`);
				if (!span) break;

				span.text(value);
				this.values[row.index][columnId] = row.values[columnId] = value;
				break;
			}
			case "url":
			case "link": {
				row.$.$0(`[column-id=${columnId}] a`).setAttribute("href", value).textContent = value;
			}
		}
		return this;
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
SAHYG.Components.Select = class Select extends HTMLElement {
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
						return {
							id: Math.random().toString(32).substring(2, 10),
							value: String(option),
						};
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
	constructor() {
		super();
		this.addEventListener("input", (e) => {
			if (this.$textarea?.contains(e.target)) return e.stopPropagation(), false;
			return true;
		});
		this.addEventListener("change", (e) => {
			if (this.$textarea?.contains(e.target)) return e.stopPropagation(), false;
			return true;
		});
	}
	async connectedCallback() {
		this.openShadow(["tippy"]);

		this.options = JSON.parse(this.getAttribute("options") || "[]");
		if (this.options instanceof Array)
			this.options = this.options.map((option) => {
				if (option?.name) option.id = option.name;
				if (option?.text) option.value = option.text;
				if (option?.id && option?.value) return option;
				return {
					id: Math.random().toString(32).substring(2, 10),
					value: String(option),
				};
			});
		else
			this.options = Object.entries(this.options).map(([id, value]) => {
				return { id, value };
			});

		this.selected = JSON.parse(this.getAttribute("selected")) || [];
		if (typeof this.selected === "string") this.selected = [this.selected];

		this.multiple = String(this.getAttribute("multiple")) === "true";
		this.search = String(this.getAttribute("search")) === "true";
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
						if (options.length === 0) return false;
						return true;
				  }))
				: null
		);
		if (this.label) this.$selected.setAttribute("data-label", this.label);

		this.$container = SAHYG.createElement("div", { class: "container" }, this.$selected);

		this.tippy = tippy(this.$container, {
			content: "",
			appendTo: this.$container,
			trigger: "click",
			interactive: true,
			placement: "bottom",
			arrow: false,
			duration: 200,
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

		this.shadowRoot.setStyle({
			".container": {
				backgroundColor: "var(--background-tertiary-color)",
				padding: "0.25rem 0.5rem",
				borderRadius: "0.25rem",
				cursor: "pointer",
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
				flexWrap: "nowrap",
				minHeight: "33px",
				minWidth: "10rem",
			},
			".selected": {
				flexWrap: "wrap",
				gap: "0.5rem",
				flexDirection: "row",
				width: "calc(100% - 16px - 0.5rem)",
				display: "flex",
				alignItems: "center",
				justifyContent: "flex-start",
				marginRight: "0.5rem",
				height: "2rem",
			},
			".selected > div": {
				padding: "0.25rem 0.5rem",
				borderRadius: "0.25rem",
				WebkitUserUelect: "none",
				MozUserSelect: "none",
				MsUserSelect: "none",
				userSelect: "none",
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis",
			},
			'.container[multiple="true"] .selected > div': {
				backgroundColor: "var(--background-secondary-color)",
			},
			".selected:empty:before": {
				content: "attr(data-placeholder)",
				color: "var(--color-secondary-text)",
			},
			".selected-hidden .selected:after": {
				content: "attr(data-placeholder)",
			},
			".selected[data-label]:before": {
				content: 'attr(data-label) " :"',
			},
			".selected-hidden .selected > div": {
				display: "none",
			},
			".container:after": {
				fontFamily: "var(--font-icon-solid)",
				content: '"\\f105"',
				marginLeft: "auto",
			},
			'[aria-expanded="true"]:after': {
				transform: "rotate(90deg)",
			},
			"[data-tippy-root] .tippy-box": {
				width: "100vw",
			},
			".tippy-content": {
				padding: "0",
			},
			".options": {
				display: "flex",
				flexDirection: "column",
				maxHeight: "25vh",
				overflowY: "auto",
			},
			".option": {
				padding: "0.5rem 1rem",
				cursor: "pointer",
				display: "flex",
				flexDirection: "row",
			},
			".option:hover": {
				backgroundColor: "var(--background-secondary-color)",
			},
			".option .select-icon:before": {
				content: '" "',
				color: "var(--divider-color)",
				fontSize: "1.2rem",
				marginRight: "0.5rem",
				width: "1.5rem",
				height: "1.5rem",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			},
			'.option[selected="true"] .select-icon:before': {
				color: "var(--accent-color)",
				content: '"\\f00c"',
				fontFamily: "var(--font-icon-solid)",
			},
			".option .text": {
				whiteSpace: "nowrap",
				color: "var(--color-primary-text)",
			},
			"sahyg-textarea": {
				minWidth: "10rem",
				flex: "1",
			},
		});
		this.shadowRoot.append(this.$container);

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
		if (target.closest("sahyg-textarea") && String(this.getAttribute("aria-expanded")) === "true") return;
		await this.update$Options();
		this.tippy.setProps({
			maxWidth: this.$container.clientWidth || this.$container.offsetWidth,
			hideOnClick: !this.multiple,
		});
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
		let option = this.options.find((option) => option.id === id);
		if (!option) return;

		if (!this.multiple) {
			if (this.selected.includes(id)) this.selected = [];
			else this.selected = [id];
		} else if (this.selected.includes(id))
			this.selected.splice(
				this.selected.findIndex((optionId) => optionId === id),
				1
			);
		else this.selected.push(id);

		if (!this.multiple)
			Array.from(this.shadowRoot.querySelectorAll(`[data-tippy-root] .option:not([id="${id}"])`)).forEach((elem) =>
				elem.setAttribute("selected", "false")
			);

		this.shadowRoot.querySelector(`[data-tippy-root] .option[id="${id}"]`)?.setAttribute("selected", String(this.selected.includes(id)));
		await this.update$Selected();

		this.dispatch(id, this.selected.includes(id) ? "add" : "remove");
	}
	async update$Selected() {
		Array.from(this.$selected.children).forEach((child) => (child.nodeName != "SAHYG-TEXTAREA" ? child.remove() : null));

		this.$selected.prepend(
			...this.selected.map((id) => SAHYG.createElement("div", { id }, this.options.find((option) => option.id === id)?.value))
		);
	}
	dispatch(change, type) {
		let changeEvent = new Event("change");
		let inputEvent = new Event("input");
		changeEvent.removed = inputEvent.removed = type === "remove" ? change : null;
		changeEvent.added = inputEvent.added = type === "add" ? change : null;
		changeEvent.selected = inputEvent.selected = this.selected;
		this.dispatchEvent(changeEvent);
		this.dispatchEvent(inputEvent);
	}
};
SAHYG.Components.Textarea = class Textarea extends HTMLElement {
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
			"value",
			"max-height",
			"min-height",
			"border-bottom",
			"resize",
			"outline",
			"rounded",
			"icon",
			"validator",
		];
	}
	attributeChangedCallback(name, oldValue, newValue) {
		if (!this.displayed) return;
		this.updateAttributes();

		if (!this.$textarea) return;

		if (name === "placeholder") this.$textarea.setAttribute("placeholder", newValue);
		else if (name === "default-value" && (oldValue === this.$textarea.value || this.$textarea.value === "")) {
			if (newValue === true) newValue = "";
			if (this.useInput) this.$textarea.setAttribute("value", newValue);
			else this.$textarea.innerText = newValue;
			this.$textarea.value = this.value = newValue;
			if (this.$counterValue) this.$counterValue.innerText = newValue.length;
		} else if (name === "value" && (oldValue === this.$textarea.value || this.$textarea.value === "")) {
			if (newValue === true) newValue = "";
			if (this.useInput) this.$textarea.setAttribute("value", newValue);
			else this.$textarea.innerText = newValue;
			this.$textarea.value = this.value = newValue;
			if (this.$counterValue) this.$counterValue.innerText = newValue.length;
		} else if (name === "min-height") this.$textarea.style.minHeight = newValue;
		else if (name === "max-height") this.$textarea.style.maxHeight = newValue;
		else if (name === "resize") this.$textarea.style.resize = newValue;
		else if (name === "icon") this.$icon.text(newValue);
		else if (name === "validator") this.setValidator(newValue);
	}
	updateAttributes() {
		this.multiline = String(this.getAttribute("multiline")) === "true";
		this.dynamicHeight = String(this.getAttribute("dynamic-height")) === "true";
		this.showCharacterCounter = String(this.getAttribute("character-counter")) === "true";
		this.maxLength = Number(this.getAttribute("max-length")) || null;
		this.minLength = Number(this.getAttribute("min-length")) || null;
		this.placeholder = this.getAttribute("placeholder") || "";
		this.defaultValue = this.getAttribute("default-value") || this.getAttribute("value") || "";
		if (this.defaultValue === true) this.defaultValue = "";
		this.maxHeight = this.getAttribute("max-height");
		this.minHeight = this.getAttribute("min-height");
		this.borderBottom = String(this.getAttribute("border-bottom")) === "true";
		this.clearIcon = String(this.getAttribute("clear-icon")) === "true";
		this.resize = this.getAttribute("resize") || "none";
		this.outline = String(this.getAttribute("outline")) === "true";
		this.rounded = String(this.getAttribute("rounded")) === "true";
		this.options = JSON.parse(this.getAttribute("options") || "{}");
		this.useInput = this.getAttribute("use-input");
		this.type = this.getAttribute("type");
		this.icon = this.getAttribute("icon");

		// Apply the validator if it is available as a regular expression in the attributes
		let validator = this.getAttribute("validator");
		if (validator) this.setValidator(validator);

		if (this.defaultValue === "true") this.defaultValue = "";

		if (!this.displayed) return;
		this.$container.setAttribute("multiline", this.multiline);
		this.$container.setAttribute("character-counter", this.showCharacterCounter);
		this.$container.setAttribute("border-bottom", this.borderBottom);
		if (this.outline) this.$container.addClass("outline");
		else this.$container.removeClass("outline");
		if (this.rounded) this.$container.addClass("rounded");
		else this.$container.removeClass("rounded");
	}
	constructor() {
		super();

		this.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !this.multiline) {
				e.preventDefault();

				let form = this.closest("form");
				if (form) form.dispatchEvent(new SubmitEvent("submit"));
			}
			return false;
		});
		this.addEventListener("input", () => {
			if (this.dynamicHeight) SAHYG.Utils.element.resizeTextarea(this.$textarea);

			this.value = this.$textarea.value;

			if (typeof this.validator === "function") {
				if (
					this.validator(this.$textarea.value) &&
					(typeof this.maxLength === "number" ? this.maxLength >= this.$textarea.value.length : true) &&
					(typeof this.minLength === "number" ? this.minLength <= this.$textarea.value.length : true)
				) {
					this.$container.removeClass("invalid");
				} else {
					this.$container.addClass("invalid");
				}
			} else if (typeof this.maxLength === "number") {
				if (this.maxLength < this.$textarea.value.length) {
					this.$container.removeClass("invalid");
				} else {
					this.$container.addClass("invalid");
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
	}
	connectedCallback() {
		this.openShadow();

		if (!this.id) this.id = Math.random().toString(32).substring(2, 10);

		this.updateAttributes();

		this.value = this.defaultValue;

		// Use of an `input` element for different types like password or username.
		if (this.type) this.useInput = this.useInput ? this.useInput === "true" : true;

		if (this.useInput)
			this.$textarea = SAHYG.createElement("input", {
				type: this.type || "text",
				placeholder: this.placeholder,
				...this.options,
				value: this.defaultValue,
			});
		else this.$textarea = SAHYG.createElement("textarea", { placeholder: this.placeholder, ...this.options }, this.defaultValue);

		// If no icon has been provided, try to determine the icon from the input type.
		if (!this.icon)
			switch (this.type) {
				case "email": {
					this.icon = String.fromCharCode(0xf1fa);
					break;
				}
				case "lastname":
				case "firstname":
				case "username": {
					this.icon = String.fromCharCode(0xf007);
					break;
				}
				case "password": {
					this.icon = String.fromCharCode(0xf084);
					break;
				}
			}
		if (this.icon) this.$icon = SAHYG.createElement("span", { class: "icon" }, this.icon);
		if (this.clearIcon)
			this.$clearIcon = SAHYG.createElement("div", {
				class: "clear-icon",
				on: { click: this.clear.bind(this) },
			});
		if (this.type === "password")
			this.$showPassword = SAHYG.createElement("div", {
				class: "show-icon",
				on: { click: this.togglePassword.bind(this) },
			});
		if (typeof this.maxLength === "string" || this.showCharacterCounter === true || this.borderBottom)
			this.$bottomContainer = SAHYG.createElement(
				"div",
				{ class: "bottom" },
				this.borderBottom
					? (this.$borderBottom = SAHYG.createElement("span", {
							class: "border-bottom",
					  }))
					: null,
				this.showCharacterCounter === true
					? SAHYG.createElement(
							"span",
							{ class: "character-counter" },
							(this.$counterValue = SAHYG.createElement(
								"span",
								{ class: "character-counter-value" },
								this.defaultValue?.length || "0"
							)),
							typeof this.maxLength === "number" ? " / " : null,
							typeof this.maxLength === "number"
								? SAHYG.createElement("span", { class: "character-counter-max" }, this.maxLength)
								: null
					  )
					: null
			);
		this.$textareaContainer = SAHYG.createElement(
			"div",
			{ class: "textarea-container" },
			this.$icon,
			this.$textarea,
			this.$clearIcon,
			this.$showPassword
		);
		this.$container = SAHYG.createElement("div", { class: "container" }, this.$textareaContainer, this.$bottomContainer);

		if (this.maxHeight) this.$textarea.style.maxHeight = typeof Number(this.maxHeight) ? this.maxHeight + "px" : this.maxHeight;
		if (this.minHeight) this.$textarea.style.minHeight = typeof Number(this.minHeight) ? this.minHeight + "px" : this.minHeight;
		if (this.resize) this.$textarea.style.resize = this.resize;

		this.setAttribute("tabindex", "1");

		this.shadowRoot.setStyle({
			".container": {
				width: "100%",
			},
			".container.outline": {
				border: "solid var(--divider-color) 2px",
			},
			".container.rounded": {
				borderRadius: "0.5rem",
				padding: "0.25rem",
				display: "flex",
				flexDirection: "column",
			},
			".container.outline.invalid": {
				borderColor: "var(--danger-color)",
			},
			".textarea-container": {
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
			},
			":is(textarea, input)": {
				width: "100%",
				backgroundColor: "unset",
				border: "none",
				padding: "0.25rem 0.5rem",
				resize: "none",
				maxHeight: "300px",
				minHeight: "1.5rem",
				overflow: "hidden",
				height: "1.5rem",
				color: "var(--color-primary-text)",
			},
			'[multiline="true"] :is(textarea, input)': {
				overflowY: "scroll",
				minHeight: "10rem",
			},
			'[character-counter="true"] :is(textarea, input)': {
				paddingBottom: "0",
			},
			":is(textarea, input):focus-visible": {
				outline: "none",
			},
			'.invalid:not(:is([border-bottom="true"], .outline)) :is(textarea, input)': {
				borderBottom: "var(--danger-color) 2px solid",
			},
			'[character-counter="true"] .bottom': {
				display: "flex",
				flexDirection: "row",
				gap: "0.5rem",
				alignItems: "center",
				color: "var(--color-secondary-text)",
			},
			'[character-counter="true"] .character-counter': {
				whiteSpace: "nowrap",
				WebkitUserSelect: "none",
				MozUserSelect: "none",
				MsUserSelect: "none",
				userSelect: "none",
			},
			'[border-bottom="true"] .border-bottom': {
				width: "100%",
				display: "block",
				backgroundColor: "var(--divider-color)",
				height: "2px",
				transition: "var(--transition)",
				marginTop: "0.25rem",
			},
			'[border-bottom="true"].invalid .border-bottom': {
				backgroundColor: "var(--danger-color)",
			},
			':is([border-bottom="true"], [character-counter="true"]) .bottom': {
				display: "flex",
				flexDirection: "row",
			},
			":not(.invalid) textarea:focus ~ .bottom .border-bottom": {
				backgroundColor: "var(--accent-color)",
			},
			".clear-icon:before": {
				content: '"\\f00d"',
				fontFamily: "var(--font-icon-solid)",
				fontSize: "1.2rem",
				padding: "0 0.25rem",
				height: "100%",
				display: "block",
				color: "var(--divider-color)",
				cursor: "pointer",
			},
			'input[type="password"] ~ .show-icon:before': {
				content: '"\\f06e"',
				fontFamily: "var(--font-icon-solid)",
				fontSize: "1.2rem",
				padding: "0 0.25rem",
				height: "100%",
				display: "block",
				color: "var(--divider-color)",
				cursor: "pointer",
			},
			'input:not([type="password"]) ~ .show-icon:before': {
				content: '"\\f070"',
				fontFamily: "var(--font-icon-solid)",
				fontSize: "1.2rem",
				padding: "0 0.25rem",
				height: "100%",
				display: "block",
				color: "var(--divider-color)",
				cursor: "pointer",
			},
			".icon": {
				fontFamily: "var(--font-icon-solid)",
				fontSize: "1.5rem",
				padding: "0.25rem",
			},
		});
		this.shadowRoot.append(this.$container);

		this.displayed = true;
		this.updateAttributes();
	}
	setValidator(validator) {
		if (!validator) return this;

		if (typeof validator === "string") {
			let { exp, flags } = /^(?:\/)(?<exp>.+)(?:\/)(?<flags>g?m?i?y?u?s?d?)$/g.exec(validator)?.groups || {};
			if (!exp) return this;
			validator = new RegExp(exp, flags);
		}

		if (validator instanceof RegExp) validator = RegExp.prototype.test.bind(validator);
		else if (typeof validator !== "function") return this;

		this.validator = validator;
		return this;
	}
	clear({ focus = true } = {}) {
		this.$textarea.value = "";
		this.dispatch();
		if (focus) this.$textarea.focus();
	}
	togglePassword() {
		if (this.$textarea.getAttribute("type") === "password") this.$textarea.setAttribute("type", "text");
		else this.$textarea.setAttribute("type", "password");
	}
	dispatch() {
		let changeEvent = new Event("change");
		let inputEvent = new Event("input");
		changeEvent.value = inputEvent.value = this.$textarea.value;
		this.dispatchEvent(changeEvent);
		this.dispatchEvent(inputEvent);
	}
};
SAHYG.Components.Loader = class Loader extends HTMLElement {
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
			String(this.getAttribute("loading-text")) === "true"
				? SAHYG.createElement("div", { class: "status" }, await SAHYG.translate("LOADING"))
				: null
		);
	}
	static center() {
		let loader = SAHYG.createElement("sahyg-loader");
		document.body.append(loader);
		loader.shadowRoot.prepend(SAHYG.createElement("sahyg-backdrop"));
		loader.shadowRoot.setStyle({
			".svg-container": {
				position: "fixed",
				top: "50%",
				left: "50%",
			},
			"sahyg-backdrop": {
				position: "fixed",
				width: "100%",
				height: "100%",
				top: "0",
				left: "0",
				backgroundColor: " var(--backdrop-color)",
			},
		});
		return loader;
	}
};
SAHYG.Components.InputColor = class InputColor extends HTMLElement {
	connectedCallback() {
		this.openShadow();

		this.$input = SAHYG.createElement("input", {
			type: "color",
			value: this.getAttribute("value") || this.getAttribute("default-value"),
		}).on("input", () => {
			this.value = this.$input.value;
			this.setAttribute("value", this.$input.value);
			this.$input.setAttribute("value", this.$input.value);
		});

		this.$input.setAttribute("value", this.$input.getAttribute("value"));

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
SAHYG.Components.Tabs = class Tabs extends HTMLElement {
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
					SAHYG.createElement(
						"div",
						{
							class: "tab" + (this.currentOpened === tab.id ? " opened" : ""),
							"tab-id": tab.id,
						},
						tab.text
					).on("click", this.open.bind(this, tab.id))
				)
			)
		);
		this.waitLoaded(':scope > [sahyg-tab="' + this.currentOpened + '"]').then((target) => target.addClass("opened"));

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
		if (this.currentOpened === id) return;

		this.$tabs.$(":scope > .tabs > [tab-id].opened").removeClass("opened");
		this.$tabs.$0(`:scope > .tabs > [tab-id="${id}"]`)?.addClass("opened");

		this.$(":scope > [sahyg-tab]").removeClass("opened");
		this.$0(`:scope > [sahyg-tab="${id}"]`)?.addClass("opened");

		this.currentOpened = id;
		if (this.id) SAHYG.Utils.url.setLocationParam(this.id, id);

		this.closeMenu();
	}
};
SAHYG.Components.Cropper = class Cropper extends HTMLElement {
	connectedCallback() {
		this.openShadow();

		this.url = this.getAttribute("url") || "";
		this.minWidth = Number(this.getAttribute("minWidth") || 50);

		this.$overlay = SAHYG.createElement(
			"div",
			{ class: "overlay" },
			(this.$overlayImage = SAHYG.createElement("img", {
				src: this.url,
				draggable: false,
				crossorigin: "anonymous",
			}))
		)
			.on("mousedown", this.startMove.bind(this))
			.on("mouseup", () => (this.onPinch = this.onDrag = false))
			.on("touchstart", this.startMove.bind(this))
			.on("touchend", () => (this.onPinch = this.onDrag = false));
		this.$image = SAHYG.createElement("img", {
			src: this.url,
			draggable: false,
			crossorigin: "anonymous",
		});

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
		let canvas = SAHYG.createElement("canvas", {
			width: this.$overlay.clientWidth,
			height: this.$overlay.clientHeight,
		});
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
SAHYG.Components.Dialog = class Dialog extends HTMLElement {
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
		this.$container = SAHYG.createElement("div", { class: "container" }, this.$backdrop, this.$dialog);
	}
	async connectedCallback() {
		this.openShadow();
		this.shadowRoot.setStyle({
			".container": {
				"--dialog-header-height": "4rem",
				"--dialog-footer-height": "4rem",
				"--dialog-header-background": "var(--background-tertiary-color)",
				"--dialog-body-background": "var(--background-color)",
				"--dialog-footer-background": "var(--background-secondary-color)",
				"--dialog-min-height": "15rem",
				"--dialog-min-width": "25rem",
				"--dialog-max-width": "50rem",
				"--dialog-max-height": "40rem",
				"--dialog-header-font-size": "2rem",
				position: "fixed",
				top: "0",
				left: "0",
				height: "100%",
				width: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			},
			".dialog": {
				minHeight: "min(var(--dialog-min-height), 100%)",
				minWidth: "min(var(--dialog-min-width), 100%)",
				maxHeight: "min(var(--dialog-max-height), 100%)",
				maxWidth: "min(var(--dialog-max-width), 100%)",
				backgroundColor: "var(--dialog-body-background)",
				// borderRadius: "0.5rem",
				// overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				boxShadow: "0px 0px 5px 0px var(--background-color)",
				animation: "dialog-scale 200ms ease-in-out normal forwards",
				zIndex: "100",
				borderRadius: "0.5rem",
			},
			".header": {
				width: "100%",
				minHeight: "var(--dialog-header-height)",
				backgroundColor: "var(--dialog-header-background)",
				padding: "1.5rem 1.5rem 1rem 1.5rem",
				fontSize: "1.3rem",
				fontWeight: "bold",
				borderRadius: "0.5rem 0.5rem 0 0",
			},
			":not([body-borderless]) > .dialog > .body": {
				padding: "1rem",
				overflowY: "scroll",
			},
			".body": {
				flex: "1",
			},
			".footer": {
				backgroundColor: "var(--dialog-footer-background)",
				height: "var(--dialog-footer-height)",
				display: "flex",
				alignItems: "center",
				justifyContent: "flex-end",
				padding: "0.5rem 1rem 0.5rem 1rem",
				borderRadius: "0 0 0.5rem 0.5rem",
			},
			"@keyframes dialog-scale": {
				"0%": {
					transform: "scale(0.9)",
				},
				"100%": {
					transform: "scale(1)",
				},
			},
		});
		await this.preConnectedCallback();

		if (!this.displayed) return void this.remove();

		if (!this.buttons.length) await this.generateDefaultButtons();
		if (!this.content) this.$body.text((this.content = this.getAttribute("content") || ""));
		if (!this.header) this.$header.text((this.header = this.getAttribute("header") || (await SAHYG.translate("INFORMATION"))));

		this.shadowRoot.append(this.$container);
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
	setTitle(header) {
		this.header = header;
		this.$header.text(header);
		return this;
	}
	setHeader(header) {
		this.header = header;
		this.$header.text(header);
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

		let closedEvent = new Event("closed");
		this.dispatchEvent(closedEvent);

		return this;
	}
	addButton({ text, options = {}, callback = () => {}, position, closeOnClick = true }) {
		let boundCallback = async function (event) {
			await callback.call(null, event);
			if (closeOnClick) this.close();
		}.bind(this);

		let button = {
			text,
			callback: boundCallback,
			position,
			closeOnClick,
			$: SAHYG.createElement("sahyg-button", { value: text, ...options }).on("click", boundCallback),
		};
		if (position instanceof Number) this.buttons.splice(position, 0, button);
		else this.buttons.push(button);

		this.updateButton();

		return this;
	}
	addButtons(buttons) {
		buttons.forEach((button) => this.addButton(button));
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
SAHYG.Components.ConfirmDialog = class ConfirmDialog extends SAHYG.Components.Dialog {
	extends = "sahyg-dialog";
	constructor() {
		super();
	}
	async preConnectedCallback() {
		this.setTitle(await SAHYG.translate("CONFIRM"));
		this.addButton({
			text: await SAHYG.translate("CONFIRM"),
			options: {
				fullColor: true,
			},
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
SAHYG.Components.AlertDialog = class AlertDialog extends SAHYG.Components.Dialog {
	extends = "sahyg-dialog";
	constructor() {
		super();
	}
	async preConnectedCallback() {
		this.setTitle("⚠️ " + (await SAHYG.translate("ALERT")));
	}
};
SAHYG.Components.CropperDialog = class CropperDialog extends SAHYG.Components.Dialog {
	extends = "sahyg-dialog";
	constructor() {
		super();
	}
	async preConnectedCallback() {
		this.imgURL = this.getAttribute("image");
		this.ratio = this.getAttribute("ratio");

		if (!this.imgURL) throw new Error("Image URL not specified");

		this.cropper = SAHYG.createElement("sahyg-cropper", {
			url: this.imgURL,
			ratio: this.ratio,
		});

		this.setTitle(await SAHYG.translate("CROP"))
			.addButton({
				text: await SAHYG.translate("SUBMIT"),
				style: "full",
				callback: this.valid.bind(this),
			})
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
SAHYG.Components.InputDialog = class InputDialog extends SAHYG.Components.Dialog {
	extends = "sahyg-dialog";
	constructor() {
		super();
	}
	async preConnectedCallback() {
		this.inputs = JSON.parse(this.getAttribute("inputs"));

		if (!this.inputs instanceof Array) this.inputs = [this.inputs];

		this.$bodyContainer = SAHYG.createElement("div", {
			class: "body-container",
		});
		for (let input of this.inputs) {
			input.value = input.defaultValue;
			input.$informations = SAHYG.createElement(
				"div",
				{ class: "informations" },
				(input.$title = SAHYG.createElement("span", { class: "title" }, input.label || input.title)),
				(input.$description = SAHYG.createElement("span", { class: "description" }, input.description))
			).on("click", () => input.$input?.focus());

			switch (input.type) {
				case "text":
				case "email":
				case "url": {
					switch (input.type) {
						case "url": {
							input.icon = String.fromCharCode(0xf0c1);
							break;
						}
						case "email": {
							input.icon = String.fromCharCode(0xf1fa);
							break;
						}
					}

					input.$input = SAHYG.createElement("sahyg-textarea", {
						multiline: false,
						defaultValue: input.value,
						id: input.id,
						icon: input.icon,
						...input.options,
					}).on("input", (event) => (input.value = event.target.value));
					break;
				}
				case "textarea": {
					input.$input = SAHYG.createElement("sahyg-textarea", {
						multiline: true,
						defaultValue: input.value,
						id: input.id,
						...input.options,
					}).on("input", (event) => (input.value = event.target.value));
					break;
				}
				case "selectOne":
				case "select": {
					input.$input = SAHYG.createElement("sahyg-select", {
						selected: input.defaultValue,
						...(input.options || {}),
					}).on("input", (event) => (input.value = input.$input.selected));
					break;
				}
				case "switch":
				case "boolean": {
					input.$input = SAHYG.createElement("sahyg-switch", {
						value: input.defaultValue,
						...(input.options || {}),
					}).on("input", (event) => (input.value = input.$input.value));
					break;
				}
				case "list": {
					input.$input = SAHYG.createElement("sahyg-input-list", {
						values: input.defaultValue,
						...(input.options || {}),
					}).on("input", (event) => (input.value = input.$input.values?.map((val) => val.value) || []));
					break;
				}
				case "array": {
					input.$input = SAHYG.createElement("sahyg-input-array", {
						values: input.defaultValue,
						columns: input.columns,
						...(input.options || {}),
					});
					break;
				}
				case "staticText": {
					if (!(input.label || input.title || input.description)) input.$description.text(input.text);
					input.value = input.defaultValue = null;
					input.id = Math.random().toString(32).substring(2, 10);
					break;
				}
			}

			input.$ = SAHYG.createElement(
				"div",
				{
					class: "input",
					inline: input.inline || "false",
					singleLine: input.singleLine || "false",
				},
				input.$informations,
				(input.$inputContainer = SAHYG.createElement("div", { class: "input-container" }, input.$input))
			);
			this.$bodyContainer.append(input.$);
		}

		this.setContent(this.$bodyContainer);
		if (this.getAttribute("no-buttons") !== "true")
			this.addButtons([
				{
					text: await SAHYG.translate("OK"),
					callback: this.submit.bind(this),
					options: { fullColor: true },
				},
				{
					text: await SAHYG.translate("CANCEL"),
					callback: this.close.bind(this),
				},
			]);

		this.shadowRoot.setStyle({
			".body-container": {
				display: "flex",
				flexDirection: "row",
				flexWrap: "wrap",
				gap: "1rem",
			},
			'.input[inline]:not([inline="false"])': {
				flexGrow: "1",
			},
			'.input:is([inline="false"], :not([inline]))': {
				width: "100%",
			},
			'.input[single-line="true"]': {
				display: "flex",
				flexDirection: "row",
			},
			'.input[single-line="true"] .input-container': {
				flexGrow: "1",
				display: "flex",
				flexDirection: "row",
				justifyContent: "flex-end",
			},
			".informations": {
				display: "flex",
				flexDirection: "column",
				marginBottom: "0.5rem",
			},
			".informations .title": {
				fontWeight: "bold",
			},
		});
	}
	toPromise() {
		return new Promise(
			(resolve) =>
				(this.promise = {
					resolve: function () {
						resolve(...arguments);
						this.promise = null;
					},
				})
		);
	}
	submit() {
		let changed = this.inputs.map((input) => [input.id, input.value != input.defaultValue]);

		if (changed.some((input) => input[1])) {
			if (this.promise)
				this.promise.resolve({
					changed: Object.fromEntries(changed),
					data: Object.fromEntries(this.inputs.map((input) => [input.id, input.value])),
				});
			return;
		}
		this.close();
	}
	close() {
		this.remove();
		this.displayed = false;

		let closedEvent = new Event("closed");
		this.dispatchEvent(closedEvent);

		if (this.promise) this.promise.resolve(null);

		return this;
	}
};
SAHYG.Components.Toast = class Toast extends HTMLElement {
	static get observedAttributes() {
		return ["content", "timeout", "icon", "type", "color", "show"];
	}
	attributeChangedCallback(name, oldValue, newValue) {
		if (name === "show" && newValue) return this.show();
		else if (!this.displayed) return;

		switch (name) {
			case "content": {
				this.setContent(newValue);
				break;
			}
			case "timeout": {
				this.setTimeout(newValue);
				break;
			}
			case "icon": {
				this.setIcon(newValue);
				break;
			}
			case "type": {
				this.setType(newValue);
				break;
			}
			case "color": {
				this.setColor(newValue);
			}
		}
	}
	connectedCallback() {
		this.openShadow();

		this.$icon = SAHYG.createElement("div", { class: "icon" });
		this.$body = SAHYG.createElement("div", { class: "body" });
		this.$close = SAHYG.createElement("div", { class: "close" }, String.fromCharCode(0xf00d)).on("click", this.close.bind(this));
		this.$toastContent = SAHYG.createElement("div", { class: "toast-content" }, this.$icon, this.$body, this.$close);
		this.$progressBar = SAHYG.createElement("div", { class: "progress-bar" });
		this.$progressBarContainer = SAHYG.createElement("div", { class: "progress-bar-container" }, this.$progressBar);
		this.$toast = SAHYG.createElement("div", { class: "toast" }, this.$toastContent, this.$progressBarContainer)
			.on("mouseenter", this.pauseTimeout.bind(this))
			.on("mouseleave", this.resumeTimeout.bind(this));

		this.shadowRoot.append(this.$toast);
		this.shadowRoot.setStyle({
			".toast": {
				display: "flex",
				flexDirection: "column",
				background: "var(--background-tertiary-color)",
				borderRadius: "0.5rem",
				overflow: "hidden",
				animation: "toast-slide-in 100ms",
			},
			".toast.close": {
				transition: "transform 100ms linear",
				transform: "translateY(-100%)",
			},
			".toast-content": {
				display: "flex",
				flexDirection: "row",
				padding: "1rem 1rem calc(1rem - 3px) 1rem",
				alignItems: "center",
				columnGap: "0.75rem",
			},
			".icon": {
				fontFamily: "var(--font-icon-solid)",
				fontSize: "1.5rem",
				padding: "0.5rem",
				borderRadius: "100%",
				backgroundColor: "#0055b9",
				// width: "1.5rem",
				// height: "1.5rem",
				userSelect: "none",
			},
			".body": {
				flex: "1",
				textOverflow: "ellipsis",
				overflow: "hidden",
			},
			".close": {
				fontFamily: "var(--font-icon-solid)",
				cursor: "pointer",
				userSelect: "none",
			},
			".progress-bar": {
				width: "100%",
				height: "3px",
				animationName: "toast-progress-bar",
				animationDirection: "normal",
				animationFillMode: "forwards",
				animationIterationCount: "1",
				animationTimingFunction: "linear",
				backgroundColor: "var(--accent-color)",
			},
			"@keyframes toast-progress-bar": {
				"0%": {
					width: "0%",
				},
				"100%": {
					width: "100%",
				},
			},
			"@keyframes toast-slide-in": {
				"0%": {
					transform: "translateX(100%)",
				},
				"100%": {
					transform: "translateX(0%)",
				},
			},
		});

		this.setTimeout(this.getAttribute("timeout"));
		this.setContent(this.getAttribute("content"));

		let type = this.getAttribute("type"),
			icon = this.getAttribute("icon"),
			color = this.getAttribute("color");
		if (type) this.setType(type);
		if (icon) this.setIcon(icon);
		else this.updateIcon();
		if (color) this.setColor(color);
		else this.updateColor();

		this.displayed = true;

		this.lastPause = Date.now();
		this.timeRemain = this.timeout;
		this.timeoutId = setTimeout(this.close.bind(this), this.timeout);
	}
	updateContent() {
		this.$body.text(this.content);
		return this;
	}
	updateTimeout() {
		if (!this.displayed) {
			this.$progressBar.style.animationDuration = this.timeout + "ms";
			return this;
		}

		let now = Date.now();
		this.timeRemain = this.timeout - (now - this.lastPause);
		this.lastPause = now;

		let currentState = (1 - this.timeRemain / this.timeout).toFixed(2);

		if (currentState >= 1) {
			this.close();
			return this;
		}

		this.$progressBar.style.animationDuration = this.timeout + "ms";
		this.$progressBar.style.animationDelay = `-${this.timeout * currentState}ms`;

		clearTimeout(this.timeoutId);
		this.timeoutId = setTimeout(this.close.bind(this), this.timeRemain);
		return this;
	}
	pauseTimeout() {
		this.$progressBar.style.animationPlayState = "paused";

		this.timeRemain = this.timeRemain - (Date.now() - this.lastPause);

		clearTimeout(this.timeoutId);
		return this;
	}
	resumeTimeout() {
		this.$progressBar.style.animationPlayState = "running";

		this.lastPause = Date.now();

		this.timeoutId = setTimeout(this.close.bind(this), this.timeRemain);
		return this;
	}
	updateIcon() {
		if (!this.icon) return this.setIcon();
		this.$icon.text(this.icon);
		return this;
	}
	updateColor() {
		if (!this.color) return this.setColor();
		this.$icon.style.backgroundColor = this.color;
		this.$icon.style.boxShadow = "0 0 3px 0 " + this.color;
		return this;
	}
	setContent(content) {
		this.content = content || "";
		this.updateContent();
		return this;
	}
	setTimeout(timeout) {
		this.timeout = Number(timeout) || 5000;
		this.updateTimeout();
		return this;
	}
	setIcon(icon) {
		if (!icon) icon = "information";
		switch (icon) {
			case "information":
			case "info": {
				this.icon = String.fromCharCode(0xf129);
				break;
			}
			case "warn":
			case "warning": {
				this.icon = String.fromCharCode(0xf071);
				break;
			}
			case "error":
			case "danger": {
				this.icon = String.fromCharCode(0xf12a);
				break;
			}
			case "ok":
			case "success": {
				this.icon = String.fromCharCode(0xf00c);
				break;
			}
			default: {
				if (/^&#xf[0-9a-z]{3};$/.test(icon)) this.icon = String.fromCharCode(parseInt(icon.match(/(?<=^&#x)f[0-9a-z]{3}(?=;$)/)));
				else {
					let code = icon.charCodeAt(0);
					if (0xf000 >= code && code <= 0xffff) this.icon = String.fromCharCode(icon);
				}
				break;
			}
		}
		this.updateIcon();
		return this;
	}
	setColor(color) {
		if (!color) color = "information";
		switch (color) {
			case "info":
			case "information": {
				this.color = "var(--accent-color)";
				break;
			}
			case "warn":
			case "warning": {
				this.color = "var(--warning-color)";
				break;
			}
			case "error":
			case "danger": {
				this.color = "var(--danger-color)";
				break;
			}
			case "ok":
			case "success": {
				this.color = "var(--success-color)";
				break;
			}
			default: {
				this.color = "var(--accent-color)";
				break;
			}
		}
		this.updateColor();
		return this;
	}
	setType(type) {
		if (!type) type = "information";
		this.type = type;
		this.setIcon(type);
		this.setColor(type);
		return this;
	}
	show() {
		let toastsContainer = SAHYG.$0("sahyg-toasts");
		if (!toastsContainer) {
			toastsContainer = SAHYG.createElement("sahyg-toasts");
			document.body.append(toastsContainer);
		}
		toastsContainer.append(this);

		return this;
	}
	close() {
		this.$toast.addClass("close");
		if (this.timeoutId) clearTimeout(this.timeoutId);
		setTimeout(() => {
			this.displayed = false;
			this.remove();
			if (this.promise) this.promise.resolve();
		}, 100);
		return this;
	}
	toPromise() {
		return new Promise((resolve, reject) => (this.promise = { resolve, reject }));
	}
};
SAHYG.Components.UserTooltip = class UserTooltip extends HTMLElement {
	async connectedCallback() {
		this.openShadow();

		this.avatar = this.getAttribute("avatar");
		this.username = this.getAttribute("username");
		this.certified = this.getAttribute("certified");
		this.group = this.getAttribute("group");

		this.$avatar = this.avatar
			? SAHYG.createElement("img", { class: "avatar", src: this.avatar })
			: SAHYG.createElement("span", { class: "avatar" }, String.fromCharCode(0xf007));
		this.$username = SAHYG.createElement("span", { class: "username" }, this.username);
		this.$certified = this.certified && SAHYG.createElement("span", { class: "certified" }, String.fromCharCode(0xf0a3));
		this.$group =
			["owner", "administrator", "vip"].includes(this.group) &&
			SAHYG.createElement(
				"span",
				{ class: "group " + this.group },
				String.fromCharCode(this.group === "owner" ? 0xf521 : this.group === "administrator" ? 0xf7d9 : 0xf005)
			);
		this.$badges = SAHYG.createElement("div", { class: "badges" }, this.$certified, this.$group);
		this.$informations = SAHYG.createElement("div", { class: "informations" }, this.$username, this.$badges);

		this.$container = SAHYG.createElement("div", { class: "container" }, this.$avatar, this.$informations);

		this.shadowRoot.append(this.$container);
		this.shadowRoot.setStyle({
			".container": {
				display: "flex",
				MsFlexDirection: "row",
				flexDirection: "row",
				alignItems: "center",
				columnGap: "1rem",
				padding: "0.5rem",
			},
			".avatar": {
				height: "4rem",
				width: "4rem",
				borderRadius: "50%",
			},
			".avatar:after": {
				content: "\f007",
				position: "absolute",
				top: "0",
				left: "0",
				bottom: "0",
				right: "0",
				backgroundColor: "var(--tooltip-background-color)",
				color: "var(--tooltip-text-color)",
				display: "flex",
				width: "2rem",
				height: "2rem",
				fontFamily: "var(--font-icon-solid)",
				fontSize: "2rem",
				alignItems: "center",
				justifyContent: "center",
			},
			".username": {
				fontSize: "1.5rem",
			},
			".badges": {
				display: "flex",
				alignItems: "center",
			},
			".badges span": {
				fontSize: "1.2rem",
				fontFamily: "var(--font-icon-solid)",
			},
			".certified": {
				color: "var(--green-700)",
			},
			".group.owner": {
				color: "var(--yellow-600)",
			},
			".group.administrator": {
				color: "var(--red-600)",
			},
			".group.vip": {
				color: "var(--blue-600)",
			},
		});
	}
};
SAHYG.Components.Button = class Button extends HTMLElement {
	constructor() {
		super();

		this.on(
			"click",
			function () {
				if (this.getAttribute("type") === "submit" && this.isConnected) {
					let form = this.closest("form");
					if (form) form.dispatchEvent(new Event("submit"));
				}
			}.bind(this)
		);
	}
	static get observedAttributes() {
		return ["icon", "content", "full-color", "disabled", "full-width", "underline"];
	}
	attributeChangedCallback(name, oldValue, newValue) {
		if (!this.displayed) return;
		switch (name) {
			case "icon": {
				this.setIcon(newValue);
				break;
			}
			case "content": {
				this.setContent(newValue);
				break;
			}
			case "disabled": {
				this.updateState();
				break;
			}
			case "outline":
			case "rounded":
			case "underline":
			case "full-color":
			case "full-width": {
				this.updateClasses();
				break;
			}
			case "icon-min-width":
			case "content-min-width": {
				this.updateCssRules();
			}
		}
	}
	connectedCallback() {
		this.openShadow();

		this.shadowRoot.setStyle({
			".button": {
				alignItems: "center",
				backgroundColor: "transparent",
				borderRadius: "0.375rem",
				cursor: "pointer",
				display: "inline-flex",
				fontSize: "0.875rem",
				fontWeight: "600",
				height: "2.375rem",
				justifyContent: "center",
				lineHeight: "2.375rem",
				margin: "0",
				padding: "0 0.75rem",
				WebkitUserSelect: "none",
				MozUserSelect: "none",
				MsUserSelect: "none",
				userSelect: "none",
				whiteSpace: "nowrap",
				color: "inherit",
				fontFamily: "inherit",
				textTransform: "none",
			},
			".button.rounded": {
				border: "1px solid var(--accent-color)",
				borderRadius: "0.375rem",
			},
			".button.full-color": {
				backgroundColor: "var(--accent-color)",
				color: "var(--background-color)",
			},
			".button.full-width": {
				width: "100%",
			},
			".button:is(.underline, .un)": {
				border: "none",
				borderBottom: "1px solid var(--accent-color)",
				borderRadius: "0",
			},
			".button.disabled": {
				backgroundColor: "var(--disabled-button-color)",
				cursor: "not-allowed",
			},
			".icon:not(:empty)": {
				fontFamily: "var(--font-icon-solid)",
				marginRight: "0.25rem",
				fontSize: "1.2rem",
			},
			".content:empty": {
				display: "none",
			},
			".icon:has( ~ .content:empty)": {
				marginRight: 0,
			},
		});

		this.$icon = SAHYG.createElement("div", { class: "icon" });
		this.$content = SAHYG.createElement("div", { class: "content" });
		this.$button = SAHYG.createElement("div", { class: "button" }, this.$icon, this.$content);

		this.setContent(this.getAttribute("content") || this.getAttribute("value"));
		this.setIcon(this.getAttribute("icon"));

		this.updateState();
		this.updateClasses();
		this.updateCssRules();

		this.shadowRoot.append(this.$button);
		this.displayed = true;
	}
	updateState() {
		this.disabled = this.getAttribute("disabled");
		if (this.disabled && this.disabled !== "false") this.disable();
		else this.enable();
	}
	updateClasses() {
		this.fullColor = String(this.getAttribute("full-color"));
		this.fullWidth = String(this.getAttribute("full-width"));
		this.underline = String(this.getAttribute("underline"));
		this.rounded = String(this.getAttribute("rounded"));
		this.outline = String(this.getAttribute("outline"));
		if (this.fullColor === "true") this.$button.addClass("full-color");
		if (this.fullWidth === "true") this.$button.addClass("full-width");
		if (this.underline === "true") this.$button.addClass("underline");
		if (this.rounded === "true") this.$button.addClass("rounded");
		if (this.outline === "true") this.$button.addClass("outline");
	}
	updateCssRules() {
		if (this.cssRules) this.cssRules.remove();

		this.iconMinWidth = this.getAttribute("icon-min-width");
		this.contentMinWidth = this.getAttribute("content-min-width");
		if (Number(this.iconMinWidth)) this.iconMinWidth = this.iconMinWidth + "px";
		if (Number(this.contentMinWidth)) this.contentMinWidth = this.contentMinWidth + "px";

		let css = {};
		if (this.iconMinWidth)
			css[`@media screen and (max-width: ${this.iconMinWidth})`] = {
				".icon": {
					display: "none",
				},
			};
		if (this.contentMinWidth)
			css[`@media screen and (max-width: ${this.contentMinWidth})`] = {
				".content": {
					display: "none",
				},
			};

		this.cssRules = this.shadowRoot.setStyle(css);
	}
	setContent(content) {
		if (!content) return this;
		this.content = content;
		this.$content.clear();
		this.$content.append(content);
		return this;
	}
	setIcon(icon) {
		if (!icon) return this;
		this.icon = icon;
		this.$icon.text(icon);
		return this;
	}
	disable() {
		this.$button.addClass("disabled");
	}
	enable() {
		this.$button.removeClass("disabled");
	}
};
SAHYG.Components.Backdrop = class Backdrop extends HTMLElement {
	connectedCallback() {
		this.openShadow();

		this.shadowRoot.setStyle({
			".backdrop": {
				position: "fixed",
				width: "100%",
				height: "100%",
				top: 0,
				left: 0,
				backgroundColor: "#000000",
				zIndex: 99,
				opacity: this.getAttribute("opacity") || 0.25,
			},
		});

		this.shadowRoot.append(SAHYG.createElement("div", { class: "backdrop" }));
	}
};
SAHYG.Components.Viewer = class Viewer extends HTMLElement {
	maxNameLength = 15;
	async connectedCallback() {
		this.openShadow();

		this.src = this.getAttribute("src");
		this.name = this.width = this.height = this.extension = this.fileSize = null;

		this.$backdrop = SAHYG.createElement("sahyg-backdrop", {
			opacity: 0.75,
		}).on("click", this.close.bind(this));
		this.$name = SAHYG.createElement("span", { class: "name" });
		this.$imageSize = SAHYG.createElement("span", { class: "image-size" });
		this.$fileSize = SAHYG.createElement("span", { class: "file-size" });
		this.$extension = SAHYG.createElement("span", { class: "extension" });
		this.$open = SAHYG.createElement("a", { href: this.src, target: "_blank" });
		this.$informations = SAHYG.createElement(
			"div",
			{ class: "informations" },
			this.$name,
			this.$imageSize,
			this.$fileSize,
			this.$extension,
			this.$open
		);
		this.$imageContainer = SAHYG.createElement("div", { class: "image-container" }, SAHYG.createElement("sahyg-loader"));
		this.$closeButton = SAHYG.createElement("div", { class: "close" }, String.fromCharCode(0xf00d)).on("click", this.close.bind(this));
		this.$container = SAHYG.createElement("div", { class: "container" }, this.$backdrop, this.$imageContainer, this.$closeButton);

		this.shadowRoot.setStyle({
			".container": {
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				position: "fixed",
				top: "0",
				left: "0",
				width: "100vw",
				height: "100vh",
				justifyContent: "center",
				WebkitUserSelect: "none",
				MozUserSelect: "none",
				MsUserSelect: "none",
				userSelect: "none",
				zIndex: "98",
			},
			".image-container": {
				zIndex: "100",
				width: "min(80vw, 80vh)",
				height: "min(80vw, 80vh)",
				display: "flex",
				flexDirection: "column",
			},
			img: {
				width: "min(80vw, 80vh)",
				height: "auto",
				margin: "auto",
				cursor: "zoom-in",
			},
			"img.large": {
				cursor: "zoom-out",
			},
			".informations > :is(span, a):empty": {
				display: "none",
			},
			".informations > span:not(:last-child):after": {
				content: '"|"',
				margin: "0 0.5rem",
			},
			".informations :is(a, a:visited)": {
				color: "var(--color-primary-text)",
			},
			".close": {
				position: "fixed",
				top: "1rem",
				right: "1rem",
				fontSize: "2rem",
				fontFamily: "var(--font-icon-solid)",
				zIndex: 100,
				cursor: "pointer",
				padding: "0.5rem",
				borderRadius: "100%",
				transition: "var(--transition)",
			},
			".close:hover": {
				backgroundColor: "var(--accent-color)",
			},
		});
		this.shadowRoot.append(this.$container);

		this.blob = await (await fetch(this.src)).blob();
		if (this.blob.size === 0) this.$image = await SAHYG.translate("IMAGE_NOT_LOADED");
		else {
			this.$image = new Image();
			this.$image.src = URL.createObjectURL(this.blob);
			await this.$image.decode();
			this.$image.style.width = this.$image.width + "px";

			this.width = this.$image.width;
			this.height = this.$image.height;
			this.name = this.getAttribute("name") || decodeURI(this.src).split("/").pop();
			this.fileSize = SAHYG.Utils.units.formatOctets(this.blob.size);
			this.extension = this.name.match(/(?<=\.)\w+$/)?.[0]?.toLowerCase() || this.blob.type.split("/").pop().toUpperCase();
			if (this.name.length > this.maxNameLength) {
				if (this.extension) this.name = this.name.substring(0, this.maxNameLength - 3 - this.extension.length) + "..." + this.extension;
				else this.name = this.name.substring(0, this.maxNameLength - 3) + "...";
			}

			this.$imageContainer.clear();
			this.$imageContainer.append(this.$image, this.$informations);
			this.$name.text(this.name);
			this.width && this.height && this.$imageSize.text(`${this.width}x${this.height}`);
			this.$fileSize.text(this.fileSize);
			this.$extension.text(this.extension);
			this.$open.text = await SAHYG.translate("OPEN_ORIGINAL");

			this.$image.on("click", this.toggleZoom.bind(this));
		}
	}
	toggleZoom() {
		if (this.$image.hasClass("large")) {
			this.$image.style.width = this.width + "px";
			this.$image.removeClass("large");
		} else {
			this.$image.style.width = "";
			this.$image.addClass("large");
		}
	}
	show() {
		document.body.append(this);
	}
	close() {
		this.remove();
	}
};
SAHYG.Components.Switch = class Switch extends HTMLElement {
	connectedCallback() {
		this.value = String(this.getAttribute("value")) === "true";

		this.openShadow();
		this.shadowRoot.setStyle({
			".switch": {
				width: "3.5rem",
				height: "2rem",
				backgroundColor: "var(--background-tertiary-color)",
				borderRadius: "1rem",
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "flex-start",
				padding: "0.25rem",
				cursor: "pointer",
				position: "relative",
			},
			".circle": {
				width: "1.5rem",
				height: "1.5rem",
				backgroundColor: "var(--accent-color)",
				borderRadius: "100%",
				position: "relative",
				transition: "var(--transition)",
				left: "0rem",
			},
			'.switch[value="true"] .circle': {
				left: "1.5rem",
			},
		});

		this.$circle = SAHYG.createElement("div", { class: "circle" });
		this.$switch = SAHYG.createElement("div", { class: "switch", value: JSON.stringify(this.value) }, this.$circle);
		this.shadowRoot.append(this.$switch);

		this.on("click", this.clickHandler.bind(this));

		this.loaded = true;
	}
	clickHandler(event) {
		if (this.value) this.switchOff();
		else this.switchOn();
	}
	switchOff() {
		this.setAttribute("value", "false");
		this.$switch.setAttribute("value", "false");
		this.value = false;

		this.dispatchInputEvent();
	}
	switchOn() {
		this.setAttribute("value", "true");
		this.$switch.setAttribute("value", "true");
		this.value = true;

		this.dispatchInputEvent();
	}
	dispatchInputEvent() {
		let inputEvent = new Event("input"),
			changeEvent = new Event("change");

		this.dispatchEvent(inputEvent);
		this.dispatchEvent(changeEvent);
	}
};
SAHYG.Components.Menu = class Menu extends HTMLElement {
	static get observedAttributes() {
		return ["title", "content", "footer", "target", "position", "trigger"];
	}
	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;
		switch (name) {
			case "title": {
				this.setTitle(newValue);
				break;
			}
			case "content": {
				this.setContent(newValue);
				break;
			}
			case "footer": {
				this.setFooter(newValue);
				break;
			}
			case "target": {
				this.setTarget(newValue);
				break;
			}
			case "position": {
				this.setPosition(newValue);
				break;
			}
			case "trigger": {
				this.setTrigger(newValue);
				break;
			}
		}
	}
	updateOptions() {
		let title = this.getAttribute("title");
		if (title) this.setTitle(title);

		let content = this.getAttribute("content");
		if (content) this.setContent(content);

		let footer = this.getAttribute("footer");
		if (footer) this.setFooter(footer);

		let target = this.getAttribute("target");
		if (target) this.setTarget(target);

		let position = this.getAttribute("position");
		if (position) this.setPosition(position);

		let trigger = this.getAttribute("trigger");
		if (trigger) this.setTrigger(trigger);
	}
	constructor() {
		super();

		this.updateOptions();
		this.openShadow();

		this.$closeButton = SAHYG.createElement("div", { class: "close" }, String.fromCharCode(0xf00d)).on("click", this.close.bind(this));
		this.$title = SAHYG.createElement("div", { class: "title" }, this.title);
		this.$header = SAHYG.createElement("div", { class: "header" }, this.$closeButton, this.$title);
		this.$footer = SAHYG.createElement("div", { class: "footer" }, this.footer);
		this.$content = SAHYG.createElement("div", { class: "content" }, this.content);
		this.$body = SAHYG.createElement("div", { class: "body" }, this.$content, this.$footer);
		this.$menu = SAHYG.createElement("div", { class: "menu" }, this.$header, this.$body);
		this.$backdrop = SAHYG.createElement("sahyg-backdrop").on("click", this.close.bind(this)).on("click", this.close.bind(this));
		this.$container = SAHYG.createElement("div", { class: "container over" }, this.$backdrop, this.$menu);
	}
	connectedCallback() {
		this.shadowRoot.setStyle({
			".container:not(.opened)": {
				animation: "normal forwards var(--transition-duration) menu-slide-out-right",
			},
			":is(.container, .container.over):not(.opened)": {
				width: "0",
			},
			":is(.container, .container.over):not(.opened) sahyg-backdrop": {
				display: "none",
			},
			".container": {
				display: "flex",
				height: "calc(100vh - var(--header-height))",
				flexDirection: "row-reverse",
				animation: "normal forwards var(--transition-duration) menu-slide-in-right",
				transition: "width var(--transition)",
				"--menu-header-height": "4rem",
				overflowX: "hidden",
			},
			".container.over": {
				position: "absolute",
				bottom: "0",
				right: "0",
				width: "100vw",
				// backgroundColor: "var(--backdrop-color)",
				zIndex: "100",
				height: "100%",
			},
			".container.left": {
				flexDirection: "row",
			},
			".menu": {
				zIndex: "100",
				backgroundColor: "var(--background-tertiary-color)",
				resize: "horizontal",
				overflow: "hidden",
				direction: "rtl",
				minWidth: "min(25rem, calc(100vw - var(--scrollbar-width)))",
				height: "100%",
			},
			".container.left .menu": {
				direction: "ltr",
			},
			".container .header": {
				display: "flex",
				width: "100%",
				alignItems: "center",
				direction: "ltr",
				WebkitUserSelect: "none",
				MozUserSelect: "none",
				MsUserSelect: "none",
				userSelect: "none",
				height: "var(--menu-header-height)",
			},
			".container.left .header": {
				direction: "rtl",
			},
			".container .close": {
				fontFamily: "var(--font-icon-solid)",
				fontSize: "2rem",
				padding: "1rem",
				cursor: "pointer",
			},
			".container .title": {
				fontSize: "1.2rem",
				flexGrow: "1",
				padding: "0 1rem 0 0",
				overflow: "hidden",
				textOverflow: "ellipsis",
				direction: "ltr",
			},
			".container.left .title": {
				padding: "0 0 0 1rem",
			},
			".container .body": {
				overflowY: "scroll",
				direction: "ltr",
				maxHeight: "calc(100% - var(--menu-header-height))",
				minHeight: "calc(100% - var(--menu-header-height))",
				width: "100%",
			},
			"@keyframes menu-slide-in-right": {
				"0%": {
					display: "flex",
					right: "-100vw",
				},
				"100%": {
					right: "0",
				},
			},
			"@keyframes menu-slide-out-right": {
				"0%": {
					right: "0",
				},
				"100%": {
					right: "-100vw",
					pointerEvents: "none",
					WebkitTouchCallout: "none",
					WebkitUserSelect: "none",
					MozUserSelect: "none",
					MsUserSelect: "none",
					userSelect: "none",
				},
			},
		});
		this.shadowRoot.append(this.$container);
	}
	open() {
		if (!this.isConnected) this.mount();

		this.$container.addClass("opened");
		return this;
	}
	close() {
		this.$container.removeClass("opened");
		return this;
	}
	toggle() {
		if (this.isOpened()) this.close();
		else this.open();
		return this;
	}
	isOpened() {
		return this.$container.hasClass("opened");
	}
	mount() {
		this.target?.append(this);
		return this;
	}
	unmount() {
		this.target?.removeChild(this);
		return this;
	}
	setContent(content) {
		this.content = content;

		this.$content.clear();
		if (content instanceof Array) this.$content.append(...content);
		else this.$content.append(content);

		return this;
	}
	setFooter(footer) {
		this.footer = footer;

		this.$footer.clear();
		if (footer instanceof Array) this.$footer.append(...footer);
		else this.$footer.append(footer);

		return this;
	}
	setTitle(title) {
		this.title = title;
		this.$title.clear();
		this.$title.append(title);
		return this;
	}
	setTarget(target) {
		if (typeof target === "string") this.target = SAHYG.$0(target);
		else this.target = target || document.body;
		return this;
	}
	setPosition(position) {
		this.position = ["left", "right"].includes(position) ? position : "left";
		this.$container.setAttribute("position", position);
		return this;
	}
	setTrigger(trigger) {
		if (typeof trigger === "string") this.trigger = SAHYG.$0(trigger);
		else this.trigger = trigger;

		this.offTrigger?.();
		this.offTrigger = SAHYG.on("click", this.trigger, this.open.bind(this))?.off;
		return this;
	}
};
SAHYG.Components.TooltipTarget = class TooltipTarget extends HTMLElement {
	connectedCallback() {
		this.tippy = tippy(this, { content: this.getAttribute("content") });
	}
};
SAHYG.Components.Collapsable = class Collapsable extends HTMLElement {
	static get observedAttributes() {
		return ["name", "description", "opened"];
	}
	attributeChangedCallback(name, oldValue, newValue) {
		switch (name) {
			case "name": {
				this.name = newValue;
				break;
			}
			case "description": {
				this.description = newValue;
				break;
			}
			case "opened": {
				if (newValue === "true" || newValue === true) this.$(":scope > :not(.collapsable-header)").slideShow(200);
				else this.$(":scope > :not(.collapsable-header)").slideHide(200);
				break;
			}
		}
	}
	connectedCallback() {
		if (!this.getAttribute("opened")) this.setAttribute("opened", "true");

		this.name = this.getAttribute("name");
		this.description = this.getAttribute("description");

		this.$title = SAHYG.createElement("div", { class: "collapsable-name" }, this.name);
		this.$description = SAHYG.createElement("div", { class: "collapsable-description" }, this.description);
		this.$container = SAHYG.createElement("div", { class: "collapsable-header" }, this.$title, this.$description);

		this.$container.on("click", this.toggle.bind(this));

		this.prepend(this.$container);
	}
	collapse() {
		this.setAttribute("opened", "false");
	}
	expand() {
		this.setAttribute("opened", "true");
	}
	isOpened() {
		let opened = this.getAttribute("opened");
		return opened === "true" || opened === true;
	}
	toggle() {
		if (this.isOpened()) this.collapse();
		else this.expand();
	}
};

axios.interceptors.response.use(SAHYG.Api.responseInterceptor, SAHYG.Api.errorInterceptor);

Object.entries(SAHYG.Components).forEach(
	([name, element]) =>
		/[A-Z]/i.test(name) &&
		customElements.define("sahyg-" + SAHYG.Utils.text.camelToKebab(name).toLowerCase(), element, {
			extends: element.extends,
		})
);
if (localStorage.getItem("cookie_consent") === "true" || location.pathname.includes("about")) SAHYG.createAkeeInstance();

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
	if (this.style.display === "none") this.slideShow(...arguments);
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
	if (this.style.display === "none") this.show(...arguments);
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
HTMLElement.prototype.openShadow = function (options = []) {
	if (!this.shadowRoot) {
		this.attachShadow({ mode: "open" });
		let style = [
			{
				"*": {
					boxSizing: "border-box",
					fontFamily: "var(--font-main)",
				},
				"::-webkit-scrollbar": {
					height: "8px",
					width: "8px",
				},
				"::-webkit-scrollbar-thumb": {
					background: "rgba(26, 129, 250, 0.5)",
					borderRadius: "5px",
				},
				"::-webkit-scrollbar-thumb:hover": {
					background: "rgba(26, 129, 250, 0.7)",
				},
				"::selection": {
					backgroundColor: "var(--text-selection-background)",
					color: "var(--text-selection-text)",
				},
			},
		];
		if (options.includes("tippy"))
			style.push({
				'.tippy-box[data-animation="fade"][data-state="hidden"]': {
					opacity: "0",
				},
				".tippy-box": {
					position: "relative",
					backgroundColor: "var(--tooltip-background-primary-color)",
					borderRadius: "0.25rem",
					fontSize: "14px",
					lineHeight: "1.4",
					whiteSpace: "normal",
					outline: "0",
					transitionProperty: "transform, visibility, opacity",
					border: "1px solid var(--tooltip-border-color)",
					minWidth: "min-content",
					color: "var(--tooltip-text-color)",
				},
				'.tippy-box[data-placement^="top"] > .tippy-arrow': {
					bottom: "0",
				},
				'.tippy-box[data-placement^="top"] > .tippy-arrow:before': {
					bottom: "-8px",
					left: "0",
					borderWidth: "8px 8px 0",
					borderTopColor: "initial",
					transformOrigin: "center top",
				},
				'.tippy-box[data-placement^="bottom"] > .tippy-arrow': {
					top: "0",
				},
				'.tippy-box[data-placement^="bottom"] > .tippy-arrow:before': {
					top: "-8px",
					left: "0",
					borderWidth: "0 8px 8px",
					borderBottomColor: "initial",
					transformOrigin: "center bottom",
				},
				'.tippy-box[data-placement^="left"] > .tippy-arrow': {
					right: "0",
				},
				'.tippy-box[data-placement^="left"] > .tippy-arrow:before': {
					borderWidth: "8px 0 8px 8px",
					borderLeftColor: "initial",
					right: "-8px",
					transformOrigin: "center left",
				},
				'.tippy-box[data-placement^="right"] > .tippy-arrow': {
					left: "0",
				},
				'.tippy-box[data-placement^="right"] > .tippy-arrow:before': {
					left: "-8px",
					borderWidth: "8px 8px 8px 0",
					borderRightColor: "initial",
					transformOrigin: "center right",
				},
				'.tippy-box[data-inertia][data-state="visible"]': {
					transitionTimingFunction: "cubic-bezier(0.54, 1.5, 0.38, 1.11)",
				},
				".tippy-arrow": {
					width: "16px",
					height: "16px",
					color: "var(--tooltip-border-color)",
					/* color: 'var(--tooltip-background-primary-color)', */
				},
				".tippy-arrow:before": {
					content: '""',
					position: "absolute",
					borderColor: "transparent",
					borderStyle: "solid",
				},
				".tippy-content": {
					position: "relative",
					padding: "5px 9px",
					zIndex: "1",
				},
				".tippy-content .tooltip-menu": {
					display: "flex",
					flexDirection: "column",
					alignItems: "flex-start",
					padding: "0.5rem 0",
				},
				".tippy-content .tooltip-menu .divider": {
					margin: "0.25rem auto",
				},
				".tippy-content .tooltip-menu .item": {
					padding: "0.3rem 1rem",
					/* borderRadius: '0.3rem', */
				},
				".tippy-content .tooltip-menu .item:hover": {
					backgroundColor: "var(--tooltip-background-secondary-color)",
				},
				".tippy-content .tooltip-menu .item": {
					display: "flex",
					flexDirection: "row",
					gap: "0.5rem",
					alignItems: "center",
					cursor: "pointer",
					width: "100%",
					flex: "1",
				},
				".tippy-content .tooltip-menu .item .icon": {
					fontSize: "1.2rem",
				},
				".tippy-content .tooltip-menu .item .text": {
					marginRight: "auto",
				},
			});
		if (options.includes("link") || options.includes("url"))
			style.push({
				':is([target="_blank"], [href*="mailto:"]):before': {
					content: '"\\f35d"',
					fontFamily: "Line Awesome Free Solid",
					marginRight: "0.2rem",
				},
				"a:hover": {
					color: "var(--color-text-hover)",
				},
				a: {
					textDecoration: "none",
					color: "var(--link-color)",
					cursor: "pointer",
				},
			});
		this.shadowRoot.setStyle(style);
	}
	return this.shadowRoot;
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
	return new Promise((resolve) => {
		if (this.$0(selector)) resolve(this.$0(selector));
		new MutationObserver((mutations, observer) => {
			for (let mutation of mutations) {
				if (mutation.type === "childList" && mutation.addedNodes) {
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
		});
	});
};
HTMLElement.prototype.querySelectorAll = ((querySelectorAll) =>
	function () {
		return SAHYG.createNodeList(querySelectorAll.call(this, ...arguments));
	})(HTMLElement.prototype.querySelectorAll);
HTMLElement.prototype.contains = ((contains) =>
	function () {
		if (typeof arguments[0] === "string")
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
HTMLElement.prototype.getAttribute = ((getAttribute) =>
	function () {
		let attrVal = getAttribute.call(this, ...arguments);
		if (attrVal === "") return true;
		else return attrVal;
	})(HTMLElement.prototype.getAttribute);
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
	if (typeof style === "string") {
		let $style = SAHYG.createElement("style", {}, style);
		this.append($style);
		return $style;
	} else if (style instanceof Array) return style.map((css) => this.setStyle(css));

	let $style = SAHYG.createElement("style", {}, SAHYG.Utils.style.objectToString(style));
	this.append($style);
	return $style;
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
NodeList.prototype.slideHide = function () {
	this.forEach((elem) => elem.slideHide(...arguments));
	return this;
};
NodeList.prototype.slideShow = function () {
	this.forEach((elem) => elem.slideShow(...arguments));
	return this;
};

SAHYG.onload(async function () {
	(bind = (obj) => {
		Object.entries(obj).forEach(([k, v]) => {
			if (v.toString?.().startsWith("class")) obj[k] = v;
			else if (typeof v === "function") obj[k] = v; // v.bind(obj) (to replace this with current parent object);
			else if (!(v instanceof Array) && typeof v === "object") bind(obj[k]);
			else if (k.startsWith("$")) obj[k] = SAHYG.$0(v);
		});
	}),
		bind(SAHYG.Utils);

	if (SAHYG.Utils.url.getAnchor()) SAHYG.Utils.scroll.to(SAHYG.Utils.url.getAnchor());

	if (!document.documentElement.getAttribute("theme"))
		document.documentElement.setAttribute("theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

	SAHYG.Utils.cookie.set("locale", document.documentElement.getAttribute("lang"));
	SAHYG.Utils.cookie.set("theme", document.documentElement.getAttribute("theme"));

	// remove useless tippy stylesheet
	SAHYG.$0("[data-tippy-stylesheet]").remove();

	//Cookies consent
	if (!localStorage.getItem("cookie_consent") && location.pathname != "/about") SAHYG.Utils.cookie.consentPopup();

	// ANCHOR Add redirect to /login links
	SAHYG.dynamicOn("click", 'a[href="/login"], ::shadow a[href="/login"]', function (event) {
		event.preventDefault();
		if (!/login/.test(document.location.href)) document.location.href = "/login?redirect=" + document.location.pathname;
		else document.location.href = "/login";
	});
	SAHYG.dynamicOn("click", ".return-top, ::shadow .return-top", SAHYG.Utils.scroll.top);
	SAHYG.dynamicOn(
		"click",
		"[data-viewer], ::shadow [data-viewer]",
		(e) => e.target.src && SAHYG.createElement("sahyg-viewer", { src: e.target.src }).show()
	);
	SAHYG.dynamicOn("click", 'a[href^="#"]:not([href="#"]), ::shadow a[href^="#"]:not([href="#"])', (event) => {
		event.preventDefault();
		SAHYG.Utils.scroll.to(event.target.getAttribute("href").substring(1));
	});
	// Show / hide menu
	SAHYG.on("click", "menu-icon icon", SAHYG.Utils.headerMenu.toggle);
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
		if (e.target.isSameNode(SAHYG.$0("header-menu"))) SAHYG.Utils.headerMenu.close();
	});
	// ANCHOR Account logout
	SAHYG.on("click", "header .account .menu .logout", SAHYG.Utils.user.logout);
	// ANCHOR Account menu
	SAHYG.on("click", "header .account", SAHYG.Utils.headerAccount.toggle);
	// ANCHOR Easter egg: heart
	SAHYG.on("click", "heart", async () =>
		SAHYG.createElement("sahyg-toast", {
			content: await SAHYG.translate("MADE_WITH_HEART"),
		}).show()
	);
	// ANCHOR Close account menu
	SAHYG.on("click", "html", SAHYG.Utils.headerAccount.outsideClose);

	// SAHYG.on("mouseover", "header-menu .expandable", (e) =>
	// 	window.innerWidth > 1024 ? e.target.addClass("expanded").querySelector(".menu")?.show(0) : null
	// );

	SAHYG.on("mouseover", "header-menu .menus .expandable", function (e) {
		if (SAHYG.headerMenuTippy) {
			window.innerWidth > 1024 && SAHYG.headerMenuTippy.enable();
			return;
		}

		let target = e.target.closest(".expandable");
		let parent = target.closest(".menus");
		SAHYG.headerMenuTippy = tippy.createSingleton(
			parent.children.map((child) =>
				tippy(child, {
					delay: 0,
					content: child.$0(".menu").cloneNode(true),
					appendTo: child,
					allowHTML: true,
				})
			),
			{
				// moveTransition: "transform 0.2s ease-in-out",
				appendTo: parent,
				interactive: true,
				delay: 0,
				onTrigger: (instance) => window.innerWidth < 1024 && instance.disable(),
			}
		);
	});

	/**
	 * Display a popup with information about the user when the mouse hovers over the link to the user's profile.
	 */
	SAHYG.dynamicOn("mouseover", 'a[href*="/user/"], ::shadow a[href*="/user/"]', function () {
		if (this.getAttribute("no-tooltip")) return;
		if (!this._tippy)
			tippy(this, {
				delay: [500, 0],
				allowHTML: true,
				content: SAHYG.createElement("sahyg-loader"),
				onMount: async function (instance, event) {
					let username = this.getAttribute("href")?.match(/(?<=\/user\/)[a-z0-9_]{3,10}/)?.[0];
					if (SAHYG.Cache.users[username]) {
						instance.setContent(
							SAHYG.createElement("sahyg-user-tooltip", {
								username,
								avatar: SAHYG.Cache.users[username].avatarUrl,
								group: SAHYG.Cache.users[username].group?.name,
								certified: SAHYG.Cache.users[username].certified,
							})
						);
					} else {
						let data = (await SAHYG.Api.get("/resources/user/" + username))?.content;
						let element;
						if (!data) element = await SAHYG.translate("UNKNOWN_USER");
						else {
							SAHYG.Cache.users[username] = data;
							element = SAHYG.createElement("sahyg-user-tooltip", {
								username,
								avatar: data.avatarUrl,
								group: data.group?.name,
								certified: data.certified,
							});
						}
						instance.setContent(element);
					}
				}.bind(this),
			});
	});
	SAHYG.dynamicOn("mouseover", "[tooltip], ::shadow [tooltip]", function ({ target }) {
		if (target._tippy) target._tippy.setContent(target.getAttribute("tooltip"));
		else tippy(target, { content: target.getAttribute("tooltip"), aria: { expanded: true } });
	});
});
