class Errors {
	constructor(/** @type {import('../index')}*/ Web) {
		this.Web = Web;

		this.errorsData = this.Web.config.get("errors");

		this.errorsData.forEach((error) => {
			Object.defineProperty(this, error.errorCode, {
				value: error,
				writable: false,
			});
		});
	}
}

module.exports = Errors;
