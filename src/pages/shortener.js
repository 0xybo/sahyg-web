const Page = require("../lib/page");

class Shortener extends Page {
	constructor(/** @type {import('../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.setGet(["/shortener"], this.get.bind(this));
		this.setGet(["/shortener/list"], this.list.bind(this));
		this.setPost(["/shortener/delete"], this.validRequest.bind(this), this.delete.bind(this));
		this.setPost(["/shortener/add"], this.validRequest.bind(this), this.add.bind(this));
		this.setPost(["/shortener/edit"], this.validRequest.bind(this), this.edit.bind(this));
		this.setPost(["/shortener/enable"], this.validRequest.bind(this), this.enable.bind(this));
		this.setPost(["/shortener/disable"], this.validRequest.bind(this), this.disable.bind(this));
		this.setGet(["/sc/:link", "/s/:link"], this.redirect.bind(this));
	}
	async get(req, res, next) {
		res.WebResponse.render("shortener");
	}
	async list(req, res, next) {
		let shortcuts = await this.Web.db.Shortcut({ user: req.WebRequest.user._id }, true, true);
		shortcuts = shortcuts.map((shortcut) => {
			return {
				clicked: shortcut.clicked,
				enabled: shortcut.enabled,
				name: shortcut.name,
				target: shortcut.target,
			};
		});
		res.WebResponse.setContent(shortcuts).send();
	}
	async redirect(req, res, next) {
		if (!req.params.link) res.WebResponse.renderError("NOT_FOUND");
		let request = await this.Web.db.Shortcut({ name: req.params.link }, true);
		if (request ? !request.enabled : false) return this.notFoundPage();
		request.clicked++;
		request.save();
		res.redirect(request.target);
	}
	async validRequest(req, res, next) {
		if (!req.body.name) return res.WebResponse.error("MISSING_NAME");
		if (!/[a-z0-9_-]+/gm.test(req.body.name)) return res.WebResponse.error("INVALID_NAME");
		return next();
	}
	async delete(req, res, next) {
		if ((await this.Web.db.models.Shortcuts.deleteOne({ name: req.body.name, user: req.WebRequest.user._id })) == 0)
			return res.WebResponse.error("SHORTCUT_NOT_FOUND");
		else res.WebResponse.send();
	}
	async add(req, res, next) {
		if (req.body.target ? !this.Web.utils.isUrl(req.body.target) : true) return res.WebResponse.error("INVALID_URL");
		if (await this.Web.db.Shortcut({ name: req.body.name }, true)) return res.WebResponse.error("SHORTCUT_ALREADY_EXISTS");
		await (await this.Web.db.Shortcut({ name: req.body.name, target: req.body.target, user: req.WebRequest.user._id })).save();
		return res.WebResponse.send();
	}
	async edit(req, res, next) {
		if (!req.body.oldName) return res.WebResponse.error("MISSING_OLD_NAME");
		if (req.body.target ? !this.Web.utils.isUrl(req.body.target) : true) return res.WebResponse.error("INVALID_URL");
		let sc = await this.Web.db.Shortcut({ name: req.body.oldName }, true);
		if (!sc) return res.WebResponse.error("SHORTCUT_NOT_FOUND");
		sc.name = req.body.name;
		sc.target = req.body.target;
		await sc.save();
		return res.WebResponse.send();
	}
	async enable(req, res, next) {
		let sc = await this.Web.db.Shortcut({ name: req.body.name }, true);
		if (!sc) return res.WebResponse.error("SHORTCUT_NOT_FOUND");
		sc.enabled = true;
		await sc.save();
		return res.WebResponse.send();
	}
	async disable(req, res, next) {
		let sc = await this.Web.db.Shortcut({ name: req.body.name }, true);
		if (!sc) return res.WebResponse.error("SHORTCUT_NOT_FOUND");
		sc.enabled = false;
		await sc.save();
		return res.WebResponse.send();
	}
}

module.exports = Shortener;
