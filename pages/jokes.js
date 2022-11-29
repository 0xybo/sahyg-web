const Page = require("../lib/page");

class Jokes extends Page {
	constructor(Web) {
		super(Web);

		this.jokes = require("../resources/jokes.json");

        this.setGet(["/jokes"], (req, res) => res.WebResponse.render("jokes"))
        this.setPost(["/jokes"], async function (req, res) {
            res.json(this.jokes.filter((joke) => joke.language == (req.body.locale || req.cookies.locale || req.getLocale())));
        }.bind(this))
	}
}

module.exports = Jokes;
