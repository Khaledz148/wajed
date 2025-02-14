// public/js/mobile.js

const socket = io();
let inGroup = false;
const username = prompt("أدخل اسمك:") || "مستخدم";

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
const groupChatInput = document.getElementById('groupChatInput');
const sendGroupTextBtn = document.getElementById('sendGroupTextBtn');
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
    elem.innerHTML = username;
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
    // Switch to group mode UI
    regularChatContainer.style.display = 'none';
    groupChatContainer.style.display = 'block';
    // Optionally add self to participant grid
    addParticipant(username);
  } else {
    socket.emit('leaveGroup', { username });
    inGroup = false;
    // Switch back to regular chat UI
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

// ---------- Group Chat Functions ----------
sendGroupTextBtn.addEventListener('click', () => {
  const text = groupChatInput.value.trim();
  if (!text) return;
  socket.emit('groupMessage', { username, message: text });
  groupChatInput.value = '';
});
groupChatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    socket.emit('groupMessage', { username, message: groupChatInput.value.trim() });
    groupChatInput.value = '';
  }
});

let groupMediaRecorder;
let groupAudioChunks = [];
let isGroupRecording = false;
groupPushToTalkBtn.addEventListener('mousedown', () => {
  groupPushToTalkBtn.innerText = "جارٍ التسجيل...";
  mobileDesktopWaveform.classList.remove('d-none');
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      groupMediaRecorder = new MediaRecorder(stream);
      groupMediaRecorder.start();
      isGroupRecording = true;
      groupAudioChunks = [];
      groupMediaRecorder.addEventListener("dataavailable", event => {
        groupAudioChunks.push(event.data);
      });
    })
    .catch(err => console.error('Error accessing microphone:', err));
});
groupPushToTalkBtn.addEventListener('mouseup', () => {
  groupPushToTalkBtn.innerText = "اضغط للتحدث";
  mobileDesktopWaveform.classList.add('d-none');
  if (isGroupRecording) {
    groupMediaRecorder.stop();
    isGroupRecording = false;
    groupMediaRecorder.addEventListener("stop", () => {
      const audioBlob = new Blob(groupAudioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        socket.emit('groupVoiceMessage', { username, audio: reader.result });
        animateParticipant(username);
      };
    });
  }
});

// ---------- Drawing Functions ----------
drawingBtn.addEventListener('click', () => {
  drawingModal.modal('show');
});
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
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble');
  bubble.innerHTML = `<strong>رسالة:</strong> ${data.message}`;
  chatArea.appendChild(bubble);
  chatArea.scrollTop = chatArea.scrollHeight;
});
socket.on('voiceMessage', (data) => {
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble');
  bubble.innerHTML = `<strong>رسالة صوتية:</strong> <audio controls src="${data.audio}"></audio>`;
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
  const div = document.createElement('div');
  div.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
  groupChatArea.appendChild(div);
  groupChatArea.scrollTop = groupChatArea.scrollHeight;
});
socket.on('groupVoiceMessage', (data) => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${data.username} (صوت):</strong> <audio controls src="${data.audio}"></audio>`;
  groupChatArea.appendChild(div);
  groupChatArea.scrollTop = groupChatArea.scrollHeight;
  animateParticipant(data.username);
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
// When group mode becomes active/inactive (for all clients)
socket.on('groupActive', (data) => {
  if (data.active) {
    groupChatContainer.style.display = 'block';
  } else {
    groupChatContainer.style.display = 'none';
    participantGrid.innerHTML = "";
    groupChatArea.innerHTML = "";
  }
});
