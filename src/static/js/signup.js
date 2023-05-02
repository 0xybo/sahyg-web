SAHYG.onload(function () {
	let regexp = {
		password:
			/^(?=(?:[^A-Z]*[A-Z])+(?![^A-Z]*[A-Z]))(?=(?:[^a-z]*[a-z])+(?![^a-z]*[a-z]))(?=(?:[^0-9]*[0-9])+(?![^0-9]*[0-9]))(?=(?:[^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~])+(?![^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]))[A-Za-z0-9!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]{8,32}$/,
		email: /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/i,
		name: /^[a-zA-ZàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,.'-]+$/,
		username: /^[a-z0-9_]{3,10}$/,
	};

	let form = SAHYG.$0("container form"),
		username = SAHYG.$0("#username"),
		firstname = SAHYG.$0("#firstname"),
		lastname = SAHYG.$0("#lastname"),
		email = SAHYG.$0("#email"),
		password = SAHYG.$0("#password"),
		passwordConfirm = SAHYG.$0("#password-confirm"),
		requirements = {
			minMax: SAHYG.$0("container .password-requirements .min-max"),
			upper: SAHYG.$0("container .password-requirements .upper"),
			lower: SAHYG.$0("container .password-requirements .lower"),
			special: SAHYG.$0("container .password-requirements .special"),
			digit: SAHYG.$0("container .password-requirements .digit"),
		};

	username.setValidator(regexp.username);
	firstname.setValidator(regexp.name);
	lastname.setValidator(regexp.name);
	email.setValidator(regexp.email);
	password.setValidator(function (val) {
		if (/.{8,32}/.test(val)) requirements.minMax.addClass("valid");
		if (/[A-Z]/.test(val)) requirements.upper.addClass("valid");
		if (/[a-z]/.test(val)) requirements.lower.addClass("valid");
		if (/[0-9]/.test(val)) requirements.digit.addClass("valid");
		if (/[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]/.test(val)) requirements.special.addClass("valid");

		return regexp.password.test(val);
	});
	passwordConfirm.setValidator(function (val) {
		return val === password.value;
	});

	form.on("submit", async function (event) {
		event.preventDefault();
		if (
			regexp.password.test(password.value) &&
			passwordConfirm.value === password.value &&
			regexp.username.test(username.value) &&
			regexp.email.test(email.value)
		) {
			let response = await SAHYG.Api.post("/signup", {
				username: username.value?.toLowerCase(),
				password: password.value,
				firstname: firstname.value,
				lastname: lastname.value,
				email: email.value,
			});
			if (response?.success) window.location = SAHYG.Utils.url.getParams()?.redirect || "/";
		} else {
			SAHYG.createElement("sahyg-toast", { type: "error", content: await SAHYG.translate("FILL_REQUIRED") }).show();
		}
	});
});
