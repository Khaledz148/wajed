// public/js/desktop.js

const socket = io();

const regularChatContainer = document.getElementById('regularChatContainer');
const chatArea = document.getElementById('regularChatContainer');
const groupChatContainer = document.getElementById('groupChatContainer');
const groupChatArea = document.getElementById('groupChatArea');
const pushToTalkBtn = document.getElementById('pushToTalkBtn');
const participantGrid = document.getElementById('participantGrid');
const desktopWaveform = document.getElementById('desktopWaveform');

let groupMediaRecorder;
let isGroupRecording = false;

// ----- Participant Management -----
const participants = {};
function addParticipant(user) {
  if (!participants[user]) {
    const elem = document.createElement('div');
    elem.classList.add('participant');
    elem.setAttribute('data-username', user);
    elem.innerText = user;
    participantGrid.appendChild(elem);
    participants[user] = elem;
  }
}
function removeParticipant(user) {
  if (participants[user]) {
    participantGrid.removeChild(participants[user]);
    delete participants[user];
  }
}
function animateParticipant(user) {
  const elem = participants[user];
  if (elem) {
    elem.classList.add('speaking');
    setTimeout(() => { elem.classList.remove('speaking'); }, 2000);
  }
}
const desktopUsername = "المشاهد";
addParticipant(desktopUsername);

// ----- Automatic UI Switching Based on Group Activity -----
socket.on('groupActive', (data) => {
  if (data.active) {
    groupChatContainer.style.display = 'block';
    regularChatContainer.style.display = 'none';
  } else {
    groupChatContainer.style.display = 'none';
    regularChatContainer.style.display = 'block';
    participantGrid.innerHTML = "";
    groupChatArea.innerHTML = "";
  }
});

// ----- Text-to-Speech Helpers -----
// Extract only the message (remove sender label)
function extractMessageText(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const text = temp.innerText || temp.textContent || "";
  const colonIndex = text.indexOf(':');
  if (colonIndex !== -1) {
    return text.substring(colonIndex + 1).trim();
  }
  return text.trim();
}
function speakText(text) {
  if (text === "") return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-SA';
  speechSynthesis.speak(utterance);
}

// ----- Append Message Helper -----
function appendMessage(container, message, tts = false) {
  const div = document.createElement('div');
  div.innerHTML = message;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  if (tts && !message.includes("<audio") && !message.includes("<img")) {
    speakText(extractMessageText(message));
  }
}

// ----- Regular Chat Messages -----
socket.on('textMessage', (data) => {
  appendMessage(chatArea, `<strong>رسالة:</strong> ${data.message}`, true);
});
socket.on('voiceMessage', (data) => {
  appendMessage(chatArea, `<strong>رسالة صوتية:</strong> <audio controls src="${data.audio}" autoplay></audio>`);
});
socket.on('drawing', (data) => {
  appendMessage(chatArea, `<strong>رسم:</strong><br><img src="${data.image}" style="max-width:100%;">`);
});

// ----- Group Chat Messages -----
socket.on('groupMessage', (data) => {
  const htmlMsg = `<strong>${data.username}:</strong> ${data.message}`;
  appendMessage(groupChatArea, htmlMsg, true);
});
socket.on('groupVoiceMessage', (data) => {
  appendMessage(groupChatArea, `<strong>${data.username} (صوت):</strong> <audio controls src="${data.audio}" autoplay></audio>`);
  animateParticipant(data.username);
});

// ----- Smoother Live Audio Streaming with Web Audio API -----

// Create a single AudioContext instance for live audio playback
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
// This will hold the time where the next chunk should be played
let nextPlayTime = audioContext.currentTime;

/**
 * Helper: Convert base64 to an ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Decode and play an audio chunk smoothly.
 * @param {string} chunkDataUrl - The data URL of the audio chunk.
 */
function playAudioChunk(chunkDataUrl) {
  const base64 = chunkDataUrl.split(',')[1];
  const arrayBuffer = base64ToArrayBuffer(base64);

  audioContext.decodeAudioData(arrayBuffer)
    .then(decodedData => {
      const source = audioContext.createBufferSource();
      source.buffer = decodedData;
      source.connect(audioContext.destination);

      nextPlayTime = Math.max(nextPlayTime, audioContext.currentTime);
      source.start(nextPlayTime);
      nextPlayTime += decodedData.duration;
    })
    .catch(error => console.error('Error decoding audio chunk:', error));
}

// Replace the old groupVoiceChunk handler with the new smoother one:
socket.on('groupVoiceChunk', (data) => {
  playAudioChunk(data.chunk);
});

// ----- Push-to-Talk for Group Chat (Live Streaming) -----
// Use MediaRecorder with a 100ms timeslice for near–real–time streaming.
function startGroupRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      groupMediaRecorder = new MediaRecorder(stream);
      groupMediaRecorder.start(100);
      isGroupRecording = true;
      groupMediaRecorder.addEventListener("dataavailable", event => {
        const reader = new FileReader();
        reader.readAsDataURL(event.data);
        reader.onloadend = () => {
          socket.emit('groupVoiceChunk', { username: desktopUsername, chunk: reader.result });
        };
      });
      desktopWaveform.classList.remove('d-none');
    })
    .catch(err => console.error('Error accessing microphone:', err));
}
function stopGroupRecording() {
  if (isGroupRecording) {
    groupMediaRecorder.stop();
    isGroupRecording = false;
    desktopWaveform.classList.add('d-none');
  }
}
pushToTalkBtn.addEventListener('mousedown', startGroupRecording);
pushToTalkBtn.addEventListener('mouseup', stopGroupRecording);
pushToTalkBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startGroupRecording(); });
pushToTalkBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopGroupRecording(); });
