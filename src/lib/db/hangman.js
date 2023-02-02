async function Hangman(obj, { create = false, multiple = false, remove = false } = {}) {
	let model;
	if (remove) {
		return await this.models.Hangman.deleteMany({ obj });
	}
	if (!create) {
		model = await this.models.Hangman.find(obj, null);
		if (!multiple) model = model[0];
		if (!model) return null;
	} else {
		model = this.models.Hangman();
		model.session = obj.session;
		model.startedAt = obj.startedAt;
		model.word = obj.word;
        model.stage = obj.stage;
        model.wordStatus = obj.wordStatus;
        model.usedLetters = obj.usedLetters;
        model.difficulty = obj.difficulty;
		model.save();
	}

	return model;
}

module.exports = Hangman;
