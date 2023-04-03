const mongoose = require("mongoose");
const SessionsMongoStore = require("connect-mongo");
const RateLimiterMemoryStore = require("rate-limit-mongo");

class DB {
	constructor(/** @type {import('../index')} */ Web) {
		this.Web = Web;

		this.logger = Web.loggerStore.new("DB");
		this.rateLimiterLogger = this.logger.new("RateLimiterMongo");
		this.models = {};
		this.databases = {};

		this.Web.config.get("db.dbClasses").forEach((dbClass) => (this[dbClass] = require("./db/" + dbClass.toLowerCase()).bind(this)));
	}
	async init() {
		for (const db of this.Web.config.get("db.databases")) {
			await this.addConnection(db.name, db.models);
		}

		this.sessionsMemoryStore = SessionsMongoStore.create({
			mongoUrl: `${this.Web.config.get("db.mongo.uri")}/MemoryStores?${this.Web.config.get("db.mongo.params")}`,
			collectionName: this.Web.config.get("sessions.collectionName"),
		});
		this.rateLimiterMemoryStore = new RateLimiterMemoryStore({
			uri: `${this.Web.config.get("db.mongo.uri")}/MemoryStores`,
			expireTimeMs: this.Web.config.get("rateLimiterExpress.windowMs"),
			errorHandler: this.rateLimiterLogger.error.bind(this.rateLimiterLogger),
			collectionName: this.Web.config.get("rateLimiter.collectionName"),
		});

		try {
			let { patch, version } = require(this.Web.config.config_path + "/db_patch.js");
			let mongoDBConfig = await this.models.MongoDB.findOne({});
			if (!mongoDBConfig) {
				this.logger.warn("Applying full patch to the database");
				await patch(this);
				mongoDBConfig = this.models.MongoDB({ version });
				mongoDBConfig.save();
			} else if (version < mongoDBConfig.version) {
				this.logger.warn("Applying partial patch to the database");
				await patch(this, mongoDBConfig.version);
				mongoDBConfig.version = version;
				await mongoDBConfig.save();
			} else {
				this.logger.info("Database is up to date");
			}
		} catch (e) {
			console.log(e);
			this.logger.warn("No Patch found for the database");
		}
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
	async generateTemporaryPassword({ email, firstname, lastname, username }) {
		return Math.random().toString(16); // TODO email, page: changepassword
	}
}

module.exports = DB;
