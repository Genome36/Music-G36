

const platforms = {
	'sptf': 'https://open.spotify.com/track/',
	'ytm': 'https://music.youtube.com/watch?v=',
	'scld': 'https://soundcloud.com/genome36/',
};


const start = Date.now();
const sid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
	const r = Math.random() * 16 | 0;
	const v = c === 'x' ? r : (r & 0x3 | 0x8);
	return v.toString(16);
});


// Utility to parse query params
function getQueryParams() {
	const params = {};

	location.search.slice(1).split('&').forEach(pair => {
		const [key, value] = pair.split('=');
		if (key) params[key] = decodeURIComponent(value);
	});

	return params;
}


window.send = (evt, extra = {}) => {
	const img = new Image();
	img.src = "https://genome36.com/pxl?" + new URLSearchParams({
		evt,
		sid,
		p: location.href,
		srv: getQueryParams('s'),
		cmp: getQueryParams('c'),
		ts: Date.now(),
		vw: innerWidth,
		vh: innerHeight,
		lang: navigator.language || '',
		vis: document.visibilityState || '',
		...extra
	});
}


// Fetch and parse content.ini
function fetchTrackData(uuid) {
	return new Promise(async (resolve, reject) => {
		try {
			const response = await fetch(`/tracks/${uuid}/metadata.ini`);

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


async function loadLatestRelease(current) {
	try {
		const uuid = (await fetch('/tracks/latest').then(r => r.text())).trim();
		if (! uuid) return;

		// same
		if (uuid == current) return;

		const meta = await fetchTrackData(uuid);

		const title = meta?.track?.title ?? '';

		// 3) Build card
		const card = document.getElementById('latest');
		card.innerHTML = `
			<img src="/tracks/${uuid}/watermarked.jpg" alt="">
			<div class="text">
				<div class="title">${title}</div>
				<div class="subtitle">Latest release</div>
			</div>
		`;

		card.onclick = () => {
			window.location.href = `/?uuid=${uuid}`;
		};

		card.classList.remove('hidden');

	} catch (err) {
		console.warn('No latest release found', err);
	}
}


// engagement
window.addEventListener('beforeunload', () => {
	window.send('engage', { eng: Date.now() - start });
});


// interaction
document.querySelectorAll('.link').forEach(btn => {
	btn.addEventListener('click', () => {
		window.send('outbound', {
			ts: Date.now(),
			act: btn.id,
		});
	});
});


// Main
(async () => {
	const params = getQueryParams();

	const cover = document.getElementById('cover');
	const back = document.getElementById('background');

	// Set title & artist
	const title  = document.getElementById('title');
	const artist = document.getElementById('artist');

	// show error
	function show404 () {
		document.body.classList.add('error');
		title.textContent = 'Track not found';
		artist.textContent = '404';
	}

	// cant find uuid
	if (! params.uuid) {
		show404();
		return;
	}

	// Set cover and background
	fetch(`tracks/${params.uuid}/watermarked.jpg`)
	.then(res => {
		if (! res.ok) throw new Error('Not found');
		return res.blob();
	})

	.then(blob => {
		const url = URL.createObjectURL(blob);
		cover.style.backgroundImage = `url(${url})`;
		back.style.backgroundImage  = `url(${url})`;
	})

	.catch(err => {
		console.warn('Cover art failed to load, using fallback.', err);
	});

	// Set metadata and services
	fetchTrackData(params.uuid)
	.then(meta => {
		loadLatestRelease(meta.track.uuid);

		// Set title & artist
		title.textContent  = meta.track.title  || 'Unknown Title';
		artist.textContent = meta.track.artist || 'Genome36';

		// set page title
		document.title = meta.track.title  || 'Unknown Title';

		// Set platform buttons
		Object.keys(platforms).forEach(p => {
			const btn = document.getElementById(p);

			if (meta.streaming && p in meta.streaming) {
				btn.href = platforms[p] + meta.streaming[p];
				btn.style.opacity = '1';
				btn.style.pointerEvents = 'auto';

			} else {
				btn.style.display = 'none';
			}
		});
	})

	.catch(err => {
		console.warn('Failed to load track', err);
		show404();
	});

	// Priority reordering
	if (params.priority && params.priority in platforms) {
		const container = document.querySelector('.buttons');
		const priorityBtn = document.getElementById(params.priority);

		container.prepend(priorityBtn);
	}

	// page view
	window.send('view');
})();
