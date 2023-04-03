const md = require("marked").marked;
const Page = require("../lib/page");

class About extends Page {
	constructor(/** @type {import('../index.js')} */ Web) {
		super(Web);

		this.setGet("/about", this.about.bind(this));
	}
	about(
		/** @type {import('express').Request}*/ req,
		/** @type {import('express').Response}*/ res,
		/** @type {import('express').NextFunction}*/ next
	) {
		let l;
		let locale = req.getLocale();
		let content = [
			...this.Web.config.get("pages.about.content"),
			{
				type: "section",
				name: "i18n:RELEASE_NOTES",
				id: "release_notes",
				content: this.Web.config.get("releaseNotes").map((release) => ({
					type: "section",
					name: `${release.version} (${release.date})`,
					id: release.version,
					content: [
						release.description?.[locale] || "",
						{
							type: "list",
							items: [
								(release.new?.[locale] ? (l = locale) : release.new["en-GB"] ? (l = "en-GB") : (l = null),
								l
									? {
											type: "listItem",
											content: [`**${req.__("NEW")}** :`],
											subList: release.new[l],
									  }
									: null),
								(release.fix?.[locale] ? (l = locale) : release.fix["en-GB"] ? (l = "en-GB") : (l = null),
								l
									? {
											type: "listItem",
											content: [`**${req.__("FIX")}** :`],
											subList: release.fix[l],
									  }
									: null),
								(release.changes?.[locale] ? (l = locale) : release.changes["en-GB"] ? (l = "en-GB") : (l = null),
								l
									? {
											type: "listItem",
											content: [`**${req.__("CHANGES")}** :`],
											subList: release.changes[l],
									  }
									: null),
							].filter((e) => e),
						},
					],
				})),
			},
		];
		let table_of_contents = {
			type: "section",
			name: "i18n:TABLE_OF_CONTENTS",
			id: "table_of_contents",
			content: [
				{
					type: "list",
					items: this.generateTableOfContents(content),
				},
			],
		};

		res.WebResponse.render("about", { content: [table_of_contents, ...content], parse: this.parse.bind(this) });
	}
	parse(txt) {
		return md.parse(txt);
	}

	generateTableOfContents(content) {
		let links = [];
		content.forEach((element) => {
			if (element.type == "section")
				links.push([
					{
						type: "listItem",
						content: [
							{
								type: "link",
								href: "#" + element.id,
								text: element.name,
							},
						],
						subList: element.content instanceof Array ? this.generateTableOfContents(element.content) : [],
					},
				]);
		});
		return links;
	}
}

module.exports = About;
