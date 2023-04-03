SAHYG.onload(function () {
	SAHYG.$0("container .url").textContent = document.location.href
	SAHYG.on("click", "container .back", (e) => (e.preventDefault(), history.back()))
	SAHYG.on("click", "container .refresh", (e) => (e.preventDefault(), location.reload()))
});
