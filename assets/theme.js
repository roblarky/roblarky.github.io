// Theme switch: System follows the OS; Light or Dark is saved in this browser. The <head> applies the
// saved choice before first paint; this wires up the buttons.
(function () {
	const KEY = 'theme';
	const root = document.documentElement;
	const buttons = document.querySelectorAll('.theme-switch button[data-theme-value]');

	function current() {
		return root.dataset.theme === 'light' || root.dataset.theme === 'dark' ? root.dataset.theme : 'system';
	}

	function apply(value) {
		if (value === 'light' || value === 'dark') root.dataset.theme = value;
		else delete root.dataset.theme;
		try {
			if (value === 'system') localStorage.removeItem(KEY);
			else localStorage.setItem(KEY, value);
		} catch (e) {
			// Storage blocked: the choice lasts for this page only.
		}
		buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeValue === value)));
	}

	buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.themeValue)));
	buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeValue === current())));
})();
