const i18n = (() => {
	let translations = {};
	let currentLocale = 'fr';

	async function init(onLanguageChange = undefined) {
		const savedLocale = localStorage.getItem('locale');
		const browserLocale = navigator.language.split('-')[0];
		const supportedLocales = ['fr', 'en'];

		const locale = supportedLocales.includes(savedLocale)
			? savedLocale
			: supportedLocales.includes(browserLocale)
				? browserLocale
				: 'en';

		const langSelect = document.querySelector("#lang-select");

		langSelect.value = locale;

		langSelect.addEventListener("change", async (e) => {
			await i18n.setLocale(e.target.value);
			if (onLanguageChange) onLanguageChange();
		});

		await i18n.setLocale(locale);
	}

	// Charge un fichier de traduction
	async function load(locale) {
		if (!translations[locale]) {
			const response = await fetch(`/locales/${locale}.json`);
			translations[locale] = await response.json();
		}
		currentLocale = locale;
		localStorage.setItem('locale', locale);
	}

	// Récupère une valeur par clé pointée (ex: "search.placeholder")
	function get(key, vars = {}) {
		const keys = key.split('.');
		let value = translations[currentLocale];

		for (const k of keys) {
			value = value?.[k];
		}

		if (value === undefined) {
			console.warn(`[i18n] Missing key : "${key}" (${currentLocale})`);
			return key; // Fallback : affiche la clé brute
		}

		// Interpolation : remplace {{count}}, {{name}}, etc.
		return value.replace(/\{\{(\w+)}}/g, (_, k) => vars[k] ?? `{{${k}}}`);
	}

	// Traduit tous les éléments du DOM ayant data-i18n
	function translateDOM() {
		document.querySelectorAll('[data-i18n]').forEach(el => {
			const key = el.dataset.i18n;
			const vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : {};
			el.textContent = get(key, vars);
		});

		document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
			el.placeholder = get(el.dataset.i18nPlaceholder);
		});
	}

	async function setLocale(locale) {
		await load(locale);
		translateDOM();
	}

	function getLocale() {
		return currentLocale;
	}

	return {init, load, get, setLocale, translateDOM, getLocale};
})();