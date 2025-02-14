// public/js/desktop.js

// Connect to Socket.io
const socket = io();

// Grab references to DOM elements
const regularChatContainer = document.getElementById('regularChatContainer');
const groupChatContainer = document.getElementById('groupChatContainer');
const groupChatArea = document.getElementById('groupChatArea');
const pushToTalkBtn = document.getElementById('pushToTalkBtn');
const participantGrid = document.getElementById('participantGrid');
const desktopWaveform = document.getElementById('desktopWaveform');

// Keep track of whether we've joined the group
let joinedGroup = false;

// Set a username for the desktop client
const desktopUsername = "المشاهد";

// ----- Participant Management -----
const participants = {}; // { username: DOM_element }
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
    setTimeout(() => {
      elem.classList.remove('speaking');
    }, 2000);
  }
}

// Listen for when any user (including desktop) joins the group
socket.on('groupJoined', (data) => {
  addParticipant(data.username);
});

// Listen for when any user leaves the group
socket.on('groupLeft', (data) => {
  removeParticipant(data.username);
});

// ----- groupActive Handling -----
// If groupActive = true, it means at least one user is in the majlis.
// We only join the majlis if we haven't joined yet.
// If groupActive = false, we leave the majlis if we are in.
socket.on('groupActive', (data) => {
  if (data.active && !joinedGroup) {
    // Join the group
    socket.emit('joinGroup', { username: desktopUsername });
    joinedGroup = true;

    // Show group UI, hide regular UI
    groupChatContainer.style.display = 'block';
    regularChatContainer.style.display = 'none';
  } else if (!data.active && joinedGroup) {
    // Leave the group
    socket.emit('leaveGroup', { username: desktopUsername });
    joinedGroup = false;

    // Hide group UI, show regular UI
    groupChatContainer.style.display = 'none';
    regularChatContainer.style.display = 'block';

    // Clear the participant grid & group messages if you want
    participantGrid.innerHTML = "";
    groupChatArea.innerHTML = "";
  }
});

// ----- Push-to-Talk (Live Streaming) -----
let groupMediaRecorder;
let isGroupRecording = false;

function startGroupRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      groupMediaRecorder = new MediaRecorder(stream);
      // Use a short timeslice for near–real–time
      groupMediaRecorder.start(100);
      isGroupRecording = true;

      // Send each small chunk to the server
      groupMediaRecorder.addEventListener("dataavailable", event => {
        const reader = new FileReader();
        reader.readAsDataURL(event.data);
        reader.onloadend = () => {
          socket.emit('groupVoiceChunk', {
            username: desktopUsername,
            chunk: reader.result
          });
        };
      });

      // Show waveform while recording
      desktopWaveform.classList.remove('d-none');
    })
    .catch(err => console.error('Error accessing microphone:', err));
}

function stopGroupRecording() {
  if (isGroupRecording && groupMediaRecorder) {
    groupMediaRecorder.stop();
    isGroupRecording = false;

    // Hide waveform after recording
    desktopWaveform.classList.add('d-none');
  }
}

// Listen for mouse/touch events on the push-to-talk button
pushToTalkBtn.addEventListener('mousedown', startGroupRecording);
pushToTalkBtn.addEventListener('mouseup', stopGroupRecording);
pushToTalkBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startGroupRecording();
});
pushToTalkBtn.addEventListener('touchend', (e) => {
  e.preventDefault();
  stopGroupRecording();
});

// ----- Text-to-Speech Helpers (Optional) -----
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

  // If tts is true and message is not an audio or image, speak it
  if (tts && !message.includes("<audio") && !message.includes("<img")) {
    speakText(extractMessageText(message));
  }
}

// ----- Regular Chat Events -----
// (Your server or code may still emit these even if the desktop isn't actively chatting.)
socket.on('textMessage', (data) => {
  appendMessage(regularChatContainer, `<strong>رسالة:</strong> ${data.message}`, true);
});
socket.on('voiceMessage', (data) => {
  appendMessage(regularChatContainer, `<strong>رسالة صوتية:</strong> <audio controls src="${data.audio}" autoplay></audio>`);
});
socket.on('drawing', (data) => {
  appendMessage(regularChatContainer, `<strong>رسم:</strong><br><img src="${data.image}" style="max-width:100%;">`);
});

// ----- Group Chat Events -----
socket.on('groupMessage', (data) => {
  const htmlMsg = `<strong>${data.username}:</strong> ${data.message}`;
  appendMessage(groupChatArea, htmlMsg, true);
});
socket.on('groupVoiceMessage', (data) => {
  const msg = `<strong>${data.username} (صوت):</strong> <audio controls src="${data.audio}" autoplay></audio>`;
  appendMessage(groupChatArea, msg);
  animateParticipant(data.username);
});

// ----- Smooth Live Audio Streaming (groupVoiceChunk) -----
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let nextPlayTime = audioContext.currentTime;

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function playAudioChunk(chunkDataUrl) {
  const base64 = chunkDataUrl.split(',')[1];
  const arrayBuffer = base64ToArrayBuffer(base64);

  audioContext.decodeAudioData(arrayBuffer)
    .then(decodedData => {
      const source = audioContext.createBufferSource();
      source.buffer = decodedData;
      source.connect(audioContext.destination);

      // Schedule playback
      nextPlayTime = Math.max(nextPlayTime, audioContext.currentTime);
      source.start(nextPlayTime);
      nextPlayTime += decodedData.duration;
    })
    .catch(error => console.error('Error decoding audio chunk:', error));
}

socket.on('groupVoiceChunk', (data) => {
  playAudioChunk(data.chunk);
});
