
// ES6
//'use strict';


import html2canvas from 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm';


class trk {

	#debug = true;

	#sid;

	#original = {};

	// view
	#viewed = false;
	#viewTimer = null;
	#viewDelay = 500; // ms (tweakable)


	// flags
	#start;
	#visible = true;
	#engaged = false;
	#navigating = false;

	constructor () {
		this.#start = Date.now();
		this.#sid = this.#id();

		this.#bindControls();
		this.#bindVisibility();
		this.#bindConsole();

		// init
		this.reach();
	}


	#uuid () {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
			const r = Math.random() * 16 | 0;
			const v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}


	#id () {
		const url = new URL(window.location.href);

		// from URL
		let sid = url.searchParams.get('sid');
		if (sid) {
			url.searchParams.delete('sid');
			history.replaceState({}, '', url);

			sessionStorage.setItem('sid', sid);
			localStorage.setItem('sid', sid);
			return sid;
		}

		// sessionStorage
		sid = sessionStorage.getItem('sid');
		if (sid) return sid;

		// localStorage
		sid = localStorage.getItem('sid');
		if (sid) {
			sessionStorage.setItem('sid', sid);
			return sid;
		}

		// create new
		sid = this.#uuid();
		sessionStorage.setItem('sid', sid);
		localStorage.setItem('sid', sid);
		return sid;
	}


	#bindControls() {
		const engageOnce = () => {
			if (this.#engaged) return;

			this.#engaged = true;
			this.engaged();
		};

		['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(evt => {
			window.addEventListener(evt, engageOnce, { once: true, passive: true });
		});
	}


	#bindVisibility () {
		// send view after validation
		const scheduleView = () => {
			if (this.#viewed || this.#viewTimer) return;

			this.#viewTimer = setTimeout(() => {
				if (document.visibilityState === 'visible') {
					this.#viewed = true;
					this.view();
				}

				this.#viewTimer = null;

			}, this.#viewDelay);
		};

		// cancel view
		const cancelView = () => {
			if (! this.#viewTimer) return;

			clearTimeout(this.#viewTimer);
			this.#viewTimer = null;
		};

		document.addEventListener('visibilitychange', () => {
			// reset time on change
			const now = Date.now();

			if (document.visibilityState === 'visible') {
				this.#start = now;
				this.#visible = true;
				scheduleView();
			}

			if (document.visibilityState === 'hidden') {
				cancelView();

				if (this.#visible && !this.#navigating) {
					this.heartbeat();
				}

				this.#visible = false;
			}
		});

		// Initial state (important for normal browser loads)
		if (document.visibilityState === 'visible') {
			scheduleView();
		}

		// Unload fallback
		window.addEventListener('beforeunload', () => {
			if (! this.#navigating && this.#visible) {
				this.heartbeat();
			}
		});
	}


	#bindConsole () {
		// skip debugging
		if (! this.#debug) return;

		// bind logs
		["log", "warn", "error", "info", "debug"].forEach(level => {
			this.#original[level] = console[level];

			console[level] = (...args) => {
				this.#original[level].apply(console, args);

				if (! this.#debug) return;
				this.#console(level, args);
			};
		});

		// Global error listener
		window.addEventListener("error", e => {
			this.#console("error", [e.message], e);
		});

		window.addEventListener("unhandledrejection", e => {
			this.#console("error", [e.reason?.message || String(e.reason)], e.reason);
		});
	}


	#console (lvl, args) {
		const entry = {
			lvl,
			ts: Date.now(),
			msg: args.map(v => {
				if (v instanceof Error) return v.stack;
				if (typeof v === "object") return JSON.stringify(v, null, 2);
				return String(v);
			}).join(" "),
		};

		this.#send('log', { n: JSON.stringify(entry) });
	}


	#send (evt, xtr = {}) {
		const { fd, ...extra } = xtr;

		const url = "https://genome36.com/pxl?" + new URLSearchParams({
			evt,
			sid: this.#sid,
			p: location.href,
			ts: Date.now(),
			vw: innerWidth,
			vh: innerHeight,
			lang: navigator.language || '',
			vis: document.visibilityState || '',
			...extra
		});

		if (fd && navigator.sendBeacon) {
			navigator.sendBeacon(url + '&req=bcn', fd);

		} else {
			const img = new Image();
			img.src = url + '&req=img';
		}
	}


	reach () {
		this.#send('reach');
	}


	view () {
		this.#send('view');
	}


	engaged () {
		this.#send('engage', {
			eng: Date.now() - this.#start
		});
	}


	outbound (action) {
		this.#navigating = true;
		this.#send('outbound', {
			act: action,
			eng: Date.now() - this.#start
		});
	}


	share (fallback = false) {
		const event = (fallback) ? 'fallbackShare' : 'share';
		this.#send(event, {
			eng: Date.now() - this.#start
		});
	}


	heartbeat () {
		this.#send('heartbeat', {
			eng: Date.now() - this.#start
		});
	}


	redirect (url) {
		const u = new URL(url, window.location.origin);
		u.searchParams.set('sid', this.#sid);
		window.location.href = u.toString();
	}


	debug () {
		// skip debugging
		if (! this.#debug) return;

		html2canvas(document.body, {
			logging: false,
			useCORS: true,
			backgroundColor: '#404040',
			scale: 1
		}).then(canvas => {
			// downscale
			const scale = Math.min(1, 256 / canvas.width);

			const out = document.createElement('canvas');
			out.width  = canvas.width  * scale;
			out.height = canvas.height * scale;

			out.getContext('2d').drawImage(
				canvas,
				0, 0,
				out.width,
				out.height
			);

			// aggressive compression
			out.toBlob( blob => {
				const fd = new FormData();
				fd.append('debug', blob, 'dbg.jpg');
				this.#send('debug', { fd });
			}, 'image/jpeg', 0.6);
		});
	}
}


const cls = new trk();
export const pxl = cls;
