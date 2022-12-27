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

	// ANCHOR Array
	function updateData(input, trigger = true) {
		input = $(input);
		let data = input.data("rows");
		if (!data) data = [];
		input
			.find("c-input-array-current c-input-array-row")
			.toArray()
			.forEach((e, i) => {
				if (!data[i]) data[i] = { rowElement: e, values: {} };
				$(e)
					.find("c-input-array-field:not(:last-child)")
					.toArray()
					.forEach((field) => {
						field = $(field);
						let value =
							field.find(".ta input").val() ||
							field.find("c-select-current").text() ||
							field.find("c-boolean").attr("value") ||
							field.find("span").text();
						if (field.find("c-boolean").length) value = value == "true";
						let name = field.attr("name");
						data[i].values[name] = value;
					});
			});
		input.data("rows", data);
		if (trigger) input.trigger("input", ["update", data]);
	}
	SAHYG.on("click", "c-input-array-add btn", function () {
		let input = $(this).closest("c-input-array");
		let template = input.find("c-input-array-template c-input-array-row").clone();
		let body = input.find("c-input-array-body");
		body.append(template);
		updateData(input);
		input.trigger("input", ["add", template]);
	});
	SAHYG.on("click", "c-input-array-field:last-child btn", async function () {
		if (!(await SAHYG.Components.popup.Popup.confirm(await SAHYG.translate("SETTINGS_CUSTOM_DELETE_CONFIRM"))).confirm) return;
		let row = $(this).closest("c-input-array-row");
		let input = $(this).closest("c-input-array");
		row.remove();
		let rowsData = input.data("rows");
		let rowIndex = rowsData.findIndex((e) => e.rowElement == row.get(0));
		let deletedRow = rowsData[rowIndex]
		if (rowIndex != -1) input.data("rows", (rowsData.splice(rowIndex), rowsData));
		updateData(input, false)
		input.trigger("input", ["delete", deletedRow]);
	});
	SAHYG.on("input", "c-input-array .ta input, c-input-array c-boolean, c-input-array c-select", function () {
		updateData($(this).closest("c-input-array"));
	});

	$("c-input-array").each(function () {
		updateData(this, false);
	});
	SAHYG.on("change", "c-input-array", function () {
		updateData($(this), false);
	});

	// List
	function listNewEntry(value) {
		let valueElement = SAHYG.createElement("c-input-list-value", {}, SAHYG.createElement("c-input-list-value-text", {}, value));
		valueElement.append(SAHYG.createElement("c-input-list-value-remove"));
		return valueElement;
	}

	SAHYG.on("click", "c-input-list-add", async function ({ target }) {
		let { value } =
			(await SAHYG.Components.popup.Popup.input(await SAHYG.translate("ADD"), [
				{
					name: "value",
					label: await SAHYG.translate("VALUE"),
					placeholder: await SAHYG.translate("VALUE"),
					type: "text",
					defaultValue: "",
				},
			])) || {};
		if (value) $(target).closest("c-input-list").find("c-input-list-values").append(listNewEntry(value));
		$(target).closest("c-input-list").trigger("input", value);
	});
	SAHYG.on("click", "c-input-list-value-remove", function ({ target }) {
		target = $(target);
		let $list = target.closest("c-input-list");
		let $values = target.closest("c-input-list-values");

		target.closest("c-input-list-value").remove();

		$list.trigger(
			"input",
			$values.children().map((elem) => elem.innerText)
		);
	});
});
