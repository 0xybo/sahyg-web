function applyFunctions(model) {
	model.send = function () {
		if (model.content?.type == "html") {
			return void this.Web.mail.sendFile({
				filename: model.content?.filename,
				target: model.target,
				subject: model.subject,
				locale: model.locale,
				mail: model,
			});
		} else {
			return void this.Web.mail.send({ content: model.content?.text, target: model.target, subject: model.subject, locale: model.locale });
		}
	}.bind(this);
}

/**
 * Mail
 *
 * @param {{}} query
 * @param {{}} param1
 * @returns {model}
 */
async function Mail(query, { create = true, multiple = false } = {}) {
	try {
		let model;
		if (!create) {
			if (multiple) model = await this.models.Mails.find(query);
			else model = await this.models.Mails.findOne(query);
			if (!model) return null;
		} else {
			model = this.models.Mails();
			model.user = query.user;
			model.type = query.type;
			model.target = query.target;
			model.locale = query.locale;
			model.subject = query.subject;
			model.content = query.content;
		}

		if (multiple) model.forEach(applyFunctions.bind(this));
		else applyFunctions.call(this, model);

		return model;
	} catch (e) {
		this.logger.error(e);
		return null;
	}
}

module.exports = Mail;
