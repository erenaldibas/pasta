const startBtn = document.getElementById("startBtn");
const cakeArea = document.getElementById("cakeArea");
const cake = document.getElementById("cake");
const message = document.getElementById("message");
const confettiBurst = document.getElementById("confettiBurst");

let micStream = null;
let audioCtx = null;
let analyser = null;
let monitoringId = null;
let blowHandled = false;

function createLayer(className, delay) {
    const layer = document.createElement("div");
    layer.className = `layer ${className}`;
    layer.style.setProperty("--delay", `${delay}ms`);
    cake.appendChild(layer);

    requestAnimationFrame(() => {
        layer.classList.add("drop");
    });
}

function createCandle(delay) {
    const candle = document.createElement("div");
    candle.className = "candle";
    cake.appendChild(candle);

    setTimeout(() => {
        candle.classList.add("show");
        message.classList.remove("hidden");
        message.classList.add("show");
        message.textContent = "Mumu \u00fcfle";
    }, delay);

    return candle;
}

function launchConfetti() {
    confettiBurst.innerHTML = "";
    confettiBurst.classList.remove("hidden");

    for (let i = 0; i < 90; i += 1) {
        const piece = document.createElement("span");
        piece.className = "confetti";
        piece.style.setProperty("--hue", `${Math.floor(Math.random() * 360)}`);
        piece.style.setProperty("--x", `${Math.random() * 100}%`);
        piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 180}px`);
        piece.style.setProperty("--rot", `${(Math.random() - 0.5) * 960}deg`);
        piece.style.setProperty("--dur", `${2.6 + Math.random() * 1.6}s`);
        piece.style.setProperty("--delay", `${Math.random() * 0.8}s`);
        confettiBurst.appendChild(piece);
    }

    setTimeout(() => {
        confettiBurst.classList.add("hidden");
        confettiBurst.innerHTML = "";
    }, 5200);
}

function scheduleTone(ctx, frequency, startAt, duration, type = "sine", volume = 0.05) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startAt);
    osc.stop(startAt + duration + 0.03);
}

function playCelebrationSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 2.8;
    master.connect(ctx.destination);

    const base = ctx.currentTime + 0.03;
    const melody = [
        { f: 392, d: 0.2 }, { f: 392, d: 0.2 }, { f: 440, d: 0.38 },
        { f: 392, d: 0.38 }, { f: 523, d: 0.38 }, { f: 494, d: 0.62 },
        { f: 392, d: 0.2 }, { f: 392, d: 0.2 }, { f: 440, d: 0.38 },
        { f: 392, d: 0.38 }, { f: 587, d: 0.38 }, { f: 523, d: 0.68 }
    ];

    let cursor = base;
    for (const note of melody) {
        const lead = ctx.createOscillator();
        const leadGain = ctx.createGain();
        lead.type = "triangle";
        lead.frequency.setValueAtTime(note.f, cursor);
        leadGain.gain.setValueAtTime(0.0001, cursor);
        leadGain.gain.exponentialRampToValueAtTime(0.32, cursor + 0.02);
        leadGain.gain.exponentialRampToValueAtTime(0.0001, cursor + note.d);
        lead.connect(leadGain);
        leadGain.connect(master);
        lead.start(cursor);
        lead.stop(cursor + note.d + 0.03);

        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.type = "sine";
        bass.frequency.setValueAtTime(note.f / 2, cursor);
        bassGain.gain.setValueAtTime(0.0001, cursor);
        bassGain.gain.exponentialRampToValueAtTime(0.12, cursor + 0.02);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, cursor + note.d);
        bass.connect(bassGain);
        bassGain.connect(master);
        bass.start(cursor);
        bass.stop(cursor + note.d + 0.03);

        cursor += note.d + 0.03;
    }
}

function stopMicMonitoring() {
    if (monitoringId) {
        cancelAnimationFrame(monitoringId);
        monitoringId = null;
    }
    if (micStream) {
        for (const track of micStream.getTracks()) {
            track.stop();
        }
        micStream = null;
    }
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    analyser = null;
}

function completeCelebration(candle) {
    if (blowHandled) {
        return;
    }

    blowHandled = true;
    stopMicMonitoring();
    candle.classList.add("flame-out");
    launchConfetti();
    playCelebrationSound();

    message.classList.remove("hidden");
    message.classList.add("show");
    message.textContent = "\u0130yi ki do\u011fdun babac\u0131\u011f\u0131m";
}

async function startMicBlowDetection(candle) {
    try {
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
    } catch (err) {
        message.textContent = "Mikrofon izni yok. Muma dokun.";
        candle.addEventListener("click", () => completeCelebration(candle), { once: true });
        return;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    let highFrames = 0;
    const threshold = 0.11;
    const neededFrames = 4;

    function detect() {
        if (blowHandled || !analyser) {
            return;
        }

        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i += 1) {
            const centered = (data[i] - 128) / 128;
            sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / data.length);

        if (rms > threshold) {
            highFrames += 1;
        } else {
            highFrames = Math.max(0, highFrames - 1);
        }

        if (highFrames >= neededFrames) {
            completeCelebration(candle);
            return;
        }

        monitoringId = requestAnimationFrame(detect);
    }

    detect();
}

startBtn.addEventListener("click", () => {
    blowHandled = false;
    startBtn.classList.add("hidden");
    cakeArea.classList.remove("hidden");

    cake.innerHTML = "";
    message.classList.add("hidden");
    message.classList.remove("show");

    createLayer("layer-1", 0);
    createLayer("layer-2", 700);
    createLayer("layer-3", 1400);
    const candle = createCandle(3000);

    setTimeout(() => {
        startMicBlowDetection(candle);
    }, 3200);
});
