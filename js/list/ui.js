
const CSV_URL = "/tracks/list.csv";


// Format seconds -> mm:ss
function formatDuration(seconds) {
	seconds = Math.round(Number(seconds));
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2,"0")}`;
}


// Parse CSV text
function parseCSV(text, delimiter=',') {
	const lines = text.trim().split("\r\n");
	const headers = lines.shift().split(delimiter);

	return lines.map(line => {
		const values = line.split(delimiter);
		return Object.fromEntries(headers.map((h,i)=>[h,values[i]]));
	});
}


// Render track list
fetch(CSV_URL)
	.then(r => r.text())
	.then(text => {
		const tracks = parseCSV(text);

		// Sort newest first
		tracks.sort((a,b)=> new Date(
			b["released"]) - new Date(a["released"])
		);

		const container = document.getElementById("list");

		tracks.forEach(track => {
			const a = document.createElement("a");

			a.id = track["uuid"];
			a.className = "track link";
			a.href = `/?uuid=${track["uuid"]}`;

			const coverPath = `/tracks/${track["uuid"]}/watermarked.jpg`;

			a.innerHTML = `
				<img
					class="cover"
					src="${coverPath}"
					alt="${track["title"]}"
				/>
				<div class="info">
					<div class="title">
						${track["title"]}
					</div>

					<div class="duration">
						${formatDuration(track["duration"])}
					</div>
				</div>
			`;

			container.appendChild(a);
		});
	})
	.catch(err => {
		console.error(err);
		document.body.insertAdjacentHTML(
			"beforeend",
			"<p style='color:red'>Failed to load tracks</p>"
		);
	});
