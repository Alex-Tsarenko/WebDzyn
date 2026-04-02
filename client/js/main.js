let signalingManager;
let webrtcManager;
let remoteUsers = new Set();
let unreadMessages = 0;

const elements = {
  startScreen: document.getElementById('start-screen'),
  roomScreen: document.getElementById('room-screen'),
  createRoomBtn: document.getElementById('create-room-btn'),
  joinRoomBtn: document.getElementById('join-room-btn'),
  roomIdInput: document.getElementById('room-id-input'),
  currentRoomId: document.getElementById('current-room-id'),
  copyRoomIdBtn: document.getElementById('copy-room-id-btn'),
  connectionStatus: document.getElementById('connection-status'),
  connectionText: document.getElementById('connection-text'),
  callStatus: document.getElementById('call-status'),
  participantsGrid: document.getElementById('participants-grid'),
  participantsCount: document.getElementById('participants-count'),
  muteBtn: document.getElementById('mute-btn'),
  endCallBtn: document.getElementById('end-call-btn'),
  audioContainer: document.getElementById('audio-container'),
  toggleChatBtn: document.getElementById('toggle-chat-btn'),
  chatContainer: document.getElementById('chat-container'),
  chatMessages: document.getElementById('chat-messages'),
  chatInput: document.getElementById('chat-input'),
  sendMessageBtn: document.getElementById('send-message-btn'),
  unreadCount: document.getElementById('unread-count'),
  notification: document.getElementById('notification'),
  notificationText: document.getElementById('notification-text'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalMessage: document.getElementById('modal-message'),
  modalCloseBtn: document.getElementById('modal-close-btn')
};

function init() {
  signalingManager = new SignalingManager();
  webrtcManager = new WebRTCManager();

  setupWebRTCCallbacks();
  setupEventListeners();
  setupSignalingCallbacks();

  connectToServer();
  checkUrlParameters();
}

function setupWebRTCCallbacks() {
  webrtcManager.onIceCandidate = (candidate, userId) => {
    signalingManager.sendIceCandidate(candidate, userId);
  };

  webrtcManager.onRemoteStream = (stream, userId) => {
    console.log('[Main] 📥 Remote stream from:', userId);
    let audio = document.getElementById(`audio-${userId}`);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `audio-${userId}`;
      audio.autoplay = true;
      elements.audioContainer.appendChild(audio);
    }
    audio.srcObject = stream;
  };

  webrtcManager.onRemoteStreamRemoved = (userId) => {
    const audio = document.getElementById(`audio-${userId}`);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
    }
  };
}

function checkUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room');
  
  if (roomId) {
    elements.roomIdInput.value = roomId.toUpperCase();
    
    setTimeout(() => {
      if (signalingManager.isConnected) {
        handleJoinRoom();
      } else {
        const checkConnection = setInterval(() => {
          if (signalingManager.isConnected) {
            clearInterval(checkConnection);
            handleJoinRoom();
          }
        }, 100);
        
        setTimeout(() => clearInterval(checkConnection), 5000);
      }
    }, 500);
  }
}

function setupEventListeners() {
  elements.createRoomBtn.addEventListener('click', handleCreateRoom);
  elements.joinRoomBtn.addEventListener('click', handleJoinRoom);
  elements.roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleJoinRoom();
    }
  });
  elements.copyRoomIdBtn.addEventListener('click', handleCopyRoomId);
  elements.muteBtn.addEventListener('click', handleToggleMute);
  elements.endCallBtn.addEventListener('click', handleEndCall);
  elements.toggleChatBtn.addEventListener('click', handleToggleChat);
  elements.sendMessageBtn.addEventListener('click', handleSendMessage);
  elements.chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });
  elements.modalCloseBtn.addEventListener('click', hideModal);
}

function setupSignalingCallbacks() {
  signalingManager.on('connected', (socketId) => {
    updateConnectionStatus('connected', 'Подключено');
  });

  signalingManager.on('disconnected', () => {
    updateConnectionStatus('disconnected', 'Отключено');
    showNotification('Соединение с сервером потеряно', 'error');
  });

  signalingManager.on('roomCreated', async (roomId, iceServers) => {
    console.log('[Main] 🏠 Room created:', roomId);
    
    showRoomScreen(roomId);
    showNotification('Комната создана! Поделитесь ID с собеседниками.', 'success');
    
    try {
      await webrtcManager.initialize(iceServers);
      console.log('[Main] 🎤 Microphone ready, waiting for peers...');
      elements.callStatus.textContent = 'Ожидание собеседников...';
      updateParticipantsCount();
    } catch (error) {
      console.error('[Main] ❌ Error initializing:', error);
      showNotification(error.message, 'error');
      handleEndCall();
    }
  });

  signalingManager.on('roomJoined', async (roomId, users, iceServers) => {
    console.log('[Main] 🚪 Joined room:', roomId);
    console.log('[Main] 👥 Existing users:', users);
    
    showRoomScreen(roomId);
    showNotification('Вы присоединились к комнате', 'success');
    
    try {
      await webrtcManager.initialize(iceServers);
      
      if (users.length > 0) {
        users.forEach(userId => {
          remoteUsers.add(userId);
          addParticipantCard(userId);
        });
        updateCallStatus();
        console.log('[Main] � Waiting for offers from existing users:', Array.from(remoteUsers));
      }
      updateParticipantsCount();
    } catch (error) {
      console.error('[Main] ❌ Error joining room:', error);
      showNotification(error.message, 'error');
      handleEndCall();
    }
  });

  signalingManager.on('userJoined', async (userId) => {
    console.log('[Main] 👤 User joined:', userId);
    remoteUsers.add(userId);
    addParticipantCard(userId);
    updateCallStatus();
    updateParticipantsCount();
    showNotification('Новый участник присоединился к звонку', 'success');
    
    try {
      const offer = await webrtcManager.createOffer(userId);
      signalingManager.sendOffer(offer, userId);
      console.log('[Main] � Offer sent to:', userId);
    } catch (error) {
      console.error('[Main] ❌ Error creating offer for', userId, error);
    }
  });

  signalingManager.on('userLeft', (userId) => {
    console.log('[Main] 👤 User left:', userId);
    remoteUsers.delete(userId);
    removeParticipantCard(userId);
    webrtcManager.removePeer(userId);
    updateCallStatus();
    updateParticipantsCount();
    showNotification('Участник покинул звонок', 'error');
    console.log('[Main] 👥 Remaining users:', Array.from(remoteUsers));
  });

  signalingManager.on('offer', async (offer, userId) => {
    console.log('[Main] 📥 Offer from:', userId);
    try {
      const answer = await webrtcManager.handleOffer(offer, userId);
      signalingManager.sendAnswer(answer, userId);
      console.log('[Main] 📝 Answer sent to:', userId);
    } catch (error) {
      console.error('[Main] ❌ Error handling offer from', userId, error);
    }
  });

  signalingManager.on('answer', async (answer, userId) => {
    console.log('[Main] 📥 Answer from:', userId);
    try {
      await webrtcManager.handleAnswer(answer, userId);
    } catch (error) {
      console.error('[Main] ❌ Error handling answer from', userId, error);
    }
  });

  signalingManager.on('iceCandidate', async (candidate, userId) => {
    try {
      await webrtcManager.addIceCandidate(candidate, userId);
    } catch (error) {
      console.error('[Main] ❌ Error adding ICE candidate from', userId, error);
    }
  });

  signalingManager.on('message', (message, userId, timestamp) => {
    addMessageToChat(message, 'received', timestamp);
    
    if (elements.chatContainer.classList.contains('hidden')) {
      unreadMessages++;
      updateUnreadCount();
    }
  });
}

async function connectToServer() {
  updateConnectionStatus('connecting', 'Подключение...');
  
  try {
    await signalingManager.connect();
  } catch (error) {
    console.error('Failed to connect to server:', error);
    updateConnectionStatus('disconnected', 'Ошибка подключения');
    showModal('Ошибка подключения', 'Не удалось подключиться к серверу. Проверьте, что сервер запущен.');
  }
}

async function handleCreateRoom() {
  elements.createRoomBtn.disabled = true;
  
  try {
    const response = await signalingManager.createRoom();
    updateUrlWithRoom(response.roomId);
  } catch (error) {
    console.error('Error creating room:', error);
    showNotification('Не удалось создать комнату: ' + error.message, 'error');
    elements.createRoomBtn.disabled = false;
  }
}

function updateUrlWithRoom(roomId) {
  const url = new URL(window.location);
  url.searchParams.set('room', roomId);
  window.history.pushState({}, '', url);
}

async function handleJoinRoom() {
  const roomId = elements.roomIdInput.value.trim().toUpperCase();
  
  if (!roomId) {
    showNotification('Введите ID комнаты', 'error');
    return;
  }
  
  if (roomId.length !== 6) {
    showNotification('ID комнаты должен содержать 6 символов', 'error');
    return;
  }
  
  elements.joinRoomBtn.disabled = true;
  
  try {
    await signalingManager.joinRoom(roomId);
  } catch (error) {
    console.error('Error joining room:', error);
    showNotification('Не удалось присоединиться: ' + error.message, 'error');
    elements.joinRoomBtn.disabled = false;
  }
}

function handleCopyRoomId() {
  const roomId = elements.currentRoomId.textContent;
  const roomUrl = `${window.location.origin}/?room=${roomId}`;
  
  navigator.clipboard.writeText(roomUrl).then(() => {
    showNotification('Ссылка на комнату скопирована в буфер обмена', 'success');
    elements.copyRoomIdBtn.textContent = '✓';
    setTimeout(() => {
      elements.copyRoomIdBtn.textContent = '📋';
    }, 2000);
  }).catch(() => {
    showNotification('Не удалось скопировать ссылку', 'error');
  });
}

function handleToggleMute() {
  const isMuted = webrtcManager.toggleMute();
  
  if (isMuted) {
    elements.muteBtn.classList.add('muted');
    elements.muteBtn.querySelector('.icon').textContent = '🎙️❌';
    showNotification('Микрофон выключен', 'success');
  } else {
    elements.muteBtn.classList.remove('muted');
    elements.muteBtn.querySelector('.icon').textContent = '🎤';
    showNotification('Микрофон включен', 'success');
  }
}

function handleEndCall() {
  signalingManager.leaveRoom();
  webrtcManager.close();
  clearRemoteAudio();
  
  elements.startScreen.classList.add('active');
  elements.roomScreen.classList.remove('active');
  
  elements.roomIdInput.value = '';
  elements.createRoomBtn.disabled = false;
  elements.joinRoomBtn.disabled = false;
  elements.muteBtn.classList.remove('muted');
  elements.muteBtn.querySelector('.icon').textContent = '🎤';
  elements.chatContainer.classList.add('hidden');
  elements.chatMessages.innerHTML = '';
  elements.chatInput.value = '';
  remoteUsers.clear();
  clearParticipantsGrid();
  unreadMessages = 0;
  updateUnreadCount();
  
  showNotification('Звонок завершен', 'success');
}

function handleToggleChat() {
  elements.chatContainer.classList.toggle('hidden');
  
  if (!elements.chatContainer.classList.contains('hidden')) {
    unreadMessages = 0;
    updateUnreadCount();
    elements.chatInput.focus();
  }
}

function handleSendMessage() {
  const message = elements.chatInput.value.trim();
  
  if (!message) {
    return;
  }
  
  signalingManager.sendMessage(message);
  addMessageToChat(message, 'sent', Date.now());
  elements.chatInput.value = '';
}

function addMessageToChat(message, type, timestamp) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  
  const messageText = document.createElement('div');
  messageText.textContent = message;
  
  const messageTime = document.createElement('div');
  messageTime.className = 'message-time';
  messageTime.textContent = new Date(timestamp).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  messageEl.appendChild(messageText);
  messageEl.appendChild(messageTime);
  elements.chatMessages.appendChild(messageEl);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function updateUnreadCount() {
  if (unreadMessages > 0) {
    elements.unreadCount.textContent = unreadMessages;
    elements.unreadCount.classList.remove('hidden');
  } else {
    elements.unreadCount.classList.add('hidden');
  }
}

function addParticipantCard(userId) {
  const card = document.createElement('div');
  card.className = 'participant-card';
  card.id = `participant-${userId}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'participant-avatar';
  avatar.textContent = '🔊';
  
  const name = document.createElement('div');
  name.className = 'participant-name';
  name.textContent = `Участник ${userId.substring(0, 4)}`;
  
  card.appendChild(avatar);
  card.appendChild(name);
  elements.participantsGrid.appendChild(card);
}

function removeParticipantCard(userId) {
  const card = document.getElementById(`participant-${userId}`);
  if (card) {
    card.classList.add('leaving');
    setTimeout(() => card.remove(), 300);
  }
}

function clearParticipantsGrid() {
  const cards = elements.participantsGrid.querySelectorAll('.participant-card:not(.self)');
  cards.forEach(card => card.remove());
}

function clearRemoteAudio() {
  if (elements.audioContainer) {
    elements.audioContainer.innerHTML = '';
  }
}

function updateParticipantsCount() {
  elements.participantsCount.textContent = remoteUsers.size + 1;
}

function updateCallStatus() {
  if (remoteUsers.size === 0) {
    elements.callStatus.textContent = 'Ожидание собеседников...';
  } else if (remoteUsers.size === 1) {
    elements.callStatus.textContent = 'Звонок активен — 1 собеседник';
  } else {
    elements.callStatus.textContent = `Звонок активен — ${remoteUsers.size} собеседников`;
  }
}

function showRoomScreen(roomId) {
  elements.currentRoomId.textContent = roomId;
  elements.startScreen.classList.remove('active');
  elements.roomScreen.classList.add('active');
}

function updateConnectionStatus(status, text) {
  elements.connectionStatus.className = `status-indicator ${status}`;
  elements.connectionText.textContent = text;
}

function showNotification(message, type = 'success') {
  elements.notificationText.textContent = message;
  elements.notification.className = `notification ${type}`;
  elements.notification.classList.remove('hidden');
  
  setTimeout(() => {
    elements.notification.classList.add('hidden');
  }, 4000);
}

function showModal(title, message) {
  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  elements.modal.classList.remove('hidden');
}

function hideModal() {
  elements.modal.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);
