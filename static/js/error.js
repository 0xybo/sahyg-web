$(function () {
	$("container .url").text(document.location.href);
	SAHYG.Events.click.push({ element: "container .back", callback: (e) => (e.preventDefault(), history.back()) });
	SAHYG.Events.click.push({ element: "container .refresh", callback: (e) => (e.preventDefault(), location.reload()) });
});
