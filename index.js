import {spawn} from 'child_process';

let totalTimeSeconds;

function onProgress (data) {
	const string = Buffer.from(data).toString('utf8');

	// the time might not be accurate so it's better
	// to check for the progress=end string for the completion
	if (string.includes('progress=end')) {
		console.log('100%');
		return;
	}

	const match = string.matchAll(/out_time=(.+)/gm);
	const timeString = Array.from(match)[0][1];

	// we don't want to calculate negative times!
	if (timeString.includes('-')) {
		console.log('0%');
		return;
	}

	const [hours, minutes, seconds] = timeString.split(':');
	const totalSecondsProgress = Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds);
	const ratio = totalSecondsProgress / totalTimeSeconds;
	const percent = `${parseInt(ratio * 100)}%`;
	console.log(percent);
}

async function encodeMp3 (originPath, targetPath) {
	const params = ['-y', '-i', originPath, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '320k', '-ar', '44100', '-loglevel', 'error', '-progress - -nostats', targetPath];
	await spawnAsync('ffmpeg', params, false, onProgress);
}

async function getMediaInfo (audioFilePath) {
	const params = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', audioFilePath];
	const result = await spawnAsync('ffprobe', params);
	const jsonString = result.toString();
	return JSON.parse(jsonString);
}

function spawnAsync (command, params, ignoreStdError = false, onData) {

	//console.log('spawn', command, params);

	return new Promise((resolve, reject) => {

		const options = {shell: true};

		const child = spawn(command, params, options);

		let failMessage;
		let result = '';

		child.stdout.on('data', (data) => {
			result += data.toString();
			if (onData) onData(data);
			//console.log(Buffer.from(data).toString('utf8'));
		});

		if (!ignoreStdError) {
			child.stderr.on('data', async (data) => {
				const message = `${command} error: ${data}`;
				failMessage = message;
			});
		}

		child.on('error', async (error) => {
			const message = `${command} error: ${error.message}`;
			reject(message);
		});

		child.on('close', async (code) => {
			const message = `${command} FINISH`;

			if (failMessage) {
				console.log(failMessage);
				reject(failMessage);
				return;
			}

			resolve(result);
		});
	});
}

const mediaInfo = await getMediaInfo('audio.wav');
totalTimeSeconds = parseFloat(mediaInfo.format.duration);

encodeMp3('audio.wav', 'audio.mp3');