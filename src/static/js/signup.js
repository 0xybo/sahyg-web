SAHYG.onload(function () {
	let pass =
		/^(?=(?:[^A-Z]*[A-Z])+(?![^A-Z]*[A-Z]))(?=(?:[^a-z]*[a-z])+(?![^a-z]*[a-z]))(?=(?:[^0-9]*[0-9])+(?![^0-9]*[0-9]))(?=(?:[^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~])+(?![^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]))[A-Za-z0-9!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]{8,32}$/;
	let email =
		/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/i;

	SAHYG.$0("#username").on("input", function () {
		if (this.value == "") this.parent.removeClass("valid").addClass("invalid");
		else if (/^[a-z0-9_]{3,10}$/.test(this.value)) this.parent.removeClass("invalid").addClass("valid");
		else this.parent.removeClass("valid").addClass("invalid");
	});
	SAHYG.$("#firstname, #lastname").on("input", function () {
		if (this.value == "") this.parent.removeClass("valid");
		else this.parent.addClass("valid");
	});
	SAHYG.$0("#email").on("input", function () {
		if (this.value == "") this.parent.removeClass("valid").addClass("invalid");
		else if (email.test(this.value)) this.parent.removeClass("invalid").addClass("valid");
		else this.parent.removeClass("valid").addClass("invalid");
	});
	SAHYG.$0("#password").on("input", function () {
		SAHYG.$0("container .password-requirements li").removeClass("valid");
		let val = this.value;
		if (val == "") this.parent.removeClass("valid").addClass("invalid");
		else if (pass.test(val)) this.parent.removeClass("invalid").addClass("valid");
		else {
			this.parent.removeClass("valid").addClass("invalid");
			if (/[A-Z]/.test(val)) SAHYG.$0("container .password-requirements .upper").addClass("valid");
			if (/[a-z]/.test(val)) SAHYG.$0("container .password-requirements .lower").addClass("valid");
			if (/[0-9]/.test(val)) SAHYG.$0("container .password-requirements .digit").addClass("valid");
			if (/[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]/.test(val)) SAHYG.$0("container .password-requirements .special").addClass("valid");
			if (/.{8,32}/.test(val)) SAHYG.$0("container .password-requirements .min-max").addClass("valid");
		}
	});
	SAHYG.$0("#password-confirm").on("input", function () {
		if (this.value == "") this.parent.removeClass("valid").addClass("invalid");
		else if (this.value == SAHYG.$0("#password").value && pass.test(this.value)) this.parent.removeClass("invalid").addClass("valid");
		else this.parent.removeClass("valid").addClass("invalid");
	});
	SAHYG.$0("container form").on("submit", async function (e) {
		e.preventDefault();
		if (!SAHYG.$("#password, #username, #email").parent.allHasClass("valid"))
			return SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("FILL_REQUIRED") }).show();
		SAHYG.Api.post(
			"/signup",
			{
				username: SAHYG.$0("#username").value?.toLowerCase(),
				password: SAHYG.$0("#password").value,
				firstname: SAHYG.$0("#firstname").value,
				lastname: SAHYG.$0("#lastname").value,
				email: SAHYG.$0("#email").value,
			},
			true
		)
			.then((res) => {
				if (res.success) window.location = SAHYG.Utils.url.getParams()?.redirect || "/";
			})
			.catch(console.error);
	});
});
