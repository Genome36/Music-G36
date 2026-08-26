
// ES6
//'use strict';


import html2canvas from 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm';


class trk {

	#debug = true;

	#nid;
	#sid;

	#original = {};
	#logSequence = 0;

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
		this.#nid = this.#nav_id();
		this.#sid = this.#ses_id();

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


	#nav_id () {
		return (Date.now() * Math.random())
			.toString(36)
			.slice(0, 6);
	}


	#ses_id () {
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
			ts: Date.now(),
			seq: this.#logSequence,
			lvl,
			msg: args.map(v => {
				if (v instanceof Error) return v.stack;
				if (typeof v === "object") return JSON.stringify(v, null, 2);
				return String(v);
			}).join(" "),
		};

		this.#send('l', { n: JSON.stringify(entry) });
		this.#logSequence++;
	}


	#send (evt, xtr = {}) {
		const { fd, ...extra } = xtr;

		const url = "https://genome36.com/pxl?" + new URLSearchParams({
			evt,
			nid: this.#nid,
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
			navigator.sendBeacon(url + '&r=bcn', fd);

		} else {
			const img = new Image();
			img.src = url + '&r=img';
		}
	}


	reach () {
		this.#send('r');
	}


	view () {
		this.#send('v', {
			eng: Date.now() - this.#start
		});
	}


	engaged () {
		this.#send('e', {
			eng: Date.now() - this.#start
		});
	}


	outbound (action) {
		this.#navigating = true;
		this.#send('o', {
			act: action,
			eng: Date.now() - this.#start
		});
	}


	share (fallback = false) {
		const event = (fallback) ? 'fs' : 's';
		this.#send(event, {
			eng: Date.now() - this.#start
		});
	}


	heartbeat () {
		this.#send('h', {
			eng: Date.now() - this.#start
		});
	}


	redirect (url) {
		const current = new URL(window.location.href);
		const target  = new URL(url, window.location.origin);
		const merged  = new URL(target.pathname, window.location.origin);

		// add current params
		current.searchParams.forEach( (value, key) => {
			merged.searchParams.set(key, value);
		});

		// override with params
		target.searchParams.forEach( (value, key) => {
			merged.searchParams.set(key, value);
		});

		// add sid
		merged.searchParams.set('sid', this.#sid);

		// redirect
		window.location.href = merged.toString();
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
				this.#send('d', { fd });
			}, 'image/jpeg', 0.6);
		});
	}
}


const cls = new trk();
export const pxl = cls;
