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

// Participant management
const participants = {};
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
    setTimeout(() => { elem.classList.remove('speaking'); }, 2000);
  }
}
const desktopUsername = "المشاهد";
addParticipant(desktopUsername);

// Automatically switch UI based on group activity
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

// TTS helpers: extract message text and speak it (only the message, not the sender)
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

// Helper function to append messages and trigger TTS if needed
function appendMessage(container, message, tts = false) {
  const div = document.createElement('div');
  div.innerHTML = message;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  if (tts && !message.includes("<audio") && !message.includes("<img")) {
    speakText(extractMessageText(message));
  }
}

// Regular chat messages
socket.on('textMessage', (data) => {
  appendMessage(chatArea, `<strong>رسالة:</strong> ${data.message}`, true);
});
socket.on('voiceMessage', (data) => {
  appendMessage(chatArea, `<strong>رسالة صوتية:</strong> <audio controls src="${data.audio}" autoplay></audio>`);
});
socket.on('drawing', (data) => {
  appendMessage(chatArea, `<strong>رسم:</strong><br><img src="${data.image}" style="max-width:100%;">`);
});

// Group chat messages
socket.on('groupMessage', (data) => {
  const htmlMsg = `<strong>${data.username}:</strong> ${data.message}`;
  appendMessage(groupChatArea, htmlMsg, true);
});
socket.on('groupVoiceMessage', (data) => {
  appendMessage(groupChatArea, `<strong>${data.username} (صوت):</strong> <audio controls src="${data.audio}" autoplay></audio>`);
  animateParticipant(data.username);
});
// Live streaming: receive audio chunks
socket.on('groupVoiceChunk', (data) => {
  const audio = new Audio(data.chunk);
  audio.play();
});

// Update participant grid
socket.on('groupJoined', (data) => { addParticipant(data.username); });
socket.on('groupLeft', (data) => { removeParticipant(data.username); });

// Push-to-Talk: Use MediaRecorder with timeslice for near-real-time audio streaming.
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
