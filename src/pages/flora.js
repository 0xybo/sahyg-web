const Page = require("../lib/page");
const fs = require("fs");

class Flora extends Page {
	constructor(/** @type {import('../index')} */ Web) {
		super(Web);
		this.Web = Web;
		this.identification = {
			"fr-FR": null,
		};
		this.glossary = {
			"fr-FR": null,
		};
		this.possibleLanguages = ["fr-FR"];

		this.setGet(["/flora"], this.get.bind(this));
		this.setPost(["/flora"], this.post.bind(this));
	}

	load(type, locale) {
		if (!this.identification[locale] && type == "identification")
			this.identification["fr-FR"] = require(`${this.Web.config.get("paths.resources")}flora/identification_${locale}.json`);
		if (!this.glossary[locale] && type == "glossary")
			this.glossary["fr-FR"] = require(`${this.Web.config.get("paths.resources")}flora/glossary_${locale}.json`);
	}

	async get(
		/** @type {import('express').Request}*/ req,
		/** @type {import('express').Response}*/ res,
		/** @type {import('express').NextFunction}*/ next
	) {
		let locale;
		this.possibleLanguages.includes((locale = req.getLocale())) || (locale = "fr-FR");
		try {
			this.load("identification", locale);
			this.load("glossary", locale);
		} catch (e) {
			this.logger.error(e);
			return res.WebResponse.renderError();
		}
		res.WebResponse.render("flora", {
			languageAvailable: true,
			identification: this.identification[locale][1],
			glossary: this.glossary[locale],
			glossaryMenu: Object.entries(this.glossary[locale]).map(([k, v], i) => {
				return { id: String(i), title: k };
			}),
		});
	}
	async post(
		/** @type {import('express').Request}*/ req,
		/** @type {import('express').Response}*/ res,
		/** @type {import('express').NextFunction}*/ next
	) {
		let locale;
		this.possibleLanguages.includes((locale = req.getLocale())) || (locale = "fr-FR");
		if (req.body.type == "get") {
			if (!req.body.id) return res.status(400).end();
			this.load("identification", locale);
			return res.WebResponse.setContent(this.identification[locale][req.body.id]).send();
		} else if (req.body.type == "search") {
			if (!req.body.value) return res.status(400).end();
			this.load("identification", locale);

			let value = req.body.value.toLowerCase();
			let result = {};
			let searchPosition = 0;
			let identificationArray = Object.entries(this.identification[locale]);

			while (Object.keys(result).length < 100 && searchPosition < identificationArray.length) {
				let id = identificationArray[searchPosition][0];
				let properties = identificationArray[searchPosition][1];

				if (properties.type == "question") {
					if (properties.possibilities.some((possibility) => possibility.text.toLowerCase().includes(value))) result[id] = properties;
					else {
						let valueArray = value.split(" ");
						if (valueArray.length > 1)
							if (
								valueArray.every((value) =>
									properties.possibilities.some((possibility) => possibility.text.toLowerCase().includes(value))
								)
							)
								result[id] = properties;
					}
				} else {
					if (this.searchInSpecimen(properties, value)) result[id] = properties;
					else {
						let valueArray = value.split(" ");
						if (valueArray.length > 1) if (valueArray.every((value) => this.searchInSpecimen(properties, value))) result[id] = properties;
					}
				}
				searchPosition++;
			}

			return res.WebResponse.setContent(result).send();
		} else res.WebResponse.error()
	}
	searchInSpecimen(properties, searchText) {
		return (
			properties.family.toLowerCase().includes(searchText) ||
			properties.gender.toLowerCase().includes(searchText) ||
			properties.latin.toLowerCase().includes(searchText) ||
			properties.french.toLowerCase().includes(searchText) ||
			properties.common.toLowerCase().includes(searchText) ||
			properties.properties.toLowerCase().includes(searchText) ||
			properties.habitat.toLowerCase().includes(searchText) ||
			properties.location.toLowerCase().includes(searchText) ||
			properties.id.toLowerCase().includes(searchText)
		);
	}
}

module.exports = Flora;
