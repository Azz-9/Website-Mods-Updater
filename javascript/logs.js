document.addEventListener("DOMContentLoaded", async () => {
	const noLastUpdate = document.querySelector("#no-last-update");
	const noLastUpdateSpan = document.querySelector("#no-last-update > span");
	const logsSection = document.querySelector("#logs-section");
	const dateElement = logsSection.querySelector("& > #date");
	const selectedOptions = logsSection.querySelector("& > #selected-options")
	const unavailableMods = logsSection.querySelector("& > h4");
	const template = logsSection.querySelector("& > #not-available-mods-list > template");
	const notAvailableModsList = document.querySelector("#not-available-mods-list");
	const searchInput = document.querySelector("#search-input");

	await i18n.init(refreshLogs);

	refreshLogs();

	searchInput.addEventListener("input", () => {
		const query = searchInput.value;
		const items = notAvailableModsList.querySelectorAll("li");

		items.forEach(item => {
			const title = item.querySelector(".title").innerText;
			const matches = title.toLowerCase().includes(query.toLowerCase());
			item.style.display = matches ? "block" : "none";
		});
	})

	function refreshLogs() {
		const logs = JSON.parse(localStorage.getItem("logs"));

		if (!logs) {
			noLastUpdateSpan.innerText = i18n.get("logs.no_update");
		} else {
			noLastUpdate.style.display = "none";
			logsSection.style.display = "block";

			const date = new Date(logs["date"]);
			dateElement.innerText = i18n.get("logs.latest_update", {
				date: date.getDate() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear(),
				time: date.getHours() + "h " + date.getMinutes() + "m " + date.getSeconds() + "s"
			});
			selectedOptions.innerText = i18n.get("logs.selected_options", {
				loader: logs["loader"], version: logs["version"]
			});
			unavailableMods.innerText = i18n.get("logs.unavailable_mods", {
				loader: logs["loader"], version: logs["version"]
			});

			logs["notAvailableMods"].forEach(mod => {
				const clone = template.content.firstElementChild.cloneNode(true);

				clone.querySelector("& .thumbnail").src = (mod.icon_url ? mod.icon_url : "assets/missing_icon.png");
				clone.querySelector("& .thumbnail").alt = mod.title + " icon";
				clone.querySelector("& .title").innerText = mod.title;

				notAvailableModsList.appendChild(clone);
			});
		}
	}
});