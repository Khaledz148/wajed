// public/js/desktop.js

const socket = io();

/**************************************
 *   DOM Elements
 **************************************/
const dateDisplay          = document.getElementById('dateDisplay');
const topParticipantGrid   = document.getElementById('topParticipantGrid');
const regularChatContainer = document.getElementById('regularChatContainer');
const groupChatContainer   = document.getElementById('groupChatContainer');
const groupChatArea        = document.getElementById('groupChatArea');
const participantGrid      = document.getElementById('participantGrid');
const pushToTalkBtn        = document.getElementById('pushToTalkBtn');
const desktopWaveform      = document.getElementById('desktopWaveform');

// Prayer elements
const prayerNameElem       = document.getElementById('prayerName');
const prayerCountdownElem  = document.getElementById('prayerCountdown');

// Globals
let joinedGroup = false;
const desktopUsername = "المشاهد";

/**************************************
 *   1) Show Current Date
 **************************************/
function updateDateDisplay() {
  const now = dayjs(); 
  // Example Arabic-ish format, though dayjs default is in English
  const formatted = now.format('dddd, D MMMM YYYY'); 
  dateDisplay.textContent = formatted;
}
updateDateDisplay();
// Update every minute
setInterval(updateDateDisplay, 60000);

/**************************************
 *   2) Static Prayer Times Countdown
 **************************************/
const prayerSchedule = [
  { name: "الفجر",   hour: 5,  minute: 0 },
  { name: "الظهر",   hour: 12, minute: 30 },
  { name: "العصر",   hour: 15, minute: 45 },
  { name: "المغرب",  hour: 18, minute: 10 },
  { name: "العشاء",  hour: 20, minute: 0 }
];

function getNextPrayer() {
  const now = dayjs();
  for (let p of prayerSchedule) {
    const prayerTime = dayjs()
      .hour(p.hour)
      .minute(p.minute)
      .second(0);
    if (prayerTime.isAfter(now)) {
      return { name: p.name, time: prayerTime };
    }
  }
  // If all passed, show tomorrow's fajr
  const tomorrowFajr = dayjs().add(1, 'day')
    .hour(prayerSchedule[0].hour)
    .minute(prayerSchedule[0].minute)
    .second(0);
  return { name: prayerSchedule[0].name + " (غداً)", time: tomorrowFajr };
}

function formatHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map(num => String(num).padStart(2, '0')).join(':');
}

function updatePrayerCountdown() {
  const now = dayjs();
  const nextP = getNextPrayer();
  prayerNameElem.textContent = nextP.name;

  let diff = nextP.time.diff(now, 'second');
  if (diff < 0) diff = 0;
  prayerCountdownElem.textContent = formatHMS(diff);
}
updatePrayerCountdown();
setInterval(updatePrayerCountdown, 1000);

/**************************************
 *   3) MINI PARTICIPANT GRID
 **************************************/
const participants = {}; // { username: element }

function addParticipant(user) {
  // Add to main group container
  if (!participants[user]) {
    const el = document.createElement('div');
    el.classList.add('participant');
    el.innerText = user;
    participantGrid.appendChild(el);
    participants[user] = el;
  }
  // Add to top mini grid
  const miniId = "mini-" + user;
  if (!document.getElementById(miniId)) {
    const mini = document.createElement('div');
    mini.classList.add('mini-participant');
    mini.id = miniId;
    mini.innerText = user;
    topParticipantGrid.appendChild(mini);
  }
}

function removeParticipant(user) {
  if (participants[user]) {
    participantGrid.removeChild(participants[user]);
    delete participants[user];
  }
  const miniId = "mini-" + user;
  const mini = document.getElementById(miniId);
  if (mini) {
    topParticipantGrid.removeChild(mini);
  }
}

function animateParticipant(user) {
  if (participants[user]) {
    participants[user].classList.add('speaking');
    setTimeout(() => participants[user].classList.remove('speaking'), 2000);
  }
  const mini = document.getElementById("mini-" + user);
  if (mini) {
    mini.classList.add('speaking');
    setTimeout(() => mini.classList.remove('speaking'), 2000);
  }
}

// Listen for groupJoined / groupLeft from server
socket.on('groupJoined', (data) => {
  addParticipant(data.username);
});
socket.on('groupLeft', (data) => {
  removeParticipant(data.username);
});

/**************************************
 *   4) GROUP ACTIVE LOGIC
 **************************************/
socket.on('groupActive', (data) => {
  if (data.active && !joinedGroup) {
    socket.emit('joinGroup', { username: desktopUsername });
    joinedGroup = true;
    groupChatContainer.style.display = 'block';
    regularChatContainer.style.display = 'none';
  } else if (!data.active && joinedGroup) {
    socket.emit('leaveGroup', { username: desktopUsername });
    joinedGroup = false;
    groupChatContainer.style.display = 'none';
    regularChatContainer.style.display = 'block';

    // Clear participants
    participantGrid.innerHTML = "";
    topParticipantGrid.innerHTML = "";
    groupChatArea.innerHTML = "";
  }
});

/**************************************
 *   5) PUSH-TO-TALK (LIVE STREAMING)
 **************************************/
let groupMediaRecorder;
let isGroupRecording = false;

function startGroupRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      groupMediaRecorder = new MediaRecorder(stream);
      groupMediaRecorder.start(100);
      isGroupRecording = true;

      groupMediaRecorder.addEventListener("dataavailable", event => {
        const reader = new FileReader();
        reader.readAsDataURL(event.data);
        reader.onloadend = () => {
          socket.emit('groupVoiceChunk', {
            username: desktopUsername,
            chunk: reader.result
          });
        };
      });
      desktopWaveform.classList.remove('d-none');
    })
    .catch(err => console.error('Error accessing microphone:', err));
}

function stopGroupRecording() {
  if (isGroupRecording && groupMediaRecorder) {
    groupMediaRecorder.stop();
    isGroupRecording = false;
    desktopWaveform.classList.add('d-none');
  }
}

pushToTalkBtn.addEventListener('mousedown', startGroupRecording);
pushToTalkBtn.addEventListener('mouseup', stopGroupRecording);
pushToTalkBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startGroupRecording();
});
pushToTalkBtn.addEventListener('touchend', (e) => {
  e.preventDefault();
  stopGroupRecording();
});

/**************************************
 *   6) PLAYBACK OF groupVoiceChunk
 **************************************/
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
  animateParticipant(data.username);
});

/**************************************
 *   7) Regular & Group Chat Messages
 **************************************/
/**
 * appendMessageBubble(container, username, text, isMe)
 * - container: either regularChatContainer or groupChatArea
 * - username: e.g. "المشاهد"
 * - text: the message content (HTML allowed, e.g. <audio> tags)
 * - isMe: boolean, whether it's from local user or not
 */
function appendMessageBubble(container, username, text, isMe, doTts = false) {
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble');
  bubble.classList.add(isMe ? 'my-message' : 'other-message');

  // We can show the username at the top, except maybe if it's "me"
  // but let's show it anyway for clarity
  const userLabel = document.createElement('div');
  userLabel.classList.add('chat-username');
  userLabel.textContent = username;

  // The main message (can contain HTML, e.g. <audio> or <img>)
  const messageDiv = document.createElement('div');
  messageDiv.innerHTML = text;

  bubble.appendChild(userLabel);
  bubble.appendChild(messageDiv);

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  // Optional TTS if not audio or image
  if (doTts && !text.includes("<audio") && !text.includes("<img")) {
    speakText(extractMessageText(text));
  }
}

// Regular text / voice / drawing
socket.on('textMessage', (data) => {
  // data = { username, message }
  const isMe = (data.username === desktopUsername);
  appendMessageBubble(
    regularChatContainer,
    data.username,
    data.message, // plain text
    isMe,
    true // TTS?
  );
});
socket.on('voiceMessage', (data) => {
  // data = { username, audio }
  const isMe = (data.username === desktopUsername);
  const content = `<audio controls src="${data.audio}" autoplay></audio>`;
  appendMessageBubble(regularChatContainer, data.username, content, isMe);
});
socket.on('drawing', (data) => {
  // data = { username, image }
  const isMe = (data.username === desktopUsername);
  const content = `<img src="${data.image}" style="max-width:100%;">`;
  appendMessageBubble(regularChatContainer, data.username, content, isMe);
});

// Group chat messages
socket.on('groupMessage', (data) => {
  // data = { username, message }
  const isMe = (data.username === desktopUsername);
  appendMessageBubble(groupChatArea, data.username, data.message, isMe, true);
});
socket.on('groupVoiceMessage', (data) => {
  // data = { username, audio }
  const isMe = (data.username === desktopUsername);
  const content = `<audio controls src="${data.audio}" autoplay></audio>`;
  appendMessageBubble(groupChatArea, data.username, content, isMe);
});

/**************************************
 *   8) TTS Helpers
 **************************************/
function extractMessageText(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const text = temp.innerText || temp.textContent || "";
  return text.trim();
}

function speakText(text) {
  if (!text) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'ar-SA';
  speechSynthesis.speak(utt);
}
