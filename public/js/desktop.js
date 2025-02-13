// public/js/desktop.js

const socket = io();

const chatArea = document.getElementById('chatArea');
const groupDisplaySection = document.getElementById('groupDisplaySection');
const groupChatArea = document.getElementById('groupChatArea');
const pushToTalkBtn = document.getElementById('pushToTalkBtn');
const participantGrid = document.getElementById('participantGrid');
const desktopWaveform = document.getElementById('desktopWaveform');

let groupMediaRecorder;
let groupAudioChunks = [];
let isGroupRecording = false;

const participants = {}; // key: username, value: participant element

// Helper function to append messages to a container
function appendMessage(container, message) {
  const div = document.createElement('div');
  div.innerHTML = message;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Listen for regular text messages and drawings; add them to chatArea
socket.on('textMessage', (data) => {
  appendMessage(chatArea, `<strong>رسالة:</strong> ${data.message}`);
});
socket.on('drawing', (data) => {
  appendMessage(chatArea, `<strong>رسم:</strong><br><img src="${data.image}" style="max-width:100%;">`);
});
socket.on('voiceMessage', (data) => {
  appendMessage(chatArea, `<strong>رسالة صوتية:</strong> <audio controls src="${data.audio}" autoplay></audio>`);
});

// For group messages, append them to groupChatArea
socket.on('groupMessage', (data) => {
  appendMessage(groupChatArea, `<strong>${data.username}:</strong> ${data.message}`);
});
socket.on('groupVoiceMessage', (data) => {
  appendMessage(groupChatArea, `<strong>${data.username} (صوت):</strong> <audio controls src="${data.audio}" autoplay></audio>`);
  animateParticipant(data.username);
});

// Participant grid functions
function addParticipant(username) {
  if (!participants[username]) {
    const participantElem = document.createElement('div');
    participantElem.classList.add('participant');
    participantElem.setAttribute('data-username', username);
    participantElem.innerHTML = username;
    participantGrid.appendChild(participantElem);
    participants[username] = participantElem;
  }
}
function removeParticipant(username) {
  if (participants[username]) {
    participantGrid.removeChild(participants[username]);
    delete participants[username];
  }
}
function animateParticipant(username) {
  const participantElem = participants[username];
  if (participantElem) {
    participantElem.classList.add('speaking');
    setTimeout(() => {
      participantElem.classList.remove('speaking');
    }, 2000);
  }
}

// Add self (desktop user) to the participant grid for group chat
const desktopUsername = "المشاهد";
addParticipant(desktopUsername);

// Push-to-Talk functionality with waveform indicator
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
    .catch(err => {
      console.error('Error accessing microphone:', err);
    });
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
        const base64Audio = reader.result;
        socket.emit('groupVoiceMessage', { username: desktopUsername, audio: base64Audio });
        animateParticipant(desktopUsername);
      };
    });
  }
});

// Update participant grid when group join/leave events are received
socket.on('groupJoined', (data) => {
  addParticipant(data.username);
});
socket.on('groupLeft', (data) => {
  removeParticipant(data.username);
});

// Show or hide the group section based on group activity
socket.on('groupActive', (data) => {
  if (data.active) {
    groupDisplaySection.classList.remove('d-none');
  } else {
    groupDisplaySection.classList.add('d-none');
    participantGrid.innerHTML = "";
    groupChatArea.innerHTML = "";
  }
});
