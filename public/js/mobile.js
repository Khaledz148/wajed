// public/js/mobile.js

const socket = io();
let inGroup = false;
let username = ""; // will be set via modal

// ---------- Name Modal Handling ----------
const nameModal = $('#nameModal');
const usernameInput = document.getElementById('usernameInput');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');

saveUsernameBtn.addEventListener('click', () => {
  const val = usernameInput.value.trim();
  if(val !== ""){
    username = val;
    nameModal.modal('hide');
  }
});
nameModal.modal('show');  // force name entry on load

// ---------- Regular Chat Elements ----------
const regularChatContainer = document.getElementById('regularChatContainer');
const chatArea = document.getElementById('chatArea');
const chatInput = document.getElementById('chatInput');
const sendTextBtn = document.getElementById('sendTextBtn');
const voiceRecordBtn = document.getElementById('voiceRecordBtn');
const micIcon = document.getElementById('micIcon');
const waveform = document.getElementById('waveform');

// ---------- Group Chat Elements ----------
const groupChatContainer = document.getElementById('groupChatContainer');
const participantGrid = document.getElementById('participantGrid');
const groupChatArea = document.getElementById('groupChatArea');
const groupChatInput = document.getElementById('groupChatInput'); // if added later for text messages in group
const sendGroupTextBtn = document.getElementById('sendGroupTextBtn'); // if added
const groupPushToTalkBtn = document.getElementById('groupPushToTalkBtn');
const mobileDesktopWaveform = document.getElementById('mobileDesktopWaveform');

// ---------- Drawing Modal Elements ----------
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

// ---------- Participant Management for Group Mode ----------
const participants = {}; // key: username, value: element
function addParticipant(username) {
  if (!participants[username]) {
    const elem = document.createElement('div');
    elem.classList.add('participant');
    elem.setAttribute('data-username', username);
    elem.innerText = username;
    participantGrid.appendChild(elem);
    participants[username] = elem;
  }
}
function removeParticipant(username) {
  if (participants[username]) {
    participantGrid.removeChild(participants[username]);
    delete participants[username];
  }
}
function animateParticipant(username) {
  const elem = participants[username];
  if (elem) {
    elem.classList.add('speaking');
    setTimeout(() => {
      elem.classList.remove('speaking');
    }, 2000);
  }
}

// ---------- Toggle Group Mode ----------
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

// ---------- Regular Chat Functions ----------
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

// ---------- Group Chat Push-to-Talk (Live Streaming) ----------
// Use MediaRecorder with a timeslice so that each data chunk is sent immediately.
let groupMediaRecorder;
let isGroupRecording = false;

function startGroupRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      groupMediaRecorder = new MediaRecorder(stream);
      // Start recording with a timeslice (250ms)
      groupMediaRecorder.start(250);
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

// ---------- Drawing Functions ----------
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
// Touch events for mobile drawing support
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

// ---------- Socket Listeners ----------
// Regular chat messages
socket.on('textMessage', (data) => {
  const htmlMsg = `<strong>رسالة:</strong> ${data.message}`;
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble');
  bubble.innerHTML = htmlMsg;
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

// Group chat messages
socket.on('groupMessage', (data) => {
  const htmlMsg = `<strong>${data.username}:</strong> ${data.message}`;
  const div = document.createElement('div');
  div.innerHTML = htmlMsg;
  groupChatArea.appendChild(div);
  groupChatArea.scrollTop = groupChatArea.scrollHeight;
  // Use TTS to read the message text (without sender label)
  speakText(extractMessageText(htmlMsg));
});
socket.on('groupVoiceMessage', (data) => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${data.username} (صوت):</strong> <audio controls src="${data.audio}" autoplay></audio>`;
  groupChatArea.appendChild(div);
  groupChatArea.scrollTop = groupChatArea.scrollHeight;
  animateParticipant(data.username);
});
// Live audio chunks for near-real-time streaming in group chat
socket.on('groupVoiceChunk', (data) => {
  const audio = new Audio(data.chunk);
  audio.play();
});

// Update group count badge
socket.on('groupCount', (data) => {
  groupCountBadge.innerText = data.count;
});
// Update participant grid on join/leave
socket.on('groupJoined', (data) => {
  addParticipant(data.username);
});
socket.on('groupLeft', (data) => {
  removeParticipant(data.username);
});

// Helper functions for TTS: Extract message text (omit sender label) and speak it.
function extractMessageText(html) {
  let temp = document.createElement('div');
  temp.innerHTML = html;
  let text = temp.innerText || temp.textContent || "";
  let colonIndex = text.indexOf(':');
  if(colonIndex !== -1) {
    return text.substring(colonIndex+1).trim();
  }
  return text.trim();
}
function speakText(text) {
  if(text === "") return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-SA'; // Arabic (Saudi Arabia)
  speechSynthesis.speak(utterance);
}
