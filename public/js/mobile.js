// public/js/mobile.js

const socket = io();
let inGroup = false;
const username = prompt("أدخل اسمك:") || "مستخدم";

// Elements
const chatArea = document.getElementById('chatArea');
const chatInput = document.getElementById('chatInput');
const sendTextBtn = document.getElementById('sendTextBtn');
const voiceRecordBtn = document.getElementById('voiceRecordBtn');
const micIcon = document.getElementById('micIcon');
const waveform = document.getElementById('waveform');
const drawingBtn = document.getElementById('drawingBtn');
const groupChatBtn = document.getElementById('groupChatBtn');
const groupCountBadge = document.getElementById('groupCountBadge');

// Drawing modal elements
const drawingModal = $('#drawingModal');
const drawingCanvas = document.getElementById('drawingCanvas');
const clearCanvasBtn = document.getElementById('clearCanvasBtn');
const sendDrawingBtn = document.getElementById('sendDrawingBtn');
const colorButtons = document.querySelectorAll('.color-btn');

const drawingCtx = drawingCanvas.getContext('2d');
let currentColor = '#000000';
let drawing = false;

// Append only incoming messages (no self confirmations)
function appendIncomingMessage(message) {
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble');
  bubble.innerHTML = message;
  chatArea.appendChild(bubble);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// Handle sending text message
function sendTextMessage() {
  const text = chatInput.value.trim();
  if (text === '') return;
  if (inGroup) {
    socket.emit('groupMessage', { username, message: text });
  } else {
    socket.emit('textMessage', { message: text });
  }
  chatInput.value = '';
}

sendTextBtn.addEventListener('click', sendTextMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendTextMessage();
  }
});

// Voice recording logic
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
        waveform.classList.remove('d-none'); // show waveform while recording
        audioChunks = [];
        mediaRecorder.addEventListener("dataavailable", event => {
          audioChunks.push(event.data);
        });
        mediaRecorder.addEventListener("stop", () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const base64Audio = reader.result;
            if (inGroup) {
              socket.emit('groupVoiceMessage', { username, audio: base64Audio });
            } else {
              socket.emit('voiceMessage', { audio: base64Audio });
            }
          };
          micIcon.classList.replace('fa-stop', 'fa-microphone');
          waveform.classList.add('d-none'); // hide waveform
          isRecording = false;
        });
      })
      .catch(err => {
        console.error('Error accessing microphone:', err);
      });
  } else {
    mediaRecorder.stop();
  }
});

// Drawing functionality
drawingBtn.addEventListener('click', () => {
  drawingModal.modal('show');
});

// Drawing canvas events
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

// Color palette selection
colorButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    currentColor = btn.getAttribute('data-color');
    colorButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Group chat button toggling
groupChatBtn.addEventListener('click', () => {
  if (!inGroup) {
    socket.emit('joinGroup', { username });
    inGroup = true;
  } else {
    socket.emit('leaveGroup', { username });
    inGroup = false;
  }
});

// Socket event listeners for incoming messages
socket.on('textMessage', (data) => {
  appendIncomingMessage(`<strong>رسالة:</strong> ${data.message}`);
});
socket.on('voiceMessage', (data) => {
  appendIncomingMessage(`<strong>رسالة صوتية:</strong> <audio controls src="${data.audio}"></audio>`);
});
socket.on('drawing', (data) => {
  appendIncomingMessage(`<strong>رسم:</strong><br><img src="${data.image}" style="max-width:100%;">`);
});
socket.on('groupMessage', (data) => {
  appendIncomingMessage(`<strong>${data.username}:</strong> ${data.message}`);
});
socket.on('groupVoiceMessage', (data) => {
  appendIncomingMessage(`<strong>${data.username} (صوت):</strong> <audio controls src="${data.audio}"></audio>`);
});
socket.on('groupCount', (data) => {
  groupCountBadge.innerText = data.count;
});
