"use strict";

function show_thumbnail(sliced, hash, target) {
	var array = new Uint8Array(sliced), start, end;
	for (var i = 2; i < array.length; i++)
		if (array[i] === 0xFF)
			if (!start) {
				if (array[i + 1] === 0xD8)
					 start = i;
			} else if (array[i + 1] === 0xD9) {
				end = i;
				break;
			}

	if (start && end) {
		var urlCreator = window.URL || window.webkitURL;
		var imageUrl = urlCreator.createObjectURL(new Blob([array.subarray(start, end)], {type:"image/jpeg"}));
		var imgf = new Image();
		imgf.src = imageUrl;
		imgf.id = hash;
		document.getElementById(target).appendChild(imgf);
	}
}

function to_dms(latitude, cardinal) {
	var flip;
	if (!latitude)
		return;

	if (cardinal === "North latitude" || cardinal === "East longitude")
		flip = 1;
	else
		flip = -1;

	return latitude * flip;
}

function get_alt(altitude, sign) {
	if (!altitude)
		return;

	return parseFloat(altitude) * (sign ? -1 : 1);
}

function batch_uploaded() {
	for (const [hash1, specs1] of image_hash["1"]) {
		if (!specs1.lat || !specs1.lon || !specs1.date) continue;

		for (const [hash2, specs2] of image_hash["2"]) {
			if (!specs2.lat || !specs2.lon || !specs1.date) continue;

			let key = hash_pair_to_key(hash1, hash2);
			let dist = distance_spacetime(specs1.lat, specs1.lon, specs1.date, specs2.lat, specs2.lon, specs2.date);
			distance_grid.set(key, dist);
		}
	}

	let distance_array = Array.from(distance_grid).sort(distance_sort);

	if (distance_array.length) {
		let closest = distance_array[0];
		let pair = JSON.parse(closest[0]);
		let first = document.getElementById(pair[0]);
		let second = document.getElementById(pair[1]);
		document.getElementById("Result").appendChild(first);
		document.getElementById("Result").appendChild(second);
	}
}

function distance_sort(a, b) {
	return a[1] - b[1];
}

function hash_pair_to_key(hash1, hash2) {
	return JSON.stringify([hash1, hash2]);
}

function parse_date(date_string) {
	const b = date_string.split(/\D/);
	return new Date(b[0],b[1]-1,b[2],b[3],b[4],b[5]);
}

Number.prototype.toRadians = function() { return this * Math.PI / 180; };

function distance_spacetime(lat1, lon1, date1, lat2, lon2, date2) {
	const DAYS_TO_METERS = 1609;
	const DAY_MS = 24 * 60 * 60 * 1000;
	const dist_space = distance_haversine(lat1, lon1, lat2, lon2);

	const time1 = parse_date(date1 + " 0:0:0");
	const time2 = parse_date(date2 + " 0:0:0");

	const time_diff = Math.abs(time1 - time2);
	const days_diff = time_diff / DAY_MS * DAYS_TO_METERS;

	const dist_spacetime = Math.sqrt(days_diff**2 + dist_space**2);
	return dist_spacetime;
}

function distance_haversine(lat1, lon1, lat2, lon2) {
	const R = 6371e3; // metres
	const X1 = lat1.toRadians();
	const X2 = lat2.toRadians();
	const dX = (lat2-lat1).toRadians();
	const dy = (lon2-lon1).toRadians();

	const a = Math.sin(dX/2) * Math.sin(dX/2) +
			Math.cos(X1) * Math.cos(X2) * Math.sin(dy/2) * Math.sin(dy/2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

	const d = R * c;
	return d;
}

const image_hash = {
	"1": new Map(),
	"2": new Map()
};
const distance_grid = new Map();

const read_uploaded_file = (file, id) => {
//	console.log(file);
//	if (!FileReader || !(/image/i).test(file.type))
//		return;

	const binaryReader = new FileReader();

	return new Promise((resolve, reject) => {
		binaryReader.onerror = () => {
			binaryReader.abort();
			reject(new DOMException("Problem parsing input file."));
		};

		binaryReader.onloadend = () => {
			const first_64 = binaryReader.result.slice(0, 2**16 - 1 + 100);
//			const exif = ExifReader.load(first_64);
			const exif = ExifReader.load(binaryReader.result);
			const hash = md5(first_64);
			show_thumbnail(first_64, hash, id);
			if (!image_hash[id].has(hash)) {
				const specs = {
					"name": file.name,
					//"time": exif["GPSDateStamp"] ? [exif["GPSDateStamp"] + " " + exif["GPSTimeStamp"], true] : [exif["DateTime"],
					"date": exif["GPSDateStamp"]?.description || exif["DateTime"]?.description,
					"lat": to_dms(exif["GPSLatitude"]?.description, exif["GPSLatitudeRef"]?.description),
					"lon": to_dms(exif["GPSLongitude"]?.description, exif["GPSLongitudeRef"]?.description),
					"alt": get_alt(exif["GPSAltitude"]?.description, exif["GPSAltitudeRef"]?.value)
				};
				image_hash[id].set(hash, specs);

				const ul = document.getElementById("file-list");
				const li = document.createElement("li")
				li.textContent = file.name + ": " + specs.lat + ", " + specs.lon;
				ul.appendChild(li);
			}
			resolve();
		};
		binaryReader.readAsArrayBuffer(file);
	});
};

function traverseFiles(files, id) {
	if (!files) return;

	const file_array = Array.from(files);
	Promise.all(file_array.map(file => read_uploaded_file(file, id)))
		.then(batch_uploaded);
}

window.onload = function() {
	const dropArea = [document.getElementById("1"), document.getElementById("2")];

	document.getElementById("files-upload").addEventListener("change", function () {
		traverseFiles(this.files, this.id);
	}, false);

	dropArea.forEach(input =>
		input.addEventListener("dragleave", function (evt) {
			var target = evt.target;
			this.className = "";
			evt.preventDefault();
			evt.stopPropagation();
		}, false)
	);

	dropArea.forEach(input =>
		input.addEventListener("dragenter", function (evt) {
			this.className = "over";
			evt.preventDefault();
			evt.stopPropagation();
		}, false)
	);

	dropArea.forEach(input =>
		input.addEventListener("dragover", function (evt) {
			evt.preventDefault();
			evt.stopPropagation();
		}, false)
	);

	dropArea.forEach(input =>
		input.addEventListener("drop", function (evt) {
			traverseFiles(evt.dataTransfer.files, this.id);
			this.className = "";
			evt.preventDefault();
			evt.stopPropagation();
		}, false)
	);
}
