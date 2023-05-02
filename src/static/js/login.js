let pass =
	/^(?=(?:[^A-Z]*[A-Z])+(?![^A-Z]*[A-Z]))(?=(?:[^a-z]*[a-z])+(?![^a-z]*[a-z]))(?=(?:[^0-9]*[0-9])+(?![^0-9]*[0-9]))(?=(?:[^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~])+(?![^!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]*[!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]))[A-Za-z0-9!"#\$%&'\(\)\*\+,-\.\/:;<=>\?@[\]\^_`\{\|}~]{8,}$/;
let email =
	/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/i;

SAHYG.onload(function () {
	if (SAHYG.Utils.user.isConnected()) location.href = SAHYG.Utils.url.getParams()?.redirect || "/";
	let submit = false;

	SAHYG.$0("#login").setValidator((value) => (value.includes("@") ? email.test(value) : value.length > 3));
	SAHYG.$0("#password").setValidator(pass);

	SAHYG.on("submit", "container form", async (e) => {
		e.preventDefault();
		if (submit) return null;

		let login = SAHYG.$0("#login").value?.toLowerCase();
		let password = SAHYG.$0("#password").value;

		if (login && password) {
			let loader = SAHYG.createElement("sahyg-loader", { "loader-height": "2rem", "loader-width": "2rem" });
			e.target.$0(".submit").textContent = "";
			e.target.$0(".submit").append(loader);

			submit = true;
			let res = await SAHYG.Api.post("/login", { login, password });
			if (res.success) location.href = SAHYG.Utils.url.getParams()?.redirect || "/";
			else {
				loader.remove();
				e.target.$0(".submit").textContent = await SAHYG.translate("SUBMIT");
				submit = false;
			}
		} else return SAHYG.createElement("sahyg-toast", { type: "error", content: await SAHYG.translate("FILL_REQUIRED") }).show();
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
