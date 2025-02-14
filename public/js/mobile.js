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
  if (val !== "") {
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
const groupChatInput = document.getElementById('groupChatInput');
const sendGroupTextBtn = document.getElementById('sendGroupTextBtn');
// FIX: Change element ID from "groupPushToTalkBtn" to "pushToTalkBtn" as in the HTML.
const groupPushToTalkBtn = document.getElementById('pushToTalkBtn');
// FIX: Change "mobileDesktopWaveform" to "desktopWaveform" to match HTML.
const desktopWaveform = document.getElementById('desktopWaveform');
const groupCountBadge = document.getElementById('groupCountBadge');

// ---------- Participant Management for Group Mode ----------
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

// ---------- Toggle Group Mode ----------
const groupChatBtn = document.getElementById('groupChatBtn');
groupChatBtn.addEventListener('click', () => {
  if (!inGroup) {
    socket.emit('joinGroup', { username });
    inGroup = true;
    regularChatContainer.style.display = 'none';
    groupChatContainer.style.display = 'block';
    addParticipant(username);
    groupChatBtn.innerText = "غادر المجلس";
  } else {
    socket.emit('leaveGroup', { username });
    inGroup = false;
    groupChatContainer.style.display = 'none';
    regularChatContainer.style.display = 'block';
    groupChatBtn.innerText = "انضم للمجلس";
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
let groupMediaRecorder;
let isGroupRecording = false;

function startGroupRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      groupMediaRecorder = new MediaRecorder(stream);
      groupMediaRecorder.start(250); // send chunks every 250ms
      isGroupRecording = true;
      groupMediaRecorder.addEventListener("dataavailable", event => {
        const reader = new FileReader();
        reader.readAsDataURL(event.data);
        reader.onloadend = () => {
          socket.emit('groupVoiceChunk', { username, chunk: reader.result });
        };
      });
      desktopWaveform.classList.remove('d-none');
    })
    .catch(err => console.error('Error accessing microphone for group:', err));
}
function stopGroupRecording() {
  if (isGroupRecording) {
    groupMediaRecorder.stop();
    isGroupRecording = false;
    desktopWaveform.classList.add('d-none');
  }
}
groupPushToTalkBtn.addEventListener('mousedown', startGroupRecording);
groupPushToTalkBtn.addEventListener('mouseup', stopGroupRecording);
groupPushToTalkBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startGroupRecording(); });
groupPushToTalkBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopGroupRecording(); });

// ---------- Group Chat Text Messaging ----------
sendGroupTextBtn.addEventListener('click', () => {
  const text = groupChatInput.value.trim();
  if (text) {
    socket.emit('groupMessage', { username, message: text });
    groupChatInput.value = '';
  }
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
  if (groupCountBadge) {
    groupCountBadge.innerText = data.count;
  }
});
// Update participant grid on join/leave
socket.on('groupJoined', (data) => { addParticipant(data.username); });
socket.on('groupLeft', (data) => { removeParticipant(data.username); });

// ---------- Helper Functions for TTS ----------
function extractMessageText(html) {
  let temp = document.createElement('div');
  temp.innerHTML = html;
  let text = temp.innerText || temp.textContent || "";
  let colonIndex = text.indexOf(':');
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
