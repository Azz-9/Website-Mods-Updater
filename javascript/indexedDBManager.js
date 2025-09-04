let db;
let dbReady = new Promise((resolve, reject) => {
    const request = window.indexedDB.open("mods-db", 1);

    request.onerror = (event) => reject(event.target.error);

    request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains("mods")) {
            db.createObjectStore("mods", { keyPath: "id" });
        }
    };
});


function addMod(mod) {
    if (!(mod instanceof Mod)) {
        throw new Error("Invalid mod type");
    }

    return new Promise((resolve, reject) => {
        dbReady.then(() => {
            const transaction = db.transaction(["mods"], "readwrite");
            const store = transaction.objectStore("mods");

            // Check if mod already exists
            const getRequest = store.get(mod.id);

            getRequest.onsuccess = (event) => {
                if (event.target.result) {
                    // Already exists
                    resolve(false);
                } else {
                    // Add new mod
                    const addRequest = store.add(mod);

                    addRequest.onsuccess = () => {
                        resolve(true);
                    };

                    addRequest.onerror = (e) => {
                        console.error("Error adding mod:", e.target.error);
                        reject(e.target.error);
                    };
                }
            };

            getRequest.onerror = (e) => {
                console.error("Error checking mod existence:", e.target.error);
                reject(e.target.error);
            };
        });
    });
}

function deleteMod(id) {
    return new Promise((resolve, reject) => {
        dbReady.then(() => {
            if (!id) {
                reject(new Error("Invalid id"));
                return;
            }

            const transaction = db.transaction(["mods"], "readwrite");
            const store = transaction.objectStore("mods");

            const request = store.delete(id);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = (e) => {
                console.error("Error deleting mod:", e.target.error);
                reject(e.target.error);
            };
        });
    });
}


function modExists(id) {
    return new Promise((resolve, reject) => {
        dbReady.then(() => {
            if (!id) {
                reject(new Error("Invalid id"));
                return;
            }

            const transaction = db.transaction(["mods"], "readonly");
            const store = transaction.objectStore("mods");

            const request = store.get(id);

            request.onsuccess = (event) => {
                resolve(!!event.target.result); // true si trouvé, false sinon
            };

            request.onerror = (e) => {
                reject(e.target.error);
            };
        });
    });
}

function getAllMods() {
    return new Promise((resolve, reject) => {
        dbReady.then(() => {
            const transaction = db.transaction(["mods"], "readonly");
            const store = transaction.objectStore("mods");

            const request = store.getAll();

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (e) => {
                reject(e.target.error);
            };
        });
    });
}

function setEnabled(id, enabled) {
    return new Promise((resolve, reject) => {
        dbReady.then(() => {
            if (!id) {
                reject(new Error("Invalid id"));
                return;
            }

            const transaction = db.transaction(["mods"], "readwrite");
            const store = transaction.objectStore("mods");

            // Get the mod by id
            const getRequest = store.get(id);

            getRequest.onsuccess = (event) => {
                const mod = event.target.result;

                if (!mod) {
                    reject(new Error("Mod not found"));
                    return;
                }

                // Update enabled attribute
                mod.enabled = enabled;

                // Save updated object
                const updateRequest = store.put(mod);

                updateRequest.onsuccess = () => {
                    resolve(true);
                };

                updateRequest.onerror = (e) => {
                    console.error("Error updating mod:", e.target.error);
                    reject(e.target.error);
                };
            };

            getRequest.onerror = (e) => {
                console.error("Error fetching mod:", e.target.error);
                reject(e.target.error);
            };
        });
    });
}

function getMod(id) {
    return new Promise((resolve, reject) => {
        dbReady.then(() => {
            if (!id) {
                reject(new Error("Invalid id"));
                return;
            }

            const transaction = db.transaction(["mods"], "readonly");
            const store = transaction.objectStore("mods");

            const request = store.get(id);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            request.onerror = (e) => {
                reject(e.target.error);
            };
        });
    })
}

function getMods(ids) {
    return new Promise((resolve, reject) => {
        dbReady.then(() => {
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                reject(new Error("Invalid ids"));
                return;
            }

            const transaction = db.transaction(["mods"], "readonly");
            const store = transaction.objectStore("mods");

            const request = store.getAll(ids);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            request.onerror = (e) => {
                reject(e.target.error);
            };
        });
    })
}