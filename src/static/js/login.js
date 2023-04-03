let pass =
	/^(?=(?:[^A-Z]*[A-Z])+(?![^A-Z]*[A-Z]))(?=(?:[^a-z]*[a-z])+(?![^a-z]*[a-z]))(?=(?:[^0-9]*[0-9])+(?![^0-9]*[0-9]))(?=(?:[^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~])+(?![^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]))[A-Za-z0-9!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]{8,}$/;
let email =
	/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/i;

SAHYG.onload(function () {
	if (SAHYG.Utils.user.isConnected()) location.href = SAHYG.Utils.url.getParams()?.redirect || "/";
	let submit = false;
	SAHYG.on("input", "container form #login", function () {
		if (!this.value) SAHYG.$0("container form .ta-login").removeClass("invalid").removeClass("valid");
		else if (this.value.includes("@") ? email.test(this.value) : this.value.length > 3) {
			SAHYG.$0("container form .ta-login").removeClass("invalid").addClass("valid");
		} else {
			SAHYG.$0("container form .ta-login").removeClass("valid").addClass("invalid");
		}
	});
	SAHYG.on("input", "container form #password", function () {
		if (!this.value) SAHYG.$0("container form .ta-password").removeClass("invalid").removeClass("valid");
		else if (pass.test(this.value)) {
			SAHYG.$0("container form .ta-password").removeClass("invalid").addClass("valid");
		} else {
			SAHYG.$0("container form .ta-password").removeClass("valid").addClass("invalid");
		}
	});
	SAHYG.on("submit", "container form", async (e) => {
		e.preventDefault();
		if (submit) return null;
		if (!SAHYG.$0("#password, #login").parentElement.hasClass("valid"))
			return SAHYG.Components.toast.Toast.danger({ message: await SAHYG.translate("FILL_REQUIRED") }).show();
		let login = SAHYG.$0("#login").value?.toLowerCase();
		let password = SAHYG.$0("#password").value;
		if (login && password) {
			let loader = SAHYG.createElement("sahyg-loader", { "loader-height": "2rem", "loader-width": "2rem" });
			e.target.$0(".submit").textContent = "";
			e.target.$0(".submit").append(loader);

			submit = true;
			SAHYG.Api.login(login, password)
				.catch(console.error)
				.then(async (res) => {
					if (res) location.href = SAHYG.Utils.url.getParams()?.redirect || "/";
					else {
						loader.remove();
						e.target.$0(".submit").textContent = await SAHYG.translate("SUBMIT");
						submit = false;
					}
				});
		}
	});
	SAHYG.on("click", "container form > sahyg-button", function () {
		let event = new Event("submit");
		SAHYG.$0("container form").dispatchEvent(event);
	});
	SAHYG.on("click", "container form .show", function ({ target }) {
		if (target.getAttribute("status") == "on") {
			SAHYG.$0("container form #password").setAttribute("type", "password");
			target.setAttribute("status", "off");
		} else {
			SAHYG.$0("container form #password").setAttribute("type", "text");
			target.setAttribute("status", "on");
		}
	});
});
