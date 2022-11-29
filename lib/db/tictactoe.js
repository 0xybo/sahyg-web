async function TicTacToe(obj, get = false, multi = false, limit = 20) {
	let model;
	if (get) {
		model = await this.models.TicTacToe.find(obj, null, { limit });
		if (!multi) model = model[0];
		if (!model) return null;
	} else {
		model = this.models.TicTacToe();
		model.user = obj.user;
		model.moves = obj.moves;
		model.opponent = obj.opponent;
		model.win = obj.win;
	}

	return model;
}

module.exports = TicTacToe;
