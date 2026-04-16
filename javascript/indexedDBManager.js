let db;
let dbReady = new Promise((resolve, reject) => {
	const request = window.indexedDB.open("mods-db", 2);

	request.onerror = (event) => reject(event.target.error);

	request.onsuccess = (event) => {
		db = event.target.result;
		resolve(db);
	};

	request.onupgradeneeded = (event) => {
		db = event.target.result;
		const oldVersion = event.oldVersion;

		// v1 → création du store mods
		if (oldVersion < 1) {
			db.createObjectStore("mods", {keyPath: "id"});
		}

		// v1 → v2 : ajout des profils et de la table de liaison
		if (oldVersion < 2) {
			db.createObjectStore("profiles", {keyPath: "id"});

			const profileMods = db.createObjectStore("profileMods", {keyPath: "id"});
			profileMods.createIndex("byProfile", "profileId", {unique: false});
			profileMods.createIndex("byMod", "modId", {unique: false});

			// Migration : récupérer les mods existants et créer un profil "Default"
			// (fait dans la transaction onupgradeneeded via event.target.transaction)
			const tx = event.target.transaction;
			const profileStore = tx.objectStore("profiles");
			const profileModsStore = tx.objectStore("profileMods");
			const modsStore = tx.objectStore("mods");

			const defaultProfile = {id: "default", name: "Default"};
			profileStore.add(defaultProfile);

			// Migrer les mods existants vers le profil default
			modsStore.getAll().onsuccess = (e) => {
				for (const mod of e.target.result) {
					const enabled = mod.enabled ?? true;
					delete mod.enabled; // nettoyer le champ
					modsStore.put(mod);
					profileModsStore.add({
						id: `default_${mod.id}`,
						profileId: "default",
						modId: mod.id,
						enabled,
					});
				}
			};
		}
	};
});

// --- profils ---

function addProfile(profile) {
	// profile : { id, name }
	return new Promise((resolve, reject) => {
		dbReady.then(() => {
			const tx = db.transaction(["profiles"], "readwrite");
			const store = tx.objectStore("profiles");
			const req = store.add(profile);
			req.onsuccess = () => resolve(true);
			req.onerror = (e) => reject(e.target.error);
		});
	});
}

function deleteProfile(profileId) {
	return new Promise((resolve, reject) => {
		dbReady.then(() => {
			const tx = db.transaction(["profiles", "profileMods"], "readwrite");

			// Supprimer toutes les liaisons du profil
			const pmStore = tx.objectStore("profileMods");
			const index = pmStore.index("byProfile");
			index.openCursor(IDBKeyRange.only(profileId)).onsuccess = (e) => {
				const cursor = e.target.result;
				if (cursor) {
					cursor.delete();
					cursor.continue();
				}
			};

			// Supprimer le profil lui-même
			tx.objectStore("profiles").delete(profileId);

			tx.oncomplete = () => resolve(true);
			tx.onerror = (e) => reject(e.target.error);
		});
	});
}

function getAllProfiles() {
	return new Promise((resolve, reject) => {
		dbReady.then(() => {
			const tx = db.transaction(["profiles"], "readonly");
			tx.objectStore("profiles").getAll().onsuccess = (e) => resolve(e.target.result);
		});
	});
}

function renameProfile(profileId, newName) {
	return new Promise((resolve, reject) => {
		dbReady.then(() => {
			const tx = db.transaction(["profiles"], "readwrite");
			const store = tx.objectStore("profiles");

			store.get(profileId).onsuccess = (e) => {
				const profile = e.target.result;

				if (!profile) return reject(new Error("Profile not found"));

				profile.name = newName;
				store.put(profile).onsuccess = () => resolve(true);
			};

			tx.onerror = (e) => reject(e.target.error);
		});
	});
}

// --- Mods ---

function addMod(mod) {
	if (!(mod instanceof Mod)) throw new Error("Invalid mod type");

	return new Promise((resolve, reject) => {
		dbReady.then(() => {
			const tx = db.transaction(["mods"], "readwrite");
			const store = tx.objectStore("mods");

			store.get(mod.id).onsuccess = (e) => {
				if (e.target.result) {
					resolve(false);
				} else {
					store.add(mod).onsuccess = () => resolve(true);
				}
			};
		});
	});
}

function deleteMod(id) {
	return new Promise((resolve, reject) => {
		dbReady.then(() => {
			if (!id) return reject(new Error("Invalid id"));

			const tx = db.transaction(["mods", "profileMods"], "readwrite");

			// Supprimer toutes les liaisons de ce mod
			const pmStore = tx.objectStore("profileMods");
			pmStore.index("byMod").openCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
				const cursor = e.target.result;
				if (cursor) {
					cursor.delete();
					cursor.continue();
				}
			};

			tx.objectStore("mods").delete(id);
			tx.oncomplete = () => resolve(true);
			tx.onerror = (e) => reject(e.target.error);
		});
	});
}

function modExists(id) {
	return new Promise((resolve, reject) => {
		dbReady.then(() => {
			if (!id) return reject(new Error("Invalid id"));
			const tx = db.transaction(["mods"], "readonly");
			tx.objectStore("mods").get(id).onsuccess = (e) => resolve(!!e.target.result);
		});
	});
}

function getAllMods() {
	return new Promise((resolve, reject) => {
		dbReady.then(() => {
			const tx = db.transaction(["mods"], "readonly");
			tx.objectStore("mods").getAll().onsuccess = (e) => resolve(e.target.result);
		});
	});
}


// --- liaison profil ↔ mod --- 

/** Ajoute un mod à un profil (enabled: true par défaut) */
function addModToProfile(profileId, modId, enabled = true) {
	return new Promise((resolve, reject) => {
		dbReady.then(() => {
			const tx = db.transaction(["profileMods"], "readwrite");
			const store = tx.objectStore("profileMods");
			const id = `${profileId}_${modId}`;

			store.get(id).onsuccess = (e) => {
				if (e.target.result) return resolve(false); // déjà présent

				store.add({id, profileId, modId, enabled}).onsuccess = () => resolve(true);
			};
			tx.onerror = (e) => reject(e.target.error);
		});
	});
}

/** Retire un mod d'un profil */
function removeModFromProfile(profileId, modId) {
	return new Promise((resolve, reject) => {
		dbReady.then(async () => {
			const tx = db.transaction(["profileMods"], "readwrite");
			tx.objectStore("profileMods").delete(`${profileId}_${modId}`);
			tx.oncomplete = async () => {
				// Vérifier si le mod est encore dans au moins un profil
				const index = db.transaction(["profileMods"], "readonly")
					.objectStore("profileMods")
					.index("byMod");

				index.getAll(IDBKeyRange.only(modId)).onsuccess = async (e) => {
					if (e.target.result.length === 0) {
						await deleteMod(modId);
					}
					resolve(true);
				};
			};
			tx.onerror = (e) => reject(e.target.error);
		});
	});
}

/** Active/désactive un mod dans un profil spécifique */
function setEnabled(profileId, modId, enabled) {
	return new Promise((resolve, reject) => {
		dbReady.then(() => {
			const tx = db.transaction(["profileMods"], "readwrite");
			const store = tx.objectStore("profileMods");
			const id = `${profileId}_${modId}`;

			store.get(id).onsuccess = (e) => {
				const entry = e.target.result;
				if (!entry) return reject(new Error("Mod not in profile"));

				entry.enabled = enabled;
				store.put(entry).onsuccess = () => resolve(true);
			};
			tx.onerror = (e) => reject(e.target.error);
		});
	});
}

/** Retourne tous les mods d'un profil, avec leur état enabled */
function getModsForProfile(profileId) {
	return new Promise((resolve, reject) => {
		dbReady.then(() => {
			const tx = db.transaction(["mods", "profileMods"], "readonly");
			const pmStore = tx.objectStore("profileMods");
			const modsStore = tx.objectStore("mods");

			pmStore.index("byProfile").getAll(IDBKeyRange.only(profileId)).onsuccess = (e) => {
				const links = e.target.result; // [{ modId, enabled, ... }]
				const results = [];
				let pending = links.length;

				if (pending === 0) return resolve([]);

				for (const link of links) {
					modsStore.get(link.modId).onsuccess = (e2) => {
						if (e2.target.result) {
							results.push({...e2.target.result, enabled: link.enabled});
						}
						if (--pending === 0) resolve(results);
					};
				}
			};
			tx.onerror = (e) => reject(e.target.error);
		});
	});
}

// --- export / import ---

async function exportDB() {
	const [mods, profiles, profileMods] = await Promise.all([
		getAllMods(),
		getAllProfiles(),
		new Promise((resolve, reject) => {
			dbReady.then(() => {
				const tx = db.transaction(["profileMods"], "readonly");
				tx.objectStore("profileMods").getAll().onsuccess = (e) => resolve(e.target.result);
				tx.onerror = (e) => reject(e.target.error);
			});
		})
	]);

	const data = JSON.stringify({mods, profiles, profileMods}, null, 2);
	const blob = new Blob([data], {type: "application/json"});
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = "mods-backup.json";
	a.click();

	URL.revokeObjectURL(url);
}

async function importDB(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = async (e) => {
			try {
				const {mods, profiles, profileMods} = JSON.parse(e.target.result);

				await dbReady;
				const tx = db.transaction(["mods", "profiles", "profileMods"], "readwrite");

				// Vider les stores existants
				tx.objectStore("mods").clear();
				tx.objectStore("profiles").clear();
				tx.objectStore("profileMods").clear();

				tx.oncomplete = async () => {
					// Réinsérer les données
					const tx2 = db.transaction(["mods", "profiles", "profileMods"], "readwrite");

					mods.forEach(mod => tx2.objectStore("mods").put(mod));
					profiles.forEach(profile => tx2.objectStore("profiles").put(profile));
					profileMods.forEach(pm => tx2.objectStore("profileMods").put(pm));

					tx2.oncomplete = () => resolve(true);
					tx2.onerror = (e) => reject(e.target.error);
				};

				tx.onerror = (e) => reject(e.target.error);

			} catch (err) {
				reject(new Error("Fichier invalide : " + err.message));
			}
		};

		reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
		reader.readAsText(file);
	});
}

async function exportProfile(profileId) {
	const profile = await new Promise((resolve, reject) => {
		dbReady.then(() => {
			const tx = db.transaction(["profiles"], "readonly");
			tx.objectStore("profiles").get(profileId).onsuccess = (e) => resolve(e.target.result);
			tx.onerror = (e) => reject(e.target.error);
		});
	});

	if (!profile) throw new Error("Profile not found");

	const mods = await getModsForProfile(profileId);

	const profileMods = await new Promise((resolve, reject) => {
		dbReady.then(() => {
			const tx = db.transaction(["profileMods"], "readonly");
			tx.objectStore("profileMods").index("byProfile").getAll(IDBKeyRange.only(profileId)).onsuccess = (e) => resolve(e.target.result);
			tx.onerror = (e) => reject(e.target.error);
		});
	});

	const data = JSON.stringify({profile, mods, profileMods}, null, 2);
	const blob = new Blob([data], {type: "application/json"});
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = `profile-${profile.name}.json`;
	a.click();

	URL.revokeObjectURL(url);
}

async function importProfile(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = async (e) => {
			try {
				const {profile, mods, profileMods} = JSON.parse(e.target.result);

				await dbReady;

				// Si un profil avec le même id existe déjà, générer un nouvel id
				const existingProfile = await new Promise((res) => {
					const tx = db.transaction(["profiles"], "readonly");
					tx.objectStore("profiles").get(profile.id).onsuccess = (e) => res(e.target.result);
				});

				let profileId = profile.id;
				if (existingProfile) {
					profileId = crypto.randomUUID();
					profile.id = profileId;
					profile.name = profile.name + " (imported)";
				}

				const tx = db.transaction(["mods", "profiles", "profileMods"], "readwrite");

				// Insérer le profil
				tx.objectStore("profiles").put(profile);

				// Insérer les mods (put pour ne pas écraser si déjà présents)
				mods.forEach(mod => {
					const {enabled, ...modWithoutEnabled} = mod; // retirer enabled qui est propre au profileMod
					tx.objectStore("mods").put(modWithoutEnabled);
				});

				// Insérer les liaisons en mettant à jour l'id si le profileId a changé
				profileMods.forEach(pm => {
					tx.objectStore("profileMods").put({
						...pm,
						id: `${profileId}_${pm.modId}`,
						profileId,
					});
				});

				tx.oncomplete = () => resolve(profileId);
				tx.onerror = (e) => reject(e.target.error);

			} catch (err) {
				reject(new Error("Fichier invalide : " + err.message));
			}
		};

		reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
		reader.readAsText(file);
	});
}