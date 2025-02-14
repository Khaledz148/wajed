// public/js/mobile.js

const socket = io();
let inGroup = false;
let username = ""; // Will be set via the name modal

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
const groupCountBadge = document.getElementById('groupCountBadge');

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
const groupChatBtn = document.getElementById('groupChatBtn');
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

// Group chat messages
socket.on('groupMessage', (data) => {
  const htmlMsg = `<strong>${data.username}:</strong> ${data.message}`;
  const div = document.createElement('div');
  div.innerHTML = htmlMsg;
  document.getElementById('groupChatArea').appendChild(div);
  document.getElementById('groupChatArea').scrollTop = document.getElementById('groupChatArea').scrollHeight;
});
socket.on('groupVoiceMessage', (data) => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${data.username} (صوت):</strong> <audio controls src="${data.audio}" autoplay></audio>`;
  document.getElementById('groupChatArea').appendChild(div);
  document.getElementById('groupChatArea').scrollTop = document.getElementById('groupChatArea').scrollHeight;
  animateParticipant(data.username);
});

// ----- Smoother Live Audio Streaming with Web Audio API -----
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
      nextPlayTime = Math.max(nextPlayTime, audioContext.currentTime);
      source.start(nextPlayTime);
      nextPlayTime += decodedData.duration;
    })
    .catch(error => console.error('Error decoding audio chunk:', error));
}
socket.on('groupVoiceChunk', (data) => {
  playAudioChunk(data.chunk);
});

// ----- Update group count badge -----
socket.on('groupCount', (data) => {
  groupCountBadge.innerText = data.count;
});
