// public/js/desktop.js

const socket = io();

// Containers
const regularChatContainer = document.getElementById('regularChatContainer');
const chatArea = document.getElementById('regularChatContainer');
const groupChatContainer = document.getElementById('groupChatContainer');
const groupChatArea = document.getElementById('groupChatArea');
const pushToTalkBtn = document.getElementById('pushToTalkBtn');
const participantGrid = document.getElementById('participantGrid');
const desktopWaveform = document.getElementById('desktopWaveform');

// For push-to-talk recording
let groupMediaRecorder;
let groupAudioChunks = [];
let isGroupRecording = false;

// Manage participants for group view
const participants = {}; // key: username, value: participant element
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

// Automatically switch UI based on group activity:
// When groupActive event is received with active:true, hide regular chat and show group chat.
socket.on('groupActive', (data) => {
  if (data.active) {
    groupChatContainer.style.display = 'block';
    regularChatContainer.style.display = 'none';
  } else {
    groupChatContainer.style.display = 'none';
    regularChatContainer.style.display = 'block';
    // Clear group-specific UI if needed
    participantGrid.innerHTML = "";
    groupChatArea.innerHTML = "";
  }
});

// Text-to-speech function using the Web Speech API
function speakText(text) {
  // Remove any HTML tags
  const tempElem = document.createElement('div');
  tempElem.innerHTML = text;
  const plainText = tempElem.textContent || tempElem.innerText || "";
  if (plainText.trim() === "") return; // nothing to speak

  const utterance = new SpeechSynthesisUtterance(plainText);
  utterance.lang = 'ar-SA'; // Arabic (Saudi Arabia) voice
  speechSynthesis.speak(utterance);
}

// Helper function to append messages and trigger TTS (if applicable)
function appendMessage(container, message, tts = false) {
  const div = document.createElement('div');
  div.innerHTML = message;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  // For simple text messages (skip if it contains audio or images)
  if (tts && !message.includes("<audio") && !message.includes("<img")) {
    speakText(message);
  }
}

// Listen for regular chat messages
socket.on('textMessage', (data) => {
  // Assuming data.message is plain text
  appendMessage(chatArea, `<strong>رسالة:</strong> ${data.message}`, true);
});
socket.on('voiceMessage', (data) => {
  appendMessage(chatArea, `<strong>رسالة صوتية:</strong> <audio controls src="${data.audio}" autoplay></audio>`);
});
socket.on('drawing', (data) => {
  appendMessage(chatArea, `<strong>رسم:</strong><br><img src="${data.image}" style="max-width:100%;">`);
});

// Listen for group chat messages
socket.on('groupMessage', (data) => {
  appendMessage(groupChatArea, `<strong>${data.username}:</strong> ${data.message}`, true);
});
socket.on('groupVoiceMessage', (data) => {
  appendMessage(groupChatArea, `<strong>${data.username} (صوت):</strong> <audio controls src="${data.audio}" autoplay></audio>`);
  animateParticipant(data.username);
});

// Automatically join group if any mobile user is in group.
// (This assumes the server sends a groupActive event when a mobile user joins.)
socket.on('groupJoined', (data) => {
  addParticipant(data.username);
});
socket.on('groupLeft', (data) => {
  removeParticipant(data.username);
});

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
