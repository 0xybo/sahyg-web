const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");

class DB {
	constructor(/** @type {import('../index')} */ Web) {
		this.Web = Web;

		this.logger = Web.loggerStore.new("DB");
		this.models = {};
		this.databases = {};

		this.Web.config.get("db.dbClasses").forEach((dbClass) => (this[dbClass] = require("./db/" + dbClass).bind(this)));
	}
	async init() {
		for (const db of this.Web.config.get("db.databases")) {
			await this.addConnection(db.name, db.models);
		}

		this.sessionsMemoryStore = MongoStore.create({
			mongoUrl: `${this.Web.config.get("db.mongo.uri")}/sessions?${this.Web.config.get("db.mongo.params")}`,
			collectionName: this.Web.config.get("sessions.collectionName"),
		});
	}
	async addConnection(name, models) {
		this.databases[name] = await mongoose
			.createConnection(`${this.Web.config.get("db.mongo.uri")}/${name}?${this.Web.config.get("db.mongo.params")}`)
			.asPromise()
			.then((mongoose) => {
				this.logger.ok(`DB ${name} successfully connected`);
				return mongoose;
			})
			.catch((e) => {
				this.logger.error(e);
				process.exit();
			});

		for (const model of this.Web.config.get("db.models").filter((model) => models.includes(model.name))) {
			this.models[model.name] = await this.databases[name].model(model.name, model.schema);
		}
	}
}

module.exports = DB;
