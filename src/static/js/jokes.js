/** @type {import('@types/jquery')} */
SAHYG.Classes.Jokes = class Jokes {
	$container = SAHYG.$0("app");
	timeout = [];
	intervalDivider = 0.035;

	constructor(jokes) {
		this.jokes = jokes;
		this.$container.querySelector('app-content[sahyg-tab="about"] .total').textContent = this.jokes.length;
		this.$container.addClass("visible");

		SAHYG.on("click", 'app-content[sahyg-tab="random"] .new-joke', this.random.bind(this));

		this.random();
	}

	interval(str) {
		let interval = str.length / this.intervalDivider;
		if (interval < 1000) return 1000;
		return interval;
	}

	random() {
		this.timeout.forEach(clearTimeout);
		let container = this.$container.querySelector('app-content[sahyg-tab="random"] .joke');
		container.children.remove();
		let joke = this.jokes[Math.floor(Math.random() * this.jokes.length)];

		if (joke.type == "question/answer") {
			container.append(SAHYG.createElement("span", {}, joke.question));
			this.timeout.push(
				setTimeout(
					async () =>
						container.append(
							SAHYG.createElement("sahyg-button", {
								underline: true,
								content: await SAHYG.translate("I_DONT_KNOW"),
							}).on("click", (e) => {
								if (e.target.hasAttribute("disabled")) return;
								e.target.setAttribute("disabled", true);
								container.append(SAHYG.createElement("span", {}, joke.answer));
							})
						),
					this.interval(joke.question)
				)
			);
		} else if (joke.type == "phrases") {
			let phrases = Array.from(joke.phrases);
			let timeout = this.interval(phrases[0]);
			container.append(SAHYG.createElement("span", {}, phrases.shift()));
			phrases.forEach((phrase) => {
				this.timeout.push(setTimeout(() => container.append(SAHYG.createElement("span", {}, phrase)), timeout));
				timeout += this.interval(phrase);
			});
		} else {
			this.random();
		}
	}
};

SAHYG.onload(async () => {
	let loader = SAHYG.Components.Loader.center();
	let jokes = (await SAHYG.Api.post("/jokes").catch(console.error))?.content;
	loader.remove();
	if (!jokes || jokes.length == 0)
		SAHYG.$0(".loading").innerHTML = SAHYG.createElement("span", {}, "⚠️ " + (await SAHYG.translate("NO_JOKES"))).outerHTML;
	else SAHYG.Instances.Jokes = new SAHYG.Classes.Jokes(jokes);
});
