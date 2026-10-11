// Read-only forum archive viewer shared by index.html (StrokesPlus.net) and cindex.html (StrokesPlus).
// The page's <body> names its data file (data-json) and its own path (data-base); every archive URL is
// <base>?t=<topic>, ?u=<user>, ?f=<forum>, plus &p=<page> for long lists.
(function () {
	const PAGE_SIZE = 100;
	const SEARCH_DELAY_MS = 600;

	const dataUrl = document.body.dataset.json;
	const base = document.body.dataset.base;
	const params = new URLSearchParams(window.location.search);
	const param = (name) => {
		const value = params.get(name);
		return value && value !== 'null' ? value : '';
	};

	const searchBox = document.getElementById('searchBox');
	const results = document.getElementById('resultsContainer');
	const overlay = document.getElementById('waitOverlay');

	let posts = [];
	let searchTimer;
	let searchHits = [];
	let searchTerm = '';

	const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	function href(query) {
		const qs = Object.entries(query)
			.filter(([, value]) => value !== '' && value != null)
			.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
			.join('&');
		return qs ? `${base}?${qs}` : base;
	}

	function when(value) {
		return value ? String(value).replace('T', ' ').slice(0, 16) : '';
	}

	function forumLabel(item) {
		return `${item.Category || 'No category'} · ${item.Forum || 'No forum'}`;
	}

	// Links to topics on the old forums point at the same topic in this archive (the topic IDs match).
	function archiveLinks(html) {
		if (!html) return html;
		return html
			.replace(/(?:https?:\/\/)?(?:www\.)?strokesplus\.com\/forum\/topic\.asp\?(?:[^'"\s<]*?&)?TOPIC_ID=(\d+)[^'"\s<]*/gi, 'https://strokesplus.net/cindex.html?t=$1')
			.replace(/https?:\/\/(?:www\.)?strokesplus\.com\/forum\/topic\/(\d+)(?:\/[\w-]*)?/gi, 'https://strokesplus.net/cindex.html?t=$1')
			.replace(/https?:\/\/forum\.strokesplus\.net\/posts\/t(\d+)(?:-[\w-]*)?/gi, 'https://strokesplus.net/?t=$1')
			.replace(/https?:\/\/forum\.strokesplus\.net\/?(?=['"\s<]|$)/gi, 'https://strokesplus.net/');
	}

	function postHtml(item) {
		return `
			<article class="post">
				<h3><a href="${href({t: item.TopicID})}">${item.Topic || 'No title'}</a></h3>
				<span class="chip">${forumLabel(item)}</span>
				<p class="post-meta">
					Topic by <a href="${href({u: item.TopicPostedBy})}">${item.TopicPostedBy}</a> on ${when(item.TopicPostedOn)}
					· Post by <a href="${href({u: item.MessagePostedBy})}">${item.MessagePostedBy}</a> on ${when(item.MessagePostedOn)}
				</p>
				<div class="post-body">${archiveLinks(item.Message) || 'No message'}</div>
			</article>`;
	}

	function showOverlay() {
		overlay.classList.add('active');
		document.body.classList.add('is-waiting');
	}

	function hideOverlay() {
		overlay.classList.remove('active');
		document.body.classList.remove('is-waiting');
	}

	// pageLink(page) returns the markup for a link or button to that page.
	function pagerHtml(page, pageCount, pageLink) {
		if (pageCount <= 1) return '';
		return `<nav class="pager" aria-label="Pages">
			<span>${page > 1 ? pageLink(page - 1, 'Previous') : ''}</span>
			<span>Page ${page} of ${pageCount}</span>
			<span>${page < pageCount ? pageLink(page + 1, 'Next') : ''}</span>
		</nav>`;
	}

	async function render(items, heading, page, pageLink) {
		if (items.length === 0) {
			results.innerHTML = heading + '<p class="no-results">No matches found.</p>';
			return;
		}
		showOverlay();
		await delay(20);

		const pageCount = Math.ceil(items.length / PAGE_SIZE);
		page = Math.min(Math.max(page || 1, 1), pageCount);
		const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
		const pager = pagerHtml(page, pageCount, pageLink);

		results.innerHTML = heading + pager + pageItems.map(postHtml).join('') + pager;
		highlight(searchTerm);

		await delay(200);
		hideOverlay();
	}

	// Pages reached by URL page through links, so the browser's Back button works.
	function urlPageLink(page, label) {
		return `<a class="button" href="${href({t: param('t'), u: param('u'), f: param('f'), p: page})}">${label}</a>`;
	}

	// Search results live in memory, so they page with buttons.
	function searchPageLink(page, label) {
		return `<button type="button" class="button" data-page="${page}">${label}</button>`;
	}

	function highlight(term) {
		if (!window.CSS || !CSS.highlights) return;
		CSS.highlights.delete('search-results');
		if (!term) return;
		const ranges = [];
		const walker = document.createTreeWalker(results, NodeFilter.SHOW_TEXT);
		let node;
		while ((node = walker.nextNode())) {
			const text = node.nodeValue.toLowerCase();
			for (let i = text.indexOf(term); i >= 0; i = text.indexOf(term, i + term.length)) {
				const range = new Range();
				range.setStart(node, i);
				range.setEnd(node, i + term.length);
				ranges.push(range);
			}
		}
		CSS.highlights.set('search-results', new Highlight(...ranges));
	}

	function forumHeading(forum) {
		const item = posts.find((p) => p.Forum === forum);
		return item ? `<h3 class="forum-title">${forumLabel(item)}</h3>` : '';
	}

	function showForums() {
		const forum = param('f');
		if (forum) {
			const seen = new Set();
			const topics = posts.filter((item) => {
				if (item.Forum !== forum || seen.has(item.TopicID)) return false;
				seen.add(item.TopicID);
				return true;
			});
			render(topics, forumHeading(forum), parseInt(param('p')), urlPageLink);
			return;
		}

		const seen = new Set();
		const forums = posts.filter((item) => {
			const key = `${item.Category}|||${item.Forum}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		results.innerHTML = '<div class="forum-list">' + forums.map((item) => `
			<a class="forum-link" href="${href({f: item.Forum})}">
				<small>${item.Category || 'No category'}</small>
				<strong>${item.Forum || 'No forum'}</strong>
			</a>`).join('') + '</div>';
	}

	function showFromUrl() {
		const topicId = parseInt(param('t'));
		const user = param('u');
		const page = parseInt(param('p'));
		if (topicId > 0) {
			render(posts.filter((item) => item.TopicID === topicId), '', page, urlPageLink);
		} else if (user) {
			const matches = posts.filter((item) => item.TopicPostedBy === user || item.MessagePostedBy === user);
			render(matches, `<h3 class="forum-title">Posts by ${user.replace(/[<>&"]/g, '')}</h3>`, page, urlPageLink);
		} else {
			showForums();
		}
	}

	function runSearch() {
		searchTerm = searchBox.value.trim().toLowerCase();
		if (!searchTerm) {
			searchHits = [];
			CSS.highlights && CSS.highlights.delete('search-results');
			showFromUrl();
			return;
		}
		const forum = param('f');
		searchHits = posts.filter((item) => {
			if (forum && item.Forum !== forum) return false;
			return [item.Topic, item.Description, item.Message]
				.some((field) => field && field.toLowerCase().includes(searchTerm));
		});
		const scope = forum ? ` in ${forumLabel(posts.find((p) => p.Forum === forum) || {Forum: forum})}` : '';
		const heading = `<h3 class="forum-title">${searchHits.length.toLocaleString('en-US')} posts match${scope}</h3>`;
		render(searchHits, heading, 1, searchPageLink);
	}

	searchBox.addEventListener('input', () => {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(runSearch, SEARCH_DELAY_MS);
	});

	results.addEventListener('click', (e) => {
		const button = e.target.closest('button[data-page]');
		if (!button) return;
		const heading = results.querySelector('.forum-title');
		render(searchHits, heading ? heading.outerHTML : '', parseInt(button.dataset.page), searchPageLink)
			.then(() => searchBox.scrollIntoView({block: 'start'}));
	});

	async function load() {
		results.innerHTML = '<p class="no-results">Loading the archive…</p>';
		try {
			const response = await fetch(dataUrl);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			posts = await response.json();
			showFromUrl();
		} catch (error) {
			results.innerHTML = `<p class="load-error">The archive could not be loaded (${error.message}). Reload the page to try again.</p>`;
			console.error('Archive load failed:', error);
		}
	}

	load();
})();
