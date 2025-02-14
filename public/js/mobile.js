// public/js/mobile.js

const socket = io();
let inGroup = false;
let username = ""; // will be set via modal

// ----- Name Modal Handling -----
const nameModal = $('#nameModal');
const usernameInput = document.getElementById('usernameInput');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');

saveUsernameBtn.addEventListener('click', () => {
  const val = usernameInput.value.trim();
  if (val !== "") {
    username = val;
    nameModal.modal('hide');
  }
});
nameModal.modal('show'); // Force name entry on load

// ----- Regular Chat Elements -----
const regularChatContainer = document.getElementById('regularChatContainer');
const chatArea = document.getElementById('chatArea');
const chatInput = document.getElementById('chatInput');
const sendTextBtn = document.getElementById('sendTextBtn');
const voiceRecordBtn = document.getElementById('voiceRecordBtn');
const micIcon = document.getElementById('micIcon');
const waveform = document.getElementById('waveform');

// ----- Group Chat Elements -----
const groupChatContainer = document.getElementById('groupChatContainer');
const participantGrid = document.getElementById('participantGrid');
const groupPushToTalkBtn = document.getElementById('groupPushToTalkBtn');
const mobileDesktopWaveform = document.getElementById('mobileDesktopWaveform');

// ----- Drawing Modal Elements -----
const drawingBtn = document.getElementById('drawingBtn');
const groupChatBtn = document.getElementById('groupChatBtn');
const groupCountBadge = document.getElementById('groupCountBadge');
const drawingModal = $('#drawingModal');
const drawingCanvas = document.getElementById('drawingCanvas');
const clearCanvasBtn = document.getElementById('clearCanvasBtn');
const sendDrawingBtn = document.getElementById('sendDrawingBtn');
const colorButtons = document.querySelectorAll('.color-btn');
const drawingCtx = drawingCanvas.getContext('2d');
let currentColor = '#000000';
let drawing = false;

// ----- Participant Management for Group Mode -----
const participants = {}; // key: username, value: element
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

// ----- Toggle Group Mode -----
groupChatBtn.addEventListener('click', () => {
  if (!inGroup) {
    socket.emit('joinGroup', { username });
    inGroup = true;
    regularChatContainer.style.display = 'none';
    groupChatContainer.style.display = 'block';
    addParticipant(username);
  } else {
    socket.emit('leaveGroup', { username });
    inGroup = false;
    groupChatContainer.style.display = 'none';
    regularChatContainer.style.display = 'block';
  }
});

// ----- Regular Chat Functions -----
function sendTextMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit('textMessage', { message: text });
  chatInput.value = '';
}
sendTextBtn.addEventListener('click', sendTextMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendTextMessage();
});

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
voiceRecordBtn.addEventListener('click', () => {
  if (!isRecording) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();
        isRecording = true;
        micIcon.classList.replace('fa-microphone', 'fa-stop');
        waveform.classList.remove('d-none');
        audioChunks = [];
        mediaRecorder.addEventListener("dataavailable", event => {
          audioChunks.push(event.data);
        });
        mediaRecorder.addEventListener("stop", () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            socket.emit('voiceMessage', { audio: reader.result });
          };
          micIcon.classList.replace('fa-stop', 'fa-microphone');
          waveform.classList.add('d-none');
          isRecording = false;
        });
      })
      .catch(err => console.error('Error accessing microphone:', err));
  } else {
    mediaRecorder.stop();
  }
});

// ----- Group Chat Push-to-Talk (Live Streaming) -----
// Use MediaRecorder with a timeslice of 100ms for near real-time streaming.
let groupMediaRecorder;
let isGroupRecording = false;
function startGroupRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      groupMediaRecorder = new MediaRecorder(stream);
      groupMediaRecorder.start(100); // Send chunks every 100ms
      isGroupRecording = true;
      groupMediaRecorder.addEventListener("dataavailable", event => {
        const reader = new FileReader();
        reader.readAsDataURL(event.data);
        reader.onloadend = () => {
          socket.emit('groupVoiceChunk', { username, chunk: reader.result });
        };
      });
      mobileDesktopWaveform.classList.remove('d-none');
    })
    .catch(err => console.error('Error accessing microphone for group:', err));
}
function stopGroupRecording() {
  if (isGroupRecording) {
    groupMediaRecorder.stop();
    isGroupRecording = false;
    mobileDesktopWaveform.classList.add('d-none');
  }
}
groupPushToTalkBtn.addEventListener('mousedown', startGroupRecording);
groupPushToTalkBtn.addEventListener('mouseup', stopGroupRecording);
groupPushToTalkBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startGroupRecording(); });
groupPushToTalkBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopGroupRecording(); });

// ----- Drawing Functions -----
// Open the drawing modal when the drawing button is clicked
drawingBtn.addEventListener('click', () => {
  drawingModal.modal('show');
});

// Mouse events
drawingCanvas.addEventListener('mousedown', (e) => {
  drawing = true;
  drawingCtx.beginPath();
  drawingCtx.moveTo(e.offsetX, e.offsetY);
});
drawingCanvas.addEventListener('mousemove', (e) => {
  if (drawing) {
    drawingCtx.strokeStyle = currentColor;
    drawingCtx.lineWidth = 2;
    drawingCtx.lineTo(e.offsetX, e.offsetY);
    drawingCtx.stroke();
  }
});
drawingCanvas.addEventListener('mouseup', () => {
  drawing = false;
});
// Touch events (with e.preventDefault() and correct coordinate calculations)
drawingCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = drawingCanvas.getBoundingClientRect();
  drawing = true;
  drawingCtx.beginPath();
  drawingCtx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
});
drawingCanvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (drawing) {
    const touch = e.touches[0];
    const rect = drawingCanvas.getBoundingClientRect();
    drawingCtx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    drawingCtx.strokeStyle = currentColor;
    drawingCtx.lineWidth = 2;
    drawingCtx.stroke();
  }
});
drawingCanvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  drawing = false;
});
clearCanvasBtn.addEventListener('click', () => {
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
});
sendDrawingBtn.addEventListener('click', () => {
  const dataURL = drawingCanvas.toDataURL();
  socket.emit('drawing', { image: dataURL });
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  drawingModal.modal('hide');
});
colorButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    currentColor = btn.getAttribute('data-color');
    colorButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ----- Socket Listeners -----
// Regular chat messages
socket.on('textMessage', (data) => {
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble');
  bubble.innerHTML = `<strong>رسالة:</strong> ${data.message}`;
  chatArea.appendChild(bubble);
  chatArea.scrollTop = chatArea.scrollHeight;
});
socket.on('voiceMessage', (data) => {
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble');
  bubble.innerHTML = `<strong>رسالة صوتية:</strong> <audio controls src="${data.audio}" autoplay></audio>`;
  chatArea.appendChild(bubble);
  chatArea.scrollTop = chatArea.scrollHeight;
});
socket.on('drawing', (data) => {
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble');
  bubble.innerHTML = `<strong>رسم:</strong><br><img src="${data.image}" style="max-width:100%;">`;
  chatArea.appendChild(bubble);
  chatArea.scrollTop = chatArea.scrollHeight;
});

// Create a reference for groupChatArea in mobile mode.
const groupChatArea = document.getElementById('groupChatArea');

// Group chat messages
socket.on('groupMessage', (data) => {
  const htmlMsg = `<strong>${data.username}:</strong> ${data.message}`;
  const div = document.createElement('div');
  div.innerHTML = htmlMsg;
  groupChatArea.appendChild(div);
  groupChatArea.scrollTop = groupChatArea.scrollHeight;
});
socket.on('groupVoiceMessage', (data) => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${data.username} (صوت):</strong> <audio controls src="${data.audio}" autoplay></audio>`;
  groupChatArea.appendChild(div);
  groupChatArea.scrollTop = groupChatArea.scrollHeight;
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
  // Remove the data URL header (e.g., "data:audio/webm;base64,")
  const base64 = chunkDataUrl.split(',')[1];
  const arrayBuffer = base64ToArrayBuffer(base64);

  audioContext.decodeAudioData(arrayBuffer)
    .then(decodedData => {
      // Create a source node for this decoded audio data.
      const source = audioContext.createBufferSource();
      source.buffer = decodedData;
      source.connect(audioContext.destination);

      // Ensure the next chunk starts at the proper time.
      nextPlayTime = Math.max(nextPlayTime, audioContext.currentTime);
      source.start(nextPlayTime);
      // Increment the next available play time by the duration of this chunk.
      nextPlayTime += decodedData.duration;
    })
    .catch(error => console.error('Error decoding audio chunk:', error));
}

// Replace old groupVoiceChunk handler with new one for smoother streaming:
socket.on('groupVoiceChunk', (data) => {
  playAudioChunk(data.chunk);
});
