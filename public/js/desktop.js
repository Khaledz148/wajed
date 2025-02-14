// public/js/desktop.js

const socket = io();

// Containers for the two chat views
const regularChatContainer = document.getElementById('regularChatContainer');
const chatArea = document.getElementById('chatArea');
const groupChatContainer = document.getElementById('groupChatContainer');
const groupChatArea = document.getElementById('groupChatArea');
const pushToTalkBtn = document.getElementById('pushToTalkBtn');
const participantGrid = document.getElementById('participantGrid');
const desktopWaveform = document.getElementById('desktopWaveform');

// Tab buttons
const regularChatTab = document.getElementById('regularChatTab');
const groupChatTab = document.getElementById('groupChatTab');

// For push-to-talk recording
let groupMediaRecorder;
let groupAudioChunks = [];
let isGroupRecording = false;

// Manage participants (for group view)
const participants = {}; // key: username, value: participant element
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

// Add self to participant grid for group chat
const desktopUsername = "المشاهد";
addParticipant(desktopUsername);

// Push-to-Talk functionality for group voice messages
pushToTalkBtn.addEventListener('mousedown', () => {
  pushToTalkBtn.innerText = "جارٍ التسجيل...";
  desktopWaveform.classList.remove('d-none');
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
pushToTalkBtn.addEventListener('mouseup', () => {
  pushToTalkBtn.innerText = "اضغط للتحدث";
  desktopWaveform.classList.add('d-none');
  if (isGroupRecording) {
    groupMediaRecorder.stop();
    isGroupRecording = false;
    groupMediaRecorder.addEventListener("stop", () => {
      const audioBlob = new Blob(groupAudioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        socket.emit('groupVoiceMessage', { username: desktopUsername, audio: reader.result });
        animateParticipant(desktopUsername);
      };
    });
  }
});

// Listen for regular chat messages
socket.on('textMessage', (data) => {
  appendMessage(chatArea, `<strong>رسالة:</strong> ${data.message}`);
});
socket.on('voiceMessage', (data) => {
  appendMessage(chatArea, `<strong>رسالة صوتية:</strong> <audio controls src="${data.audio}" autoplay></audio>`);
});
socket.on('drawing', (data) => {
  appendMessage(chatArea, `<strong>رسم:</strong><br><img src="${data.image}" style="max-width:100%;">`);
});

// Listen for group chat messages
socket.on('groupMessage', (data) => {
  appendMessage(groupChatArea, `<strong>${data.username}:</strong> ${data.message}`);
});
socket.on('groupVoiceMessage', (data) => {
  appendMessage(groupChatArea, `<strong>${data.username} (صوت):</strong> <audio controls src="${data.audio}" autoplay></audio>`);
  animateParticipant(data.username);
});

// Helper function to append messages
function appendMessage(container, message) {
  const div = document.createElement('div');
  div.innerHTML = message;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Update participant grid on join/leave
socket.on('groupJoined', (data) => {
  addParticipant(data.username);
});
socket.on('groupLeft', (data) => {
  removeParticipant(data.username);
});

// Handle tab switching
regularChatTab.addEventListener('click', () => {
  if (!regularChatTab.classList.contains('active')) {
    regularChatTab.classList.add('active');
    groupChatTab.classList.remove('active');
    regularChatContainer.style.display = 'block';
    groupChatContainer.style.display = 'none';
    socket.emit('leaveGroup', { username: desktopUsername });
  }
});
groupChatTab.addEventListener('click', () => {
  if (!groupChatTab.classList.contains('active')) {
    groupChatTab.classList.add('active');
    regularChatTab.classList.remove('active');
    groupChatContainer.style.display = 'block';
    regularChatContainer.style.display = 'none';
    socket.emit('joinGroup', { username: desktopUsername });
  }
});
