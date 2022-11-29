const Page = require("../lib/page");

class Shortener extends Page {
	constructor(/** @type {import('../index')} */ Web) {
		super(Web);
		this.Web = Web;

		this.setGet(["/shortener"], this.get.bind(this));
		this.setPost(["/shortener"], this.post.bind(this));
		this.setGet(["/sc/:link"], this.redirect.bind(this));
	}

	async get(req, res, next) {
		if (!req.WebRequest.userExists) return res.redirect("/login?redirect=" + req.path);

		let shortcuts = await this.Web.db.Shortcut({ user: req.WebRequest.user._id }, true, true);
		res.WebResponse.render("shortener", { shortcuts });
	}

	async redirect(req, res, next) {
        if(!req.params.link) res.WebResponse.renderError("NOT_FOUND")
		let request = await this.Web.db.Shortcut({ name: req.params.link }, true);
		if (request ? !request.enabled : false) return this.notFoundPage();
		request.clicked++;
		request.save();
		res.redirect(request.target);
	}

	async post(req, res, next) {
		if (!req.WebRequest.userExists) return res.send({ success: false, code: 401 }); // TODO changer la réponse pour la nouvelle version
		if (!req.body.name || !req.body.action) return res.send({ success: false, code: 400 });
		if (!/[a-z0-9_-]+/gm.test(req.body.name)) return res.send({ success: false, code: 400 });

		switch (req.body.action) {
			case "delete": {
				if ((await this.Web.db.models.Shortcuts.deleteOne({ name: req.body.name, user: req.WebRequest.user._id })) == 0)
					return res.send({ success: false, code: 404 });
				else return res.send({ success: true });
			}
			case "add": {
				if (req.body.target ? !this.Web.utils.isUrl(req.body.target) : true) return res.send({ success: false, code: 400 });
				if (await this.Web.db.Shortcut({ name: req.body.name }, true)) return res.send({ success: false, code: 409 });
				await (await this.Web.db.Shortcut({ name: req.body.name, target: req.body.target, user: req.WebRequest.user._id })).save();
				return res.send({ success: true });
			}
			case "edit": {
				if (!req.body.oldName) return res.send({ success: false, code: 400 });
				if (req.body.target ? !this.Web.utils.isUrl(req.body.target) : true) return res.send({ success: false, code: 400 });
				let sc = await this.Web.db.Shortcut({ name: req.body.oldName }, true);
				if (!sc) return res.send({ success: false, code: 404 });
				sc.name = req.body.name;
				sc.target = req.body.target;
				await sc.save();
				return res.send({ success: true });
			}
			case "enable": {
				let sc = await this.Web.db.Shortcut({ name: req.body.name }, true);
				if (!sc) return res.send({ success: false, code: 404 });
				sc.enabled = true;
				await sc.save();
				return res.send({ success: true });
			}
			case "disable": {
				let sc = await this.Web.db.Shortcut({ name: req.body.name }, true);
				if (!sc) return res.send({ success: false, code: 404 });
				sc.enabled = false;
				await sc.save();
				return res.send({ success: true });
			}
			default: {
				return res.send({ success: false, code: 400 });
			}
		}
	}
}

module.exports = Shortener;
