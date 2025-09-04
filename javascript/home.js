let currentPage = 1;
let limit = 20;

let numberOfPages = 1;

let noModsDiv;
let noModsSpan;

//let selectedFolder;

document.addEventListener("DOMContentLoaded", () => {
    noModsDiv = document.querySelector("#no-mods");
    noModsSpan = noModsDiv.querySelector("& > span");

    refreshModsList().then(() => {
        refreshPagination();
        noModsSpan.innerText = "Vous n'avez aucun mod enregistré...";
    });

    const updateModsModal = document.querySelector("#update-mods-modal");

    document.querySelector("#update-mods-btn").addEventListener("click", () => {
        updateModsModal.style.display = "block";
        document.body.classList.add("modal-open");
    });

    updateModsModal.querySelectorAll("& .close, & #cancel-btn").forEach((btn) => btn.addEventListener("click", () => {
        updateModsModal.style.display = "none";
        document.body.classList.remove("modal-open");
    }));

    updateModsModal.querySelector("& .modal-content").addEventListener("click", (event) => {
        event.stopPropagation();
    });

    updateModsModal.addEventListener("click", () => {
        updateModsModal.style.display = "none";
        document.body.classList.remove("modal-open");
    });

    /*document.querySelector("#file-selector-btn").addEventListener("click", () => {
        selectDownloadFolder().then(folder => {
            document.querySelector("#file-selector").value = folder.name;
            selectedFolder = folder;
        });
    });*/

    document.querySelector("#update-btn").addEventListener("click", async () => {
        getAllMods().then(async mods => {
            const loader = document.querySelector("#loader-select").value;
            const version = document.querySelector("#version-select").value;

            downloadModsAsZip(mods, loader, version);

            /*const fetchPromises = mods.map(async mod => {
                const url = `https://api.modrinth.com/v2/project/${mod.id}/version?loaders=["${loader}"]&game_versions=["${version}"]`;

                const response = await fetch(url, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) {
                    console.error(`Erreur API pour ${mod.title}`);
                    return null;
                }

                const data = await response.json();
                if (data.length === 0) {
                    console.warn(`Pas de fichier pour ${mod.title}`);
                    return null;
                }

                return {
                    url: data[0]["files"][0]["url"],
                    filename: data[0]["files"][0]["filename"],
                    size: data[0]["files"][0]["size"],
                    id: data[0]["project_id"],
                    hash: data[0]["files"][0]["hashes"]["sha1"]
                };
            });

            const results = await Promise.all(fetchPromises);
            const downloadInfos = results.filter(r => r !== null);

            for (const info of downloadInfos) {
                try {
                    const fileResponse = await fetch(`http://localhost:3000/download?url=${encodeURIComponent(info.url)}`);

                    if (!fileResponse.ok) {
                        console.error(`Échec du téléchargement : ${info.filename}`);
                        continue;
                    }

                    const fileData = await fileResponse.blob();

                    // Créer le fichier dans le dossier choisi
                    const fileHandle = await selectedFolder.getFileHandle(info.filename, { create: true });
                    const writable = await fileHandle.createWritable();

                    // Écrire les données
                    await writable.write(fileData);
                    await writable.close();

                    console.log(`✅ Téléchargé : ${info.filename}`);
                } catch (err) {
                    console.error(`Erreur téléchargement ${info.filename}`, err);
                }
            }*/
        });

        updateModsModal.style.display = "none";
        document.body.classList.remove("modal-open");
    });
});

function refreshModsList() {
    const query = document.querySelector("#search-input").value;
    return getAllMods().then(mods => {

        if (mods.length > 0) {
            noModsSpan.innerText = "Aucun résultat";
        } else {
            noModsSpan.innerText = "Vous n'avez aucun mod enregistré...";
        }

        // Filter mods by query
        if (query && query.trim() !== "") {
            const q = query.trim().toLowerCase();

            // Filter mods by title
            mods = mods.filter(mod => (mod.title && mod.title.toLowerCase().includes(q)));
        }

        // sort mods by title
        mods.sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));

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
                }).catch(console.error).then(() => {
                    refreshModsList();
                    refreshPagination();
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
    document.querySelectorAll(".pagination").forEach(pagination => {
        pagination.querySelector("& > span").innerText = currentPage.toString();
        pagination.querySelector("& > button:first-of-type").disabled = currentPage === 1;
        pagination.querySelector("& > button:last-of-type").disabled = currentPage === numberOfPages;
    });
}

async function selectDownloadFolder() {
    try {
        // Ouvre un dialogue pour sélectionner un dossier
        return await window.showDirectoryPicker();
    } catch (err) {
        console.error("Erreur ou utilisateur a annulé :", err);
    }
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
    const content = await zip.generateAsync({ type: "blob" });

    stepLoadingBar();

    // Télécharger le zip
    saveAs(content, "mods-pack.zip");

    stepLoadingBar();

    finishLoadingBar();
}
