
// ES6
//'use strict';


import { pxl } from '/js/pxl.js';


const platforms = {
	'aplm': ['https://music.apple.com/us/song/',   'Apple Music'],
	'sptf': ['https://open.spotify.com/track/',    'Spotify'],
	'ytm':  ['https://music.youtube.com/watch?v=', 'Youtube Music'],
	'scld': ['https://soundcloud.com/genome36/',   'Soundcloud'],
};


// Utility to parse query params
function getQueryParams() {
	const params = {};

	location.search.slice(1).split('&').forEach(pair => {
		const [key, value] = pair.split('=');
		if (key) params[key] = decodeURIComponent(value);
	});

	return params;
}


// Fetch and parse content.ini
function fetchTrackData(uuid) {
	return new Promise(async (resolve, reject) => {
		try {
			const response = await fetch(
				`/tracks/${uuid}/metadata.ini`,
				{ cache: 'reload' }
			);

			if (! response.ok) {
				throw new Error(`Failed to fetch metadata.ini for ${uuid}`);
			}

			const text = await response.text();
			const data = {};

			let currentSection = null;
			text.split(/\r?\n/).forEach(rawLine => {
				const line = rawLine.trim();

				// Skip empty lines and comments
				if (! line || line.startsWith('#') || line.startsWith(';')) return;

				// Section header [section]
				if (line.startsWith('[') && line.endsWith(']')) {
					currentSection = line.slice(1, -1).trim();
					data[currentSection] = {};

					return;
				}

				// Key=value
				const eqIndex = line.indexOf('=');
				if (eqIndex === -1) return;

				const key = line.slice(0, eqIndex).trim();
				const value = line.slice(eqIndex + 1).trim();

				if (! key) return;

				// Store inside section (configparser behavior)
				if (currentSection) {
					data[currentSection][key] = value;
				}
			});

			resolve(data);

		} catch (err) {
			reject(err);
		}
	});
}


function releaseDate(dateStr) {
	if (! dateStr) return '';

	const date = new Date(dateStr + 'T00:00:00');
	const day = date.getDate();

	// Determine ordinal suffix
	const suffix =
		day % 10 === 1 && day !== 11 ? 'st' :
		day % 10 === 2 && day !== 12 ? 'nd' :
		day % 10 === 3 && day !== 13 ? 'rd' : 'th';

	const month = date.toLocaleString('en-US', { month: 'long' });
	const year = date.getFullYear();

	return `${month} ${day}${suffix}, ${year}`;
}


async function loadLatestRelease(current) {
	try {
		const uuid = (await fetch(
			'/tracks/latest',
			{ cache: 'reload' }
		).then(r => r.text())).trim();

		if (! uuid) return;

		// Build card
		const card = document.getElementById('redirect');

		// same uuid (show list)
		if (uuid == current) {
			card.classList.add("other");

			card.innerHTML = `
				<div class="cover">
					<img src="/tracks/3LiA9B/cover/32.jpg"
						 alt="Track list cover image 1" />
					<img src="/tracks/UMhWwS/cover/32.jpg"
						 alt="Track list cover image 2" />
					<img src="/tracks/DB0di4/cover/32.jpg"
						 alt="Track list cover image 3" />
					<img src="/tracks/WDPnvU/cover/32.jpg"
						 alt="Track list cover image 4" />
				</div>
				<div class="text">
					<div class="title">Other releases</div>
					<div class="subtitle">Loads of emotions</div>
				</div>
			`;

			card.onclick = () => {
				pxl.redirect('/list');
			};

		// diff uuid (show latest)
		} else {
			const meta = await fetchTrackData(uuid);

			const title = meta?.track?.title ?? '';

			card.innerHTML = `
				<div class="cover">
					<img
						class="cover"
						src="/tracks/${uuid}/cover/64.jpg"
						alt="${title} album cover"
						loading="high"
					/>
				</div>
				<div class="text">
					<div class="title">${title}</div>
					<div class="subtitle">Latest release</div>
				</div>
			`;

			card.onclick = () => {
				pxl.redirect(`/tracks/${uuid}/`);
			};
		}

		card.classList.remove('hidden');

	} catch (err) {
		console.warn('No latest release found', err);
	}
}


function expandElement (btn) {
	// make copy
	const copy = btn.cloneNode(true);

	// Get button position and size
	const rect = btn.getBoundingClientRect();

	// Apply initial fixed position matching the button
	copy.style.zIndex = 9999;
	copy.style.position = 'fixed';
	copy.style.top = rect.top + 'px';
	copy.style.left = rect.left + 'px';
	copy.style.width = rect.width + 'px';
	copy.style.height = rect.height + 'px';

	// add copy
	document.body.appendChild(copy);

	// Trigger reflow so the browser registers the initial size
	copy.offsetHeight;

	// Expand over all available space
	copy.style.transition = 'all 0.250s linear';
	copy.style.top = 0;
	copy.style.left = 0;
	copy.style.width = '100vw';
	copy.style.height = '100vh';
	copy.style.borderRadius = 0;
}


// Main
(async () => {
	const cover = document.getElementById('cover');
	const back = document.getElementById('background');
	const serv = document.getElementById('services');

	// Set title & artist
	const title  = document.getElementById('title');
	const artist = document.getElementById('artist');
	const date = document.getElementById('date');

	// show error
	function show404 () {
		document.body.classList.add('error');
		title.textContent = 'Track not found';
		artist.textContent = '404';
	}

	// resolve
	const params = getQueryParams();
	const match = window.location.pathname.match(/^\/tracks\/([A-Za-z0-9]{6})(?:\/.*)?$/);
	const uuid = params.uuid ?? match?.[1];

	// cant find uuid
	if (! uuid) {
		show404();
		return;
	}

	// Set cover and background

	// Set metadata and services
	fetchTrackData(uuid)
	.then(meta => {
		loadLatestRelease(meta.track.uuid);

		// Set title, artist and release date
		title.textContent  = meta.track.title  || 'Unknown Title';
		artist.textContent = meta.track.artist || 'Genome36';
		date.textContent = releaseDate(meta.track.released);

		// set cover alt desc
		cover.setAttribute('alt', `${meta.track.title} album cover`);

		// set page title
		document.title = meta.track.title  || 'Unknown Title';

		// Set platform buttons
		Object.keys(platforms).forEach(p => {
			if (meta.streaming
			&&  p in meta.streaming
			&&  meta.streaming[p].trim() !== "") {
				const btn = document.createElement("A");

				btn.id = p;
				btn.className = "btn link";

				btn.href = platforms[p][0] + meta.streaming[p];
				btn.target = "_blank";
				btn.rel = "noopener noreferrer";

				btn.setAttribute(
					"aria-label",
					`Listen to ${meta.track.title} on ${platforms[p][1]}`
				);

				btn.setAttribute("data-open", "external");

				// reset button
				document.addEventListener('visibilitychange', () => {
					btn.style.cssText = '';
					btn.toggleAttribute("disabled", false);
				});

				// expand button
				btn.addEventListener('click', (event) => {
					// cancel if disabled
					event.preventDefault();
					if (btn.hasAttribute('disabled')) return false;

					// Fire pixel tracking immediately
					pxl.outbound(btn.id);

					try {
						console.warn("clicked", btn.id);

						btn.toggleAttribute("disabled", true);
						expandElement(btn);

						// Redirect after animation
						setTimeout( () => {
							window.open(btn.href, '_blank', 'noopener');
							btn.toggleAttribute("disabled", false);
						}, 1000);

					} catch (err) {
						console.error('btn press', err);
						btn.toggleAttribute("disabled", false);
					}
				});

				serv.append(btn);
			}
		});
	})

	.catch(err => {
		console.warn('Failed to load track', err);
		show404();
	})

	.finally ( () => {
		document.body.classList.add('loaded');
	});

	// Priority reordering
	if (params.priority && params.priority in platforms) {
		const container = document.querySelector('.buttons');
		const priorityBtn = document.getElementById(params.priority);

		container.prepend(priorityBtn);
	}

	// share button
	const share = document.getElementById('share');
	share.addEventListener('click', async () => {
		const ref_url = window.location.href + "&ref=share";

		const shareData = {
			title: document.title,
			text: 'Check out this track',
			url: ref_url,
		};

		if (navigator.share) {
			try {
				await navigator.share(shareData);
				pxl.share();

			} catch (err) {
				// User cancelled -> ignore
				console.debug('Share cancelled', err);
			}

			return;
		}

		// Fallback
		const input = document.createElement('input');
		input.value = ref_url;

		document.body.appendChild(input);

		input.select();
		input.setSelectionRange(0, 99999);

		try {
			document.execCommand('copy');

		} catch (err) {
			alert('Tap and hold to copy the URL');
		}

		document.body.removeChild(input);

		pxl.share(true);
		return;
	});

	setTimeout( () => {
		pxl.debug();
	}, 1500);
})();
