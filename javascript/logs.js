document.addEventListener("DOMContentLoaded", () => {
    const logs = JSON.parse(localStorage.getItem("logs"));

    if (!logs) {
        document.querySelector("#no-last-update > span").innerText = "Vous n'avez jamais fait de mise à jour";
    } else {
        document.querySelector("#no-last-update").style.display = "none";
        const logsSection= document.querySelector("#logs-section");
        logsSection.style.display = "block";

        const date = new Date(logs["date"]);
        logsSection.querySelector("& > #date").innerText = "Dernier téléchargement le " +
            date.getDate() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear() + " à " +
            date.getHours() + "h " + date.getMinutes() + "m " + date.getSeconds() + "s";
        logsSection.querySelector("& > #selected-options").innerText = "Loader: " + logs["loader"] + ", Version: " + logs["version"];
        logsSection.querySelector("& > h4").innerText = "Mods qui ne sont pas disponible en " + logs["loader"] + " " + logs["version"];

        logs["notAvailableMods"].forEach(mod => {
            const clone = logsSection.querySelector("& > #not-available-mods-list > template").content.firstElementChild.cloneNode(true);

            console.log(mod)

            clone.querySelector("& .thumbnail").src = (mod.icon_url ? mod.icon_url : "assets/missing_icon.png");
            clone.querySelector("& .thumbnail").alt = mod.title + " icon";
            clone.querySelector("& .title").innerText = mod.title;

            document.querySelector("#not-available-mods-list").appendChild(clone);
        });
    }

    document.querySelector("#search-input").addEventListener("input", () => {
        const query = document.querySelector("#search-input").value;
        const list = document.querySelector("#not-available-mods-list");
        const items = list.querySelectorAll("li");

        items.forEach(item => {
            const title = item.querySelector(".title").innerText;
            const matches = title.toLowerCase().includes(query.toLowerCase());
            item.style.display = matches ? "block" : "none";
        });
    })
});