/** @type {import('./lib/jquery')} */ $;

let pass =
	/^(?=(?:[^A-Z]*[A-Z])+(?![^A-Z]*[A-Z]))(?=(?:[^a-z]*[a-z])+(?![^a-z]*[a-z]))(?=(?:[^0-9]*[0-9])+(?![^0-9]*[0-9]))(?=(?:[^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~])+(?![^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]))[A-Za-z0-9!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]{8,32}$/;
let email =
	/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/i;

$(function () {
	SAHYG.on("input", "#username", function () {
		if ($(this).val() == "") $(this).parent().removeClass("valid").addClass("invalid");
		else if (/^[a-z0-9_]{3,10}$/.test($(this).val())) $(this).parent().removeClass("invalid").addClass("valid");
		else $(this).parent().removeClass("valid").addClass("invalid");
	});
	SAHYG.on("input", "#firstname, #lastname", function () {
		if ($(this).val() == "") $(this).parent().removeClass("valid");
		else $(this).parent().addClass("valid");
	});
	SAHYG.on("input", "#email", function () {
		if ($(this).val() == "") $(this).parent().removeClass("valid").addClass("invalid");
		else if (email.test($(this).val())) $(this).parent().removeClass("invalid").addClass("valid");
		else $(this).parent().removeClass("valid").addClass("invalid");
	});
	SAHYG.on("input", "#password", function () {
		$("container .password-requirements li").removeClass("valid");
		let val = $(this).val();
		if (val == "") $(this).parent().removeClass("valid").addClass("invalid");
		else if (pass.test(val)) $(this).parent().removeClass("invalid").addClass("valid");
		else {
			$(this).parent().removeClass("valid").addClass("invalid");
			if (/[A-Z]/.test(val)) $("container .password-requirements .upper").addClass("valid");
			if (/[a-z]/.test(val)) $("container .password-requirements .lower").addClass("valid");
			if (/[0-9]/.test(val)) $("container .password-requirements .digit").addClass("valid");
			if (/[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]/.test(val)) $("container .password-requirements .special").addClass("valid");
			if (/.{8,32}/.test(val)) $("container .password-requirements .min-max").addClass("valid");
		}
	});
	SAHYG.on("input", "#password-confirm", function () {
		if ($(this).val() == "") $(this).parent().removeClass("valid").addClass("invalid");
		else if ($(this).val() == $("#password").val() && pass.test($(this).val())) $(this).parent().removeClass("invalid").addClass("valid");
		else $(this).parent().removeClass("valid").addClass("invalid");
	});
	SAHYG.on("submit", "container form", async function (e) {
		e.preventDefault();
		if (!$("#password, #username, #email").parent().hasClass("valid"))
			return SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("FILL_REQUIRED") }).show();
		SAHYG.Api.post(
			"/signup",
			{
				username: $("#username").val()?.toLowerCase(),
				password: $("#password").val(),
				firstname: $("#firstname").val(),
				lastname: $("#lastname").val(),
				email: $("#email").val(),
			},
			true
		)
			.then((res) => {
				if (res.success) window.location = SAHYG.Utils.url.getParams()?.redirect || "/";
			})
			.catch(() => {});
	});
});
