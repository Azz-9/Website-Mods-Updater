let currentAbortController = null;

async function fetchData(query, limit, offset, index, facets) {
	if (currentAbortController) {
		currentAbortController.abort();
	}
	currentAbortController = new AbortController();
	const signal = currentAbortController.signal;

	const url = new URL("https://api.modrinth.com/v2/search");
	url.searchParams.set('query', query);
	url.searchParams.set('limit', limit);
	url.searchParams.set('offset', offset);
	url.searchParams.set('index', index);
	url.searchParams.set('facets', JSON.stringify(facets));

	try {
		const response = await fetch(url, {signal});
		if (response.ok) {
			return await response.json();
		}
	} catch (error) {
		if (error.name === 'AbortError') {
			return null;
		}
		console.error(error.message);
	}
}


function search() {
	const query = document.querySelector('#search-input').value;
	const limit = document.querySelector("#view").value;
	const offset = params.get("page") ? (params.get("page") - 1) * limit : 0;
	const index = document.querySelector("#sort-by").value;

	const facets = [["project_type:mod"]];
	const versions = [];
	params.getAll("version").forEach(version => versions.push(`versions:${version}`));
	const loaders = [];
	params.getAll("loader").forEach(loader => loaders.push(`categories:${loader}`));
	if (versions.length > 0) facets.push(versions);
	if (loaders.length > 0) facets.push(loaders);
	params.getAll("category").forEach(category => facets.push([`categories:${category}`]));
	if (params.get("server")) facets.push(["server_side:optional", "server_side:required"], ["client_side!=required"]);
	if (params.get("client")) facets.push(["client_side:optional", "client_side:required"], ["server_side!=required"]);
	if (document.querySelector("#hide-saved-mods").checked) {
		getAllMods().then(mods => {
			const modIds = mods.map(mod => mod.id);
			modIds.forEach(modId => facets.push([`project_id!=${modId}`]));

			fetchData(query, limit, offset, index, facets).then(results => {
				if (results) addResults(results);
			});
		});
	} else {
		fetchData(query, limit, offset, index, facets).then(results => {
			if (results) addResults(results);
		});
	}

	updatePaginationButtons();

	async function addResults(results) {
		const container = document.querySelector('#results-container');

		const views = await Promise.all(results["hits"].map(result => getModView(result)));

		container.querySelectorAll('& > li').forEach(li => li.remove());

		views.forEach(view => container.appendChild(view));

		const loading = document.querySelector('#loading');
		if (loading) loading.remove();
		const pagination = document.querySelector('#pagination-section');
		if (pagination) pagination.style.display = 'flex';
	}
}

async function getModView(result) {
	// Get the template element
	const template = document.querySelector('#mod-template');

	// Clone the template content
	const clone = template.content.cloneNode(true);

	const mod = new Mod(result.title, result.project_id, result.description, result.icon_url, result.slug, true);

	// Fill in data
	clone.querySelectorAll(".link").forEach(a => a.href = "https://modrinth.com/mod/" + mod.slug);
	clone.querySelector(".thumbnail").src = (mod.icon_url ? mod.icon_url : "assets/missing_icon.png");
	clone.querySelector(".thumbnail").alt = mod.title + " icon";
	clone.querySelector(".title").innerText = mod.title;
	clone.querySelector(".author").innerText = "by " + result.author;
	clone.querySelector(".description").innerText = mod.description;
	clone.querySelector(".downloads").innerText = toHumanReadable(result.downloads);
	clone.querySelector(".followers").innerText = toHumanReadable(result.follows);
	const tagsContainer = clone.querySelector(".tags");
	const li = document.createElement("li");
	li.classList.add("environment-tag");

	if (result["client_side"] === "optional") {
		if (result["server_side"] === "optional") {
			li.innerText = "Client or Server"
		} else if (result["server_side"] === "required") {
			li.innerText = "Server"
		}
	} else if (result["client_side"] === "required") {
		if (result["server_side"] === "optional") {
			li.innerText = "Client"
		} else if (result["server_side"] === "required") {
			li.innerText = "Client and Server"
		} else if (result["server_side"] === "unsupported") {
			li.innerText = "Client"
		}
	} else if (result["client_side"] === "unsupported") {
		if (result["server_side"] === "required") {
			li.innerText = "server"
		}
	}
	if (li.innerText !== "") tagsContainer.appendChild(li);

	// Build tags
	for (let tag of result.display_categories) {
		const li = document.createElement("li");
		li.innerText = tag.charAt(0).toUpperCase() + tag.slice(1);
		tagsContainer.appendChild(li);
	}

	const addButton = clone.querySelector("button.add");

	addButton.addEventListener("click", () => {
		addMod(mod).then(added => {
			if (added) {
				disableButton();

				if (document.querySelector("#hide-saved-mods").checked) {
					search();
				}
			}
		});
	});

	await modExists(mod.id).then(exists => {
		if (exists) {
			disableButton();
		}
	});

	function disableButton() {
		addButton.disabled = true;
		addButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>\n${i18n.get("search.search_results.already_added")}`;
	}

	return clone;
}

function updatePaginationButtons() {
	let pageNumber = parseInt(params.get("page"));

	if (!pageNumber || pageNumber < 1) {
		pageNumber = 1;
	}

	document.querySelectorAll('.pagination').forEach(pagination => {
		pagination.querySelector('span').innerText = pageNumber.toString();
		pagination.querySelector('& > button:first-of-type').disabled = pageNumber === 1;
	});
}

function getUrl(query, limit, sort, page) {
	const url = new URL(window.location.origin + window.location.pathname);
	if (query && query !== "") url.searchParams.set('query', query);
	else url.searchParams.delete('query');
	if (limit && !isNaN(limit) && parseInt(limit) !== defaultLimit) url.searchParams.set('limit', limit);
	else url.searchParams.delete('limit');
	if (sort && sort !== defaultSort) url.searchParams.set('sort', sort);
	else url.searchParams.delete('sort');
	if (page && !isNaN(page) && parseInt(page) !== defaultPage) url.searchParams.set('page', page);
	else url.searchParams.delete('page');
	return url.toString();
}

function onSearchInputChange() {
	params.set("query", searchInput.value);

	onAnyParameterChange();
	updateURLAndSearch();
}

function onLimitSelectChange() {
	params.set("limit", limitSelect.value);

	onAnyParameterChange();
	updateURLAndSearch();
}

function onSortSelectChange() {
	params.set("sort", sortSelect.value);

	onAnyParameterChange();
	updateURLAndSearch();
}

function onPaginationClick(offset) {
	params.set("page", params.get("page") ? parseInt(params.get("page")) + offset : 1 + offset);

	updateURLAndSearch();
}

function onAnyParameterChange() {
	params.delete("page");
	updateURL();
}

function updateURLAndSearch() {
	updateURL();
	search();
}

function updateURL() {
	const newUrl = getUrl(params.get("query"), params.get("limit"), params.get("sort"), params.get("page"));
	window.history.replaceState({}, "", newUrl);
}

function updateVersionParams() {
	params.delete("version");
	document.querySelectorAll("#game-version-filter > ol > li").forEach(li => {
		if (li.classList.contains("selected")) {
			params.append("version", li.dataset.value);
		}
	});

	updateURLAndSearch();
}

function updateLoaderParams() {
	params.delete("loader");
	document.querySelectorAll("#loader-filter > ol > li").forEach(li => {
		if (li.classList.contains("selected")) {
			params.append("loader", li.dataset.loader);
		}
	});

	updateURLAndSearch();
}

function updateCategoryParams() {
	params.delete("category");
	document.querySelectorAll("#tags-filter > ol > li").forEach(li => {
		if (li.classList.contains("selected")) {
			params.append("category", li.dataset.value);
		}
	});

	updateURLAndSearch();
}

function updateEnvironmentParams() {
	params.delete("server");
	params.delete("client");
	document.querySelectorAll("#environment-filter > ol > li").forEach(li => {
		if (li.classList.contains("selected")) {
			params.append(li.dataset.value, true);
		}
	});

	updateURLAndSearch();
}

function toHumanReadable(number) {
	if (number < 1000) {
		return number;
	} else if (number < 1000000) {
		return (number / 1000).toFixed(1) + 'k';
	} else {
		return (number / 1000000).toFixed(2) + 'M';
	}
}

let searchInput;
let limitSelect;
let sortSelect;
let params;

const defaultLimit = 20;
const defaultSort = "relevance";
const defaultPage = 1;

document.addEventListener('DOMContentLoaded', async () => {
	await i18n.init();
	
	const promises = [];
	promises.push(fetch("https://api.modrinth.com/v2/tag/game_version").then(response => response.json()).then(versions => {
		const list = document.querySelector("#game-version-filter > ol");

		versions.forEach(version => {
			if (version["version_type"] === "release") {
				const li = document.createElement("li");
				li.dataset.value = version["version"];
				li.innerText = version["version"];
				list.appendChild(li);
			}
		})
	}));

	promises.push(fetch("https://api.modrinth.com/v2/tag/loader").then(response => response.json()).then(loaders => {
		const list = document.querySelector("#loader-filter > ol");

		const priority = {
			"fabric": 1,
			"forge": 2,
			"neoforge": 3,
			"quilt": 4
		};

		const items = loaders
			.filter(loader =>
				!loader["supported_project_types"].includes("plugin") &&
				loader["supported_project_types"].includes("mod")
			)
			.map(loader => {
				const li = document.createElement("li");
				li.dataset.loader = loader["name"];
				if (loader["name"] === "bta-babric") { //special case for BTA (Babric)
					li.innerText = "BTA (Babric)";
				} else {
					li.innerText = loader["name"].charAt(0).toUpperCase() + loader["name"].slice(1).replace("-", " ");
				}
				return li;
			});

		// Sort items: first by priority if exists, else keep original order
		items.sort((a, b) => {
			const pa = priority[a.dataset.loader] || Infinity;
			const pb = priority[b.dataset.loader] || Infinity;
			return pa - pb;
		});

		// Append sorted items
		items.forEach(li => list.appendChild(li));
	}));

	promises.push(fetch("https://api.modrinth.com/v2/tag/category").then(response => response.json()).then(categories => {
		const list = document.querySelector("#tags-filter > ol");

		categories.forEach(category => {
			if (category["project_type"] === "mod") {
				const li = document.createElement("li");
				li.dataset.value = category["name"];
				li.innerText = category["name"].charAt(0).toUpperCase() + category["name"].slice(1).replace("-", " ");
				list.appendChild(li);
			}
		})
	}));

	Promise.all(promises).then(() => {
		document.querySelectorAll("#filters-section > .filter li").forEach(li => {
			li.addEventListener("click", () => {
				li.classList.toggle("selected");
				onAnyParameterChange();
			});
		});

		document.querySelectorAll("#game-version-filter > ol > li").forEach(li => {
			li.addEventListener("click", () => {
				updateVersionParams();
			});
		});

		document.querySelectorAll("#loader-filter > ol > li").forEach(li => {
			li.addEventListener("click", () => {
				updateLoaderParams();
			});
		});

		document.querySelectorAll("#tags-filter > ol > li").forEach(li => {
			li.addEventListener("click", () => {
				updateCategoryParams();
			});
		});

		document.querySelectorAll("#environment-filter > ol > li").forEach(li => {
			li.addEventListener("click", () => {
				updateEnvironmentParams();
			});
		});

		document.querySelectorAll("#filters-section > .filter > ol").forEach(list => {
			list.addEventListener("scroll", () => {
				const atTop = list.scrollTop === 0;
				const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight;

				if (atTop) {
					list.classList.add('at-top');
				} else {
					list.classList.remove('at-top');
				}

				if (atBottom) {
					list.classList.add('at-bottom');
				} else {
					list.classList.remove('at-bottom');
				}
			});

			if (list.scrollHeight > list.clientHeight) {
				list.classList.add('has-overflow');
				list.classList.add('at-top');
			} else {
				list.classList.remove('has-overflow');
			}
		});
	});

	document.querySelectorAll("#filters-section > .filter").forEach(filter => {
		filter.querySelector("button").addEventListener("click", () => {
			filter.classList.toggle("closed");
		});
	});

	params = new URLSearchParams(document.location.search);
	let query = params.get("query");
	let limit = params.get("limit");
	let sort = params.get("sort");

	searchInput = document.querySelector("#search-input");
	limitSelect = document.querySelector("#view");
	sortSelect = document.querySelector("#sort-by");

	if (query) searchInput.value = query;
	if (limit) limitSelect.value = limit;
	if (sort) sortSelect.value = sort;

	updatePaginationButtons();

	search();
});