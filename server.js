// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Regular messages
  socket.on('textMessage', (data) => {
    io.emit('textMessage', data);
  });
  socket.on('voiceMessage', (data) => {
    io.emit('voiceMessage', data);
  });
  socket.on('drawing', (data) => {
    io.emit('drawing', data);
  });

  // Group (المجلس) events
  socket.on('joinGroup', (data) => {
    socket.join('majlis');
    const clients = io.sockets.adapter.rooms.get('majlis');
    const count = clients ? clients.size : 0;
    io.emit('groupCount', { count: count });
    io.to('majlis').emit('groupStatus', { message: `${data.username} دخل المجلس.` });
    io.emit('groupActive', { active: true });
    io.emit('groupJoined', { username: data.username });
  });

  socket.on('leaveGroup', (data) => {
    socket.leave('majlis');
    io.to('majlis').emit('groupStatus', { message: `${data.username} غادر المجلس.` });
    const clients = io.sockets.adapter.rooms.get('majlis');
    const count = clients ? clients.size : 0;
    io.emit('groupCount', { count: count });
    if (!clients || clients.size === 0) {
      io.emit('groupActive', { active: false });
    }
    io.emit('groupLeft', { username: data.username });
  });

  socket.on('groupMessage', (data) => {
    io.to('majlis').emit('groupMessage', data);
  });

  // NEW: Live streaming of audio chunks from push-to-talk
  socket.on('groupVoiceChunk', (data) => {
    io.to('majlis').emit('groupVoiceChunk', data);
  });

  socket.on('groupVoiceMessage', (data) => {
    io.to('majlis').emit('groupVoiceMessage', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const clients = io.sockets.adapter.rooms.get('majlis');
    const count = clients ? clients.size : 0;
    io.emit('groupCount', { count: count });
    if (!clients || clients.size === 0) {
      io.emit('groupActive', { active: false });
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});