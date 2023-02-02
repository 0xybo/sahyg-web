/** @type {import('@types/jquery')} */

$(async function () {
	SAHYG.Classes.Jokes = class Jokes {
		timeout = [];
		intervalDivider = 0.035;

		constructor(jokes) {
			this.jokes = jokes;
			this.container = $("app");
			this.container.find("app-content[data-horizontal-tabs-id=about] .total").text(this.jokes.length);
			this.container.addClass("visible");

			SAHYG.Events.click.push({
				element: "app-content[data-horizontal-tabs-id=random] btn.new-joke",
				callback: this.random.bind(this),
			});

			this.random();
		}

		interval(str) {
			let interval = str.length / this.intervalDivider;
			if (interval < 1000) return 1000;
			return interval;
		}

		random() {
			this.timeout.forEach(clearTimeout);
			let container = this.container.find('app-content[data-horizontal-tabs-id="random"] .joke');
			container.children().remove();
			let joke = this.jokes[Math.floor(Math.random() * this.jokes.length)];

			if (joke.type == "question/answer") {
				container.append($(`<span>${joke.question}</span>`));
				this.timeout.push(
					setTimeout(
						async () =>
							container.append(
								SAHYG.createElement(`<btn class="btn-underline">${await SAHYG.translate("I_DONT_KNOW")}</btn>`, {
									events: {
										click: (e) => {
											if ($(e.target).hasClass("disabled")) return;
											$(e.target).addClass("disabled");
											container.append($(`<span>${joke.answer}</span>`));
										},
									},
								})
							),
						this.interval(joke.question)
					)
				);
			} else if (joke.type == "phrases") {
				let phrases = Array.from(joke.phrases);
				let timeout = this.interval(phrases[0]);
				container.append($(`<span>${phrases.shift()}</span>`));
				phrases.forEach((phrase) => {
					this.timeout.push(setTimeout(() => container.append($(`<span>${phrase}</span>`)), timeout));
					timeout += this.interval(phrase);
				});
			} else {
				this.random();
			}
		}
	};
	SAHYG.Components.loader.replaceContent($(".loading"));
	$(".loading").append(await SAHYG.translate("LOADING_RESOURCES"));
	let jokes = await SAHYG.Api.post("/jokes").catch(console.log);
	if (!jokes || jokes.length == 0) {
		$(".loading").contents().remove();
		$(".loading").append($(`<span>${"⚠️ " + (await SAHYG.translate("NO_JOKES"))}</span>`));
	} else {
		$(".loading").remove();
		SAHYG.Instances.Jokes = new SAHYG.Classes.Jokes(jokes);
	}
});
