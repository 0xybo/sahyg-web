async function Shortcut(obj, get = false, multi = false) {
	let model;
	if (get) {
		model = await this.models.Shortcuts.find(obj);
		if (!multi) model = model[0];
		if (!model) return null;
	} else {
		model = this.models.Shortcuts();
		model.target = obj.target;
		model.user = obj.user;
		if (obj.name) model.name = obj.name;
		if (obj.enabled) model.enabled = obj.enabled;
	}

	return model;
}

module.exports = Shortcut;