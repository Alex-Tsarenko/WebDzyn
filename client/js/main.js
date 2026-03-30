let signalingManager;
let webrtcManager;
let currentRemoteUserId = null;
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
  userAvatar: document.getElementById('user-avatar'),
  muteBtn: document.getElementById('mute-btn'),
  endCallBtn: document.getElementById('end-call-btn'),
  remoteAudio: document.getElementById('remote-audio'),
  localAudio: document.getElementById('local-audio'),
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

  setupEventListeners();
  setupSignalingCallbacks();
  setupWebRTCCallbacks();

  connectToServer();
  checkUrlParameters();
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
    console.log('[Main] 🧊 ICE servers:', iceServers);
    
    showRoomScreen(roomId);
    showNotification('Комната создана! Поделитесь ID с собеседником.', 'success');
    
    try {
      const localStream = await webrtcManager.initialize(iceServers);
      console.log('[Main] 🎤 Local stream initialized, attaching to audio element');
      
      elements.localAudio.srcObject = localStream;
      console.log('[Main] 🎤 Local audio element:', {
        srcObject: elements.localAudio.srcObject,
        muted: elements.localAudio.muted,
        volume: elements.localAudio.volume
      });
      
      elements.callStatus.textContent = 'Ожидание собеседника...';
    } catch (error) {
      console.error('[Main] ❌ Error initializing:', error);
      showNotification(error.message, 'error');
      handleEndCall();
    }
  });

  signalingManager.on('roomJoined', async (roomId, users, iceServers) => {
    console.log('[Main] 🚪 Joined room:', roomId);
    console.log('[Main] 👥 Existing users:', users);
    console.log('[Main] 🧊 ICE servers:', iceServers);
    
    showRoomScreen(roomId);
    showNotification('Вы присоединились к комнате', 'success');
    
    try {
      const localStream = await webrtcManager.initialize(iceServers);
      console.log('[Main] 🎤 Local stream initialized, attaching to audio element');
      
      elements.localAudio.srcObject = localStream;
      console.log('[Main] 🎤 Local audio element:', {
        srcObject: elements.localAudio.srcObject,
        muted: elements.localAudio.muted,
        volume: elements.localAudio.volume
      });
      
      if (users.length > 0) {
        currentRemoteUserId = users[0];
        console.log('[Main] 📞 Initiating call to user:', currentRemoteUserId);
        await initiateCall(currentRemoteUserId);
      }
    } catch (error) {
      console.error('[Main] ❌ Error joining room:', error);
      showNotification(error.message, 'error');
      handleEndCall();
    }
  });

  signalingManager.on('userJoined', async (userId) => {
    console.log('[Main] 👤 User joined:', userId);
    currentRemoteUserId = userId;
    elements.callStatus.textContent = 'Собеседник присоединился';
    elements.userAvatar.textContent = '👥';
    showNotification('Собеседник присоединился к звонку', 'success');
    
    console.log('[Main] 📞 Initiating call to new user:', userId);
    await initiateCall(userId);
  });

  signalingManager.on('userLeft', (userId) => {
    elements.callStatus.textContent = 'Собеседник покинул звонок';
    elements.userAvatar.textContent = '👤';
    showNotification('Собеседник покинул звонок', 'error');
    currentRemoteUserId = null;
    webrtcManager.close();
  });

  signalingManager.on('offer', async (offer, userId) => {
    console.log('[Main] 📥 Received offer from:', userId);
    currentRemoteUserId = userId;
    
    try {
      console.log('[Main] 🔗 Creating peer connection for answer...');
      webrtcManager.createPeerConnection((candidate) => {
        console.log('[Main] 📤 Sending ICE candidate to:', currentRemoteUserId);
        signalingManager.sendIceCandidate(candidate, currentRemoteUserId);
      });
      
      console.log('[Main] 📝 Handling offer and creating answer...');
      await webrtcManager.handleOffer(offer);
      const answer = await webrtcManager.createAnswer();
      
      console.log('[Main] 📤 Sending answer to:', userId);
      signalingManager.sendAnswer(answer, userId);
      
      elements.callStatus.textContent = 'Соединение установлено';
      elements.userAvatar.textContent = '👥';
    } catch (error) {
      console.error('[Main] ❌ Error handling offer:', error);
      showNotification('Ошибка при обработке offer', 'error');
    }
  });

  signalingManager.on('answer', async (answer, userId) => {
    console.log('[Main] 📥 Received answer from:', userId);
    await webrtcManager.handleAnswer(answer);
    console.log('[Main] ✅ Answer processed');
    elements.callStatus.textContent = 'Звонок активен';
  });

  signalingManager.on('iceCandidate', async (candidate, userId) => {
    console.log('[Main] 📥 Received ICE candidate from:', userId);
    await webrtcManager.addIceCandidate(candidate);
  });

  signalingManager.on('message', (message, userId, timestamp) => {
    addMessageToChat(message, 'received', timestamp);
    
    if (elements.chatContainer.classList.contains('hidden')) {
      unreadMessages++;
      updateUnreadCount();
    }
  });
}

function setupWebRTCCallbacks() {
  webrtcManager.onRemoteStream((stream) => {
    console.log('[Main] 📥 Remote stream received, attaching to audio element');
    console.log('[Main] 📥 Stream details:', stream);
    console.log('[Main] 📥 Stream tracks:', stream.getTracks());
    
    elements.remoteAudio.srcObject = stream;
    
    console.log('[Main] 🔊 Remote audio element:', {
      srcObject: elements.remoteAudio.srcObject,
      paused: elements.remoteAudio.paused,
      muted: elements.remoteAudio.muted,
      volume: elements.remoteAudio.volume,
      readyState: elements.remoteAudio.readyState
    });
    
    elements.remoteAudio.play().then(() => {
      console.log('[Main] ✅ Remote audio playing');
    }).catch(err => {
      console.error('[Main] ❌ Error playing remote audio:', err);
    });
    
    elements.callStatus.textContent = 'Звонок активен';
    elements.userAvatar.textContent = '🔊';
    showNotification('Аудио поток получен', 'success');
  });

  webrtcManager.onConnectionStateChange((state) => {
    console.log('WebRTC connection state:', state);
    
    switch (state) {
      case 'connected':
        elements.callStatus.textContent = 'Звонок активен';
        updateConnectionStatus('connected', 'Соединение установлено');
        break;
      case 'connecting':
        elements.callStatus.textContent = 'Соединение...';
        updateConnectionStatus('connecting', 'Соединение...');
        break;
      case 'disconnected':
        elements.callStatus.textContent = 'Соединение потеряно';
        updateConnectionStatus('disconnected', 'Отключено');
        break;
      case 'failed':
        elements.callStatus.textContent = 'Ошибка соединения';
        updateConnectionStatus('disconnected', 'Ошибка');
        showNotification('Не удалось установить соединение', 'error');
        break;
      case 'closed':
        elements.callStatus.textContent = 'Звонок завершен';
        break;
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

async function initiateCall(targetUserId) {
  try {
    console.log('[Main] 📞 Initiating call to:', targetUserId);
    
    console.log('[Main] 🔗 Creating peer connection...');
    webrtcManager.createPeerConnection((candidate) => {
      console.log('[Main] 📤 Sending ICE candidate to:', targetUserId);
      signalingManager.sendIceCandidate(candidate, targetUserId);
    });
    
    console.log('[Main] 📝 Creating offer...');
    const offer = await webrtcManager.createOffer();
    
    console.log('[Main] 📤 Sending offer to:', targetUserId);
    signalingManager.sendOffer(offer, targetUserId);
    
    elements.callStatus.textContent = 'Установка соединения...';
  } catch (error) {
    console.error('[Main] ❌ Error initiating call:', error);
    showNotification('Ошибка при установке соединения', 'error');
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
  currentRemoteUserId = null;
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
