$(function () {
	// ANCHOR Add shortcut properties to DOM
	$(".table .row:not(.header)").each(function () {
		$(this).data("shortcut", {
			enabled: $(this).find(".enable btn").hasClass("enabled"),
			URL: $(this).find(".url a").attr("href"),
			target: $(this).find(".target a").attr("href"),
			clicked: Number($(this).find(".clicked").text()),
			name: $(this)
				.find(".url a")
				.attr("href")
				.match(/(?<=\/sc\/).+/gim)[0],
			line: $(this),
		});
	});

	// ANCHOR Search bar
	SAHYG.on("input", "#search", function () {
		let text = $(this).val();
		$(".table .row:not(.header)").each(function () {
			let elem = $(this);
			let shortcut = elem.data("shortcut");
			if (shortcut.URL.includes(text) || shortcut.target.includes(text)) elem.show();
			else elem.hide();
		});
		updateCount();
	});

	// ANCHOR events
	SAHYG.on("click", "container .row .copy", clickCopy);
	SAHYG.on("click", "container .row .edit", clickEdit);
	SAHYG.on("click", "container .row .remove", clickRemove);
	SAHYG.on("click", "container .row .enable btn", clickEnable);
	SAHYG.on("click", "container .new", clickAdd);
});

// ANCHOR Click: enable
async function clickEnable() {
	// console.log(this, arguments);
	let sc = $(this).closest(".row").data("shortcut");
	$.post("/shortener", {
		name: sc.name,
		action: sc.enabled ? "disable" : "enable",
	}).done(async (data) => {
		if (data.success) {
			toggleEnabled(sc);
			SAHYG.Components.toast.Toast.success({
				message: await SAHYG.translate("UPDATE_SUCCESS"),
			}).show();
		} else {
			SAHYG.Components.toast.Toast.danger({
				message: await SAHYG.translate("UPDATE_FAILED"),
			}).show();
		}
	});
}

// ANCHOR Click: copy
function clickCopy() {
	navigator.clipboard.writeText($(this).closest(".row").data("shortcut").URL).then(async () => {
		SAHYG.Components.toast.Toast.success({
			message: await SAHYG.translate("COPIED"),
		}).show();
	});
}

// ANCHOR Click: add
async function clickAdd() {
	SAHYG.Components.popup.Popup.input(await SAHYG.translate("EDIT"), [
		{
			name: "name",
			label: await SAHYG.translate("NAME"),
			placeholder: await SAHYG.translate("NAME"),
			type: "text",
			defaultValue: Math.random().toString(16).substring(2, 12),
		},
		{
			name: "target",
			label: await SAHYG.translate("TARGET"),
			placeholder: await SAHYG.translate("TARGET"),
			type: "url",
			defaultValue: "",
		},
	]).then((data) => {
		if (data) addShortcut(data);
	});
}

// ANCHOR Click: edit
async function clickEdit() {
	let sc = $(this).closest(".row").data("shortcut");
	SAHYG.Components.popup.Popup.input(await SAHYG.translate("EDIT"), [
		{
			name: "name",
			label: await SAHYG.translate("NAME"),
			placeholder: await SAHYG.translate("NAME"),
			type: "text",
			defaultValue: sc.name || Math.random().toString(16).substring(2, 12),
		},
		{
			name: "target",
			label: await SAHYG.translate("TARGET"),
			placeholder: await SAHYG.translate("TARGET"),
			type: "url",
			defaultValue: sc.target,
		},
	]).then((data) => {
		if (data) editShortcut(sc, data);
	});
}

// ANCHOR Click: remove
async function clickRemove() {
	SAHYG.Components.popup.Popup.confirm(
		await SAHYG.translate("CONFIRM_DELETE_SHORTCUT", {
			name: $(this).closest(".row").data("shortcut").name,
		})
	).then(({ confirm }) => {
		if (confirm) deleteShortcut($(this).closest(".row").data("shortcut"));
	});
}

// ANCHOR popup for add and edit
function popup(name = undefined, target = undefined) {
	return new Promise(async (resolve) => {
		new SAHYG.Components.popup.Popup({
			title: name ? await SAHYG.translate("EDIT") : await SAHYG.translate("NEW_SHORTCUT"),
			buttons: {
				discard: {
					text: await SAHYG.translate("DISCARD"),
					style: undefined,
					callback: (event, popup) => {
						popup.close();
					},
				},
				confirm: {
					text: await SAHYG.translate("CONFIRM"),
					style: "fullColor",
					callback: (event, popup) => {
						popup.close();
						resolve({ name: popup.popup.find(".shortcut-popup #name").val(), target: popup.popup.find(".shortcut-popup #target").val() });
					},
				},
			},
			content: SAHYG.createElement(
				"div",
				{ class: "shortcut-popup" },
				SAHYG.createElement(
					"div",
					{},
					SAHYG.createElement("label", { for: "name" }, await SAHYG.translate("NAME")),
					SAHYG.createElement(
						"div",
						{
							class: "ta",
						},
						SAHYG.createElement("input", {
							id: "name",
							type: "text",
							placeholder: await SAHYG.translate("NAME"),
							value: name || Math.random().toString(16).substring(2, 12),
						})
					)
				),
				SAHYG.createElement(
					"div",
					{},
					SAHYG.createElement("label", { for: "target" }, await SAHYG.translate("TARGET")),
					SAHYG.createElement(
						"div",
						{
							class: "ta",
						},
						SAHYG.createElement("input", {
							id: "target",
							type: "text",
							placeholder: await SAHYG.translate("TARGET"),
							value: target,
						})
					)
				)
			).prop("outerHTML"),
		}).show();
	});
}

// ANCHOR update counter
function updateCount() {
	$("container .count .current").text($("container .row:not(.header):visible").length);
	$("container .count .total").text($("container .row:not(.header)").length);
}

// ANCHOR update line
function updateLine(sc, { name, target }) {
	sc.line.find(".cell.url a").attr("href", `https://${location.hostname}/s/${name}`).text(`https://${location.hostname}/s/${name}`);
	sc.line.find(".cell.target a").attr("href", target).text(target);
	sc.name = name;
	sc.target = target;
	sc.line.data("shortcut", sc);
}

// ANCHOR update enable
async function toggleEnabled(sc) {
	let elem = sc.line.find(".cell.enable btn");
	if (sc.enabled) elem.removeClass("enabled").addClass("disabled").html("&#xf0c8;");
	else elem.removeClass("disabled").addClass("enabled").html("&#xf14a;");
	sc.line.data("shortcut").enabled = !sc.line.data("shortcut").enabled;
}

// ANCHOR add line
async function addLine(sc) {
	let elem = SAHYG.createElement(
		"div",
		{ class: "row" },
		SAHYG.createElement(
			"div",
			{ class: "cell enable" },
			SAHYG.createElement("btn", { class: "enabled", "data-tooltip": await SAHYG.translate("ENABLE/DISABLE"), events: { click: clickEnable } }, "&#xf14a;")
		),
		SAHYG.createElement("div", { class: "cell url" }, SAHYG.createElement("a", { href: sc.URL, target: "_blank" }, sc.URL)),
		SAHYG.createElement("div", { class: "cell target" }, SAHYG.createElement("a", { href: sc.target, target: "_blank" }, sc.target)),
		SAHYG.createElement("div", { class: "cell clicked" }, 0),
		SAHYG.createElement(
			"div",
			{ class: "cell commands" },
			SAHYG.createElement("btn", { class: "copy", "data-tooltip": await SAHYG.translate("COPY_URL") }, "&#xf0c5;"),
			SAHYG.createElement("btn", { class: "edit", "data-tooltip": await SAHYG.translate("EDIT") }, "&#xf304;"),
			SAHYG.createElement("btn", { class: "remove", "data-tooltip": await SAHYG.translate("REMOVE") }, "&#xf2ed;")
		)
	);
	sc.line = elem;
	elem.data("shortcut", sc);
	$("container .table .body").append(elem);
	updateCount();
}

// ANCHOR delete line
function deleteLine(sc) {
	sc.line.remove();
	updateCount();
}

// ANCHOR delete shortcut
function deleteShortcut(sc) {
	$.post("/shortener", {
		name: sc.name,
		target: sc.target,
		action: "delete",
	}).done(async (data) => {
		if (data.success) {
			deleteLine(sc);
			SAHYG.Components.toast.Toast.success({
				message: await SAHYG.translate("DELETE_SUCCESS"),
			}).show();
		} else
			SAHYG.Components.toast.Toast.danger({
				message: await SAHYG.translate("DELETE_FAILED"),
			}).show();
	});
}

// ANCHOR Add shortcut
function addShortcut(sc) {
	sc.URL = `https://${location.hostname}/sc/${sc.name}`;
	$.post("/shortener", {
		name: sc.name,
		target: sc.target,
		action: "add",
	}).done(async (data) => {
		if (data.success) {
			addLine(sc);
			SAHYG.Components.toast.Toast.success({
				message: await SAHYG.translate("ADD_SUCCESS"),
			}).show();
		} else {
			if (data.code == 409)
				SAHYG.Components.toast.Toast.danger({
					message: await SAHYG.translate("SHORTCUT_ALREADY_EXISTS"),
				}).show();
			else
				SAHYG.Components.toast.Toast.danger({
					message: await SAHYG.translate("ADD_FAILED"),
				}).show();
		}
	});
}

// ANCHOR edit shortcut
async function editShortcut(sc, { name, target }) {
	$.post("/shortener", {
		name,
		target,
		oldName: sc.name,
		action: "edit",
	}).done(async (data) => {
		if (data.success) {
			updateLine(sc, { name, target });
			SAHYG.Components.toast.Toast.success({
				message: await SAHYG.translate("UPDATE_SUCCESS"),
			}).show();
		} else {
			SAHYG.Components.toast.Toast.danger({
				message: await SAHYG.translate("UPDATE_FAILED"),
			}).show();
		}
	});
}
