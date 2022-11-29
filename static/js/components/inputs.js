$(function () {
	function closeSelectMenu() {
		$("c-select.open").removeClass("open");
		return true;
	}

	SAHYG.on("click", "c-select-current", function (e) {
		let parent = $(this).closest("c-select");
		if (parent.hasClass("disabled")) return;
		$(
			$("c-select.open")
				.toArray()
				.filter((e) => e != parent[0])
		).removeClass("open");
		$(this).parent().closest("c-select").toggleClass("open");
		SAHYG.off("click", closeSelectMenu);
		SAHYG.once("click", document, closeSelectMenu);
		e.stopPropagation();
	});
	SAHYG.on("click", "c-select-option", function () {
		let select = $(this).closest("c-select");
		let value = $(this).attr("data-value");
		select.attr("data-value", value).data("value", value);
		select.children("c-select-current").text($(this).text());
		select.removeClass("open").trigger("change", value);
		select.trigger("input", [value]);
	});
	SAHYG.on("click", "c-boolean", function () {
		let elem = $(this);
		if (elem.attr("value") == "true") elem.attr("value", "false");
		else elem.attr("value", "true");
		elem.trigger("input", elem.attr("value"));
		return true;
	});

	// ANCHOR List
	function updateData(input, trigger = true) {
		input = $(input);
		let data = input.data("rows");
		if (!data) data = [];
		input
			.find("c-input-list-current c-input-list-row")
			.toArray()
			.forEach((e, i) => {
				if (!data[i]) data[i] = { rowElement: e, values: {} };
				$(e)
					.find("c-input-list-field:not(:last-child)")
					.toArray()
					.forEach((field) => {
						field = $(field);
						let value = field.find(".ta input").val() || field.find("c-select-current").text() || field.find("c-boolean").attr("value") || field.find("span").text();
						if (field.find("c-boolean").length) value = value == "true";
						let name = field.attr("name");
						data[i].values[name] = value;
					});
			});
		input.data("rows", data);
		if (trigger) $(input).trigger("input");
	}
	SAHYG.on("click", "c-input-list-add btn", function () {
		let input = $(this).closest("c-input-list");
		let template = input.find("c-input-list-template c-input-list-row").clone();
		let body = input.find("c-input-list-body");
		body.append(template);
		updateData(input);
		input.trigger("add");
	});
	SAHYG.on("click", "c-input-list-field:last-child btn", async function () {
		if (!(await SAHYG.Components.popup.Popup.confirm(await SAHYG.translate("SETTINGS_CUSTOM_DELETE_CONFIRM"))).confirm) return;
		let row = $(this).closest("c-input-list-row");
		let input = $(this).closest("c-input-list");
		row.remove();
		let rowsData = input.data("rows");
		let rowIndex = rowsData.findIndex((e) => e.rowElement == row.get(0));
		if (rowIndex != -1) input.data("rows", (rowsData.splice(rowIndex), rowsData));
		updateData(input);
	});
	SAHYG.on("input", "c-input-list .ta input, c-input-list c-boolean, c-input-list c-select", function () {
		updateData($(this).closest("c-input-list"));
	});

	$("c-input-list").each(function () {
		updateData(this, false);
	});
	SAHYG.on("change", "c-input-list", function () {
		updateData($(this), false);
	});
});
