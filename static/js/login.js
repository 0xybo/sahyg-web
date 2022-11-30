let pass =
	/^(?=(?:[^A-Z]*[A-Z])+(?![^A-Z]*[A-Z]))(?=(?:[^a-z]*[a-z])+(?![^a-z]*[a-z]))(?=(?:[^0-9]*[0-9])+(?![^0-9]*[0-9]))(?=(?:[^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~])+(?![^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]))[A-Za-z0-9!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]{8,}$/;
let email =
	/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/i;

$(function () {
	if (SAHYG.Utils.user.isConnected()) location.href = SAHYG.Utils.url.getParams()?.redirect || "/";
	let submit = false;
	SAHYG.on("input", "container form #login", function () {
		if (!$(this).val()) $("container form .ta-login").removeClass("invalid").removeClass("valid");
		else if ($(this).val().includes("@") ? email.test($(this).val()) : $(this).val().length > 3) {
			$("container form .ta-login").removeClass("invalid").addClass("valid");
		} else {
			$("container form .ta-login").removeClass("valid").addClass("invalid");
		}
	});
	SAHYG.on("input", "container form #password", function () {
		if (!$(this).val()) $("container form .ta-password").removeClass("invalid").removeClass("valid");
		else if (pass.test($(this).val())) {
			$("container form .ta-password").removeClass("invalid").addClass("valid");
		} else {
			$("container form .ta-password").removeClass("valid").addClass("invalid");
		}
	});
	SAHYG.on("submit", "container form", async (e) => {
		e.preventDefault();
		if (submit) return null;
		if (!$("#password, #login").parent().hasClass("valid"))
			return SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("FILL_REQUIRED") }).show();
		let login = $("#login").val()?.toLowerCase();
		let password = $("#password").val();
		if (login && password) {
			let loader = SAHYG.Components.loader.replaceElementContents($("container form btn"), false);
			submit = true;
			let res = await SAHYG.Api.login(login, password);
			if (!res.success) {
				loader.done();
				submit = false;
				SAHYG.Components.toast.Toast.danger({ message: "An error occurred" }).show();
				return;
			}
			// location.href = SAHYG.Utils.url.getParams()?.redirect || "/";
		}
	});
	SAHYG.on("click", "container form btn", $("container form").trigger.bind($("container form"), "submit"));
});
