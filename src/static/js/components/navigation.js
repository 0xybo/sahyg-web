function openHorizontalTab() {
	let tab = $(this);
	if (tab.hasClass("active")) return false;
	$("c-horizontal-tabs-item[data-horizontal-tabs-target]").removeClass("active");
	tab.addClass("active");
	$("[data-horizontal-tabs-id]").removeClass("active");
	$(`[data-horizontal-tabs-id=${tab.attr("data-horizontal-tabs-target")}]`).addClass("active");
	SAHYG.Utils.url.setLocationParams({
		[tab.closest("c-horizontal-tabs").attr("id")]: tab.attr("data-horizontal-tabs-target"),
	});
}

function openVerticalTab() {
	let tab = $(this);
	$("c-vertical-tabs-item[data-vertical-tabs-target]").removeClass("active");
	tab.addClass("active");
	tab.closest("c-vertical-tabs")
		.find("[data-vertical-tabs-id]")
		.removeClass("active")
		.filter(`[data-vertical-tabs-id=${tab.attr("data-vertical-tabs-target")}]`)
		.addClass("active");
	tab.closest("c-vertical-tabs-panel").toggleClass("opened");
	SAHYG.Utils.url.setLocationParams({
		[tab.closest("c-vertical-tabs").attr("id")]: tab.attr("data-vertical-tabs-target"),
	});
	SAHYG.Utils.scroll.top();
}

function verticalTabSearch() {
	let input = $(this);
	let container = input.closest("c-vertical-tabs").children("c-vertical-tabs-container");
	let search = (elem) => $(elem).text().toLowerCase().includes(input.val().toLowerCase());
	if (input.closest("c-vertical-tabs-search").attr("data-search-type") == "all")
		search = (elem) =>
			container
				.children(`[data-vertical-tabs-id="${$(elem).attr("data-vertical-tabs-target")}"]`)
				.html()
				.toLowerCase()
				.includes(input.val().toLowerCase()) || $(elem).text().toLowerCase().includes(input.val().toLowerCase());
	else if (input.closest("c-vertical-tabs-search").attr("data-search-type") == "content")
		search = (elem) =>
			container
				.children(`[data-vertical-tabs-id="${$(elem).attr("data-vertical-tabs-target")}"]`)
				.html()
				.toLowerCase()
				.includes(input.val().toLowerCase());
	input
		.closest("c-vertical-tabs-panel")
		.find("c-vertical-tabs-menu c-vertical-tabs-item")
		.hide()
		.filter((i, elem) => search(elem))
		.show();
}

$(function () {
	// ANCHOR Horizontal Tab
	SAHYG.oldOn("click", "c-horizontal-tabs-item[data-horizontal-tabs-target]", openHorizontalTab);

	$(`[data-horizontal-tabs-id=${$("c-horizontal-tabs-item[data-horizontal-tabs-target].active").attr("data-horizontal-tabs-target")}]`).addClass(
		"active"
	);

	// ANCHOR Vertical Tab
	$(`[data-vertical-tabs-id="${$("c-vertical-tabs-item[data-vertical-tabs-target].active").attr("data-vertical-tabs-target")}"]`).addClass(
		"active"
	);
	SAHYG.oldOn("click", "c-vertical-tabs-item[data-vertical-tabs-target]", openVerticalTab);
	SAHYG.oldOn("input", "c-vertical-tabs-search input", verticalTabSearch);
	SAHYG.oldOn("click", "c-vertical-tabs-display-button", function () {
		$(this).closest("c-vertical-tabs-panel").toggleClass("opened");
	});

	// ANCHOR Section
	SAHYG.oldOn("click", "c-section-title", function () {
		$(this).parent().toggleClass("open");
	});
	$("c-section-content:empty").parent().hide();

	SAHYG.Components.navigation.updateHorizontalTab();
	SAHYG.Components.navigation.updateVerticalTab();
});

window.addEventListener("popstate", function () {
	SAHYG.Components.navigation.updateHorizontalTab();
	SAHYG.Components.navigation.updateVerticalTab();
});

SAHYG.Components.navigation = {
	openHorizontalTab(tabsID, tabID) {
		openHorizontalTab.call($(`c-horizontal-tabs#${tabsID} c-horizontal-tabs-item[data-horizontal-tabs-target="${tabID}"]`));
	},
	updateHorizontalTab() {
		let params = SAHYG.Utils.url.getParams();
		$("c-horizontal-tabs")
			.toArray()
			.filter((elem) => $(elem).attr("id") in params)
			.forEach((elem) => {
				elem = $(elem);
				let target = params[elem.attr("id")];
				if (elem.find(`c-horizontal-tabs-item[data-horizontal-tabs-target="${target}"]`).length) {
					elem.find("c-horizontal-tabs-item")
						.removeClass("active")
						.filter((i, e) => $(e).attr("data-horizontal-tabs-target") == target)
						.addClass("active");
					elem.find(`[data-horizontal-tabs-id]`)
						.removeClass("active")
						.filter((i, e) => $(e).attr("data-horizontal-tabs-id") == target)
						.addClass("active");
				} else {
					elem.find(`c-horizontal-tabs-item[data-horizontal-tabs-target="${elem.attr("data-default-tab")}"]`).addClass("active");
					elem.find(`c-horizontal-tabs-id[data-horizontal-tabs-id="${elem.attr("data-default-tab")}"]`).addClass("active");
					SAHYG.Utils.url.setLocationParams({ [elem.attr("id")]: elem.attr("data-default-tab") });
				}
			});
	},
	openVerticalTab(tabsID, tabID) {
		openVerticalTab.call($(`c-vertical-tabs#${tabsID}  c-vertical-tabs-item[data-vertical-tabs-target="${tabID}"]`));
	},
	updateVerticalTab() {
		let params = SAHYG.Utils.url.getParams();
		$("c-vertical-tabs")
			.toArray()
			.filter((elem) => $(elem).attr("id") in params)
			.forEach((elem) => {
				elem = $(elem);
				let target = params[elem.attr("id")];
				if (elem.find(`c-vertical-tabs-item[data-vertical-tabs-target="${target}"]`).length) {
					elem.find("c-vertical-tabs-item")
						.removeClass("active")
						.filter((i, e) => $(e).attr("data-vertical-tabs-target") == target)
						.addClass("active");
					elem.find(`[data-vertical-tabs-id]`)
						.removeClass("active")
						.filter((i, e) => $(e).attr("data-vertical-tabs-id") == target)
						.addClass("active");
				} else {
					elem.find(`c-vertical-tabs-item[data-vertical-tabs-target="${elem.attr("data-default-tab")}"]`).addClass("active");
					elem.find(`c-vertical-tabs-id[data-vertical-tabs-id="${elem.attr("data-default-tab")}"]`).addClass("active");
					SAHYG.Utils.url.setLocationParams({ [elem.attr("id")]: elem.attr("data-default-tab") });
				}
			});
	},
};
