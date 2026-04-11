document.addEventListener("DOMContentLoaded", () => {
	const dropArea = document.querySelector("#drag_n_drop");

	// Highlight zone when dragging something over
	dropArea.addEventListener("dragover", (event) => {
		event.preventDefault(); // prevent browser from opening the file
		dropArea.classList.add("drag-over"); // optional: add CSS highlight
	});

	// Remove highlight when leaving
	dropArea.addEventListener("dragleave", () => {
		dropArea.classList.remove("drag-over");
	});

	// Handle drop
	dropArea.addEventListener("drop", async (event) => {
		event.preventDefault();
		dropArea.classList.remove("drag-over");

		const files = event.dataTransfer.files; // FileList
		await handleSelectedFiles(files);
		await refreshModsList();
		refreshPagination();
	});

	document.querySelector("#not-found-modal .close").addEventListener("click", () => {
		document.querySelector("#not-found-modal").style.display = "none";
		document.body.classList.remove("modal-open");
	});

	document.querySelector("#not-found-modal").addEventListener("click", () => {
		document.querySelector("#not-found-modal").style.display = "none";
		document.body.classList.remove("modal-open");
	});

	document.querySelector("#not-found-modal > .modal-content").addEventListener("click", (event) => {
		event.stopPropagation();
	})

	const fileInput = document.querySelector("#file-input");
	document.querySelector("#drag_n_drop").addEventListener("click", () => {
		fileInput.click();
	});

	fileInput.addEventListener("change", async (event) => {
		const files = Array.from(event.target.files);
		await handleSelectedFiles(files);
		await refreshModsList();
		refreshPagination();
	});
});

async function handleSelectedFiles(files) {
	startLoadingBar(files.length * 2 + 2)

	const hashes = [];
	const fileMap = {}; // map hash -> file name
	const notFoundFiles = [];

	for (const file of files) {
		if (!file.name.endsWith(".jar")) {
			notFoundFiles.push(file.name);
			stepLoadingBar();
			steps -= 1;
			continue;
		}

		// Compute SHA1 of file
		const arrayBuffer = await file.arrayBuffer();
		const hashBuffer = await crypto.subtle.digest("SHA-1", arrayBuffer);

		// Convert ArrayBuffer -> hex string
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

		hashes.push(hashHex);
		fileMap[hashHex] = file.name;

		stepLoadingBar();
	}

	if (hashes.length !== 0) {
		try {
			// Query Modrinth API with all hashes at once
			const response = await fetch("https://api.modrinth.com/v2/version_files", {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({
					hashes: hashes,
					algorithm: "sha1"
				})
			});

			stepLoadingBar();

			if (!response.ok) throw new Error("API request failed: " + response.status);

			const modsData = await response.json();

			stepLoadingBar();

			const promises = [];

			for (const hash of hashes) {
				const version = modsData[hash];

				if (!version) {
					notFoundFiles.push(fileMap[hash]);
					stepLoadingBar();
					continue; // skip if not found
				}

				const promise = modExists(version.project_id).then(async exists => {
					if (!exists) {
						// A "version" object contains `project_id` and project data
						const projectResp = await fetch(`https://api.modrinth.com/v2/project/${version.project_id}`);
						const project = await projectResp.json();

						const mod = new Mod(
							project.title,
							project.id,
							project.description,
							project.icon_url,
							project.slug,
							true
						);

						// Store in IndexedDB
						await addMod(mod);
						refreshModsList();
					}
				}).then(() => stepLoadingBar());

				promises.push(promise);
			}

			await Promise.all(promises);

		} catch (err) {
			console.error("Error fetching mod info from Modrinth:", err);
		}
	}

	// Afficher la modale si des fichiers n'ont pas été trouvés
	if (notFoundFiles.length > 0) {
		const listEl = document.querySelector("#not-found-list");
		listEl.innerHTML = "";
		notFoundFiles.forEach(name => {
			const li = document.createElement("li");
			li.textContent = name;
			listEl.appendChild(li);
		});
		document.querySelector("#not-found-modal").style.display = "block";
		document.body.classList.add("modal-open");
	}

	finishLoadingBar();
}