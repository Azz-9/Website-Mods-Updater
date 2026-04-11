let currentPage = 1;
let limit = 20;

let numberOfPages = 1;

let noModsDiv;
let noModsSpan;


document.addEventListener("DOMContentLoaded", () => {
	noModsDiv = document.querySelector("#no-mods");
	noModsSpan = noModsDiv.querySelector("& > span");
	const updateModsBtn = document.querySelector("#update-mods-btn");
	const loaderSelect = document.querySelector("#loader-select");
	const versionSelect = document.querySelector("#version-select");

	fetch("https://api.modrinth.com/v2/tag/game_version").then(response => response.json()).then(versions => {
		versions = versions.filter(version => version["version_type"] === "release")
		versions.forEach(version => {
			const option = new Option(version["version"], version["version"]);
			versionSelect.add(option);
		})

		const selectedVersion = localStorage.getItem("version")
		if (selectedVersion) {
			versionSelect.value = selectedVersion;
		} else {
			versionSelect.value = versions[0]["version"];
		}
	});

	fetch("https://api.modrinth.com/v2/tag/loader").then(response => response.json()).then(loaders => {
		const priority = {
			"fabric": 1,
			"forge": 2,
			"neoforge": 3,
			"quilt": 4
		};

		const options = loaders
			.filter(loader =>
				!loader["supported_project_types"].includes("plugin") &&
				loader["supported_project_types"].includes("mod")
			)
			.map(loader => {
				let text;
				if (loader["name"] === "bta-babric") { //special case for BTA (Babric)
					text = "BTA (Babric)";
				} else {
					text = loader["name"].charAt(0).toUpperCase() + loader["name"].slice(1).replace("-", " ");
				}
				return new Option(text, loader["name"]);
			});

		// Sort options: first by priority if exists, else keep original order
		options.sort((a, b) => {
			const pa = priority[a.value] || Infinity;
			const pb = priority[b.value] || Infinity;
			return pa - pb;
		});

		// Append sorted options
		options.forEach(option => loaderSelect.add(option));

		const selectedLoader = localStorage.getItem("loader")
		if (selectedLoader) {
			loaderSelect.value = selectedLoader;
		} else {
			loaderSelect.value = options[0].value;
		}
	});

	loaderSelect.addEventListener("change", () => {
		localStorage.setItem("loader", loaderSelect.value);
	});

	versionSelect.addEventListener("change", () => {
		localStorage.setItem("version", versionSelect.value);
	})

	refreshModsList().then(() => {
		refreshPagination();
	});

	updateModsBtn.addEventListener("click", async () => {
		getAllMods().then(async mods => {
			const loader = loaderSelect.value;
			const version = versionSelect.value;

			downloadModsAsZip(mods, loader, version);
		});
	});
});


function refreshModsList() {
	const query = document.querySelector("#search-input").value;
	return getAllMods().then(mods => {

		document.querySelector("#mods-list > h2").innerText = `Vos mods (${mods.length})`

		if (mods.length > 0) {
			noModsSpan.innerText = "Aucun résultat";
		} else {
			noModsSpan.innerText = "Vous n'avez aucun mod enregistré";
		}

		// Filter mods by query
		if (query && query.trim() !== "") {
			const q = query.trim().toLowerCase();

			// Filter mods by title
			mods = mods.filter(mod => (mod.title && mod.title.toLowerCase().includes(q)));
		}

		// sort mods by title
		mods.sort((a, b) => a.title.localeCompare(b.title, "en", {sensitivity: "base"}));

		if (mods.length === 0) {
			noModsDiv.style.display = "flex";
		} else {
			noModsDiv.style.display = "none";
		}

		numberOfPages = Math.ceil(mods.length / limit);

		if (mods.length <= limit) {
			document.querySelectorAll(".pagination").forEach(pagination => pagination.style.display = "none");
		} else {
			document.querySelectorAll(".pagination").forEach(pagination => pagination.style.display = "flex");
			document.querySelector("#pagination-section").style.display = "initial";
		}

		let offset = (currentPage - 1) * limit;

		// Apply offset and limit after sorting
		if (offset < 0) offset = 0;
		mods = mods.slice(offset, offset + limit);

		document.querySelectorAll("#mods-container > li").forEach(li => li.remove());

		mods.forEach(mod => {
			const template = document.querySelector("#mod-template");
			const container = document.querySelector("#mods-container");

			// Clone the actual root node from the template (not the fragment)
			const el = template.content.firstElementChild.cloneNode(true); // <- element, not fragment
			const checkbox = el.querySelector(".right-info > input[type=\"checkbox\"]");

			// Fill content
			el.querySelectorAll(".link").forEach(a => a.href = "https://modrinth.com/mod/" + mod.slug);
			el.querySelector(".thumbnail").src = (mod.icon_url ? mod.icon_url : "assets/missing_icon.png");
			el.querySelector(".thumbnail").alt = mod.title + " icon";
			el.querySelector(".title").innerText = mod.title;
			el.querySelector(".description").innerText = mod.description;
			checkbox.id = checkbox.id += mod.id;
			el.querySelector(".toggle-btn-label").htmlFor = checkbox.id;
			el.querySelector(".right-info > input").checked = mod.enabled;

			checkbox.addEventListener("change", (event) => {
				setEnabled(mod.id, event.target.checked);
			});

			// Delete handler: remove the inserted element
			el.querySelector(".red-btn").addEventListener("click", () => {
				deleteMod(mod.id).then(deleted => {
					if (deleted) {
						el.remove(); // remove the actual card element
					}
				}).catch(console.error).then(async () => {
					await refreshModsList();
					refreshPagination();
					await refreshModsList();
				});
			});

			container.appendChild(el);
		});

		return mods;
	})
}

function onPaginationClick(offset) {
	currentPage += offset;
	refreshPagination();
	refreshModsList();
}

function refreshPagination() {
	if (currentPage > numberOfPages) {
		currentPage = numberOfPages;
	}
	document.querySelectorAll(".pagination").forEach(pagination => {
		pagination.querySelector("& > span").innerText = currentPage.toString();
		pagination.querySelector("& > button:first-of-type").disabled = currentPage === 1;
		pagination.querySelector("& > button:last-of-type").disabled = currentPage === numberOfPages;
	});
}

async function downloadModsAsZip(mods, loader, version) {
	startLoadingBar(mods.length + 2);

	const zip = new JSZip();

	const notAvailable = [];

	const fetchPromises = mods.map(async mod => {
		if (mod.enabled === false) return null;

		const url = `https://api.modrinth.com/v2/project/${mod.id}/version?loaders=["${loader}"]&game_versions=["${version}"]`;

		const response = await fetch(url);
		if (!response.ok) {
			stepLoadingBar();
			return null;
		}

		const data = await response.json();
		if (data.length === 0) {
			notAvailable.push({"id": mod.id, "icon_url": mod.icon_url, "title": mod.title});
			stepLoadingBar();
			return null;
		}

		const fileInfo = data[0].files[0];

		// Télécharger le fichier jar
		const fileResponse = await fetch(fileInfo.url);
		if (!fileResponse.ok) {
			stepLoadingBar();
			return null;
		}

		const blob = await fileResponse.blob();
		const arrayBuffer = await blob.arrayBuffer();

		// Ajouter au zip
		zip.file(fileInfo.filename, arrayBuffer);

		console.log(`Ajouté au zip: ${fileInfo.filename}`);
		stepLoadingBar();

		return fileInfo.filename;
	});

	// Attendre tous les fetchs
	await Promise.all(fetchPromises);

	localStorage.setItem("logs", JSON.stringify({
		"date": new Date().toISOString(),
		"loader": loader,
		"version": version,
		"notAvailableMods": notAvailable
	}));

	// Générer le fichier zip
	const content = await zip.generateAsync({type: "blob"});

	stepLoadingBar();

	// Télécharger le zip
	saveAs(content, "mods-pack.zip");

	stepLoadingBar();

	finishLoadingBar();
}