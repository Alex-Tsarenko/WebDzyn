class SignalingManager {
  constructor(serverUrl) {
    this.socket = null;
    this.serverUrl = serverUrl || window.location.origin;
    this.roomId = null;
    this.isConnected = false;
    this.callbacks = {
      onConnected: null,
      onDisconnected: null,
      onRoomCreated: null,
      onRoomJoined: null,
      onUserJoined: null,
      onUserLeft: null,
      onOffer: null,
      onAnswer: null,
      onIceCandidate: null,
      onMessage: null,
      onError: null
    };
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
          console.log('Connected to signaling server, Socket ID:', this.socket.id);
          this.isConnected = true;
          
          if (this.callbacks.onConnected) {
            this.callbacks.onConnected(this.socket.id);
          }
          
          resolve(this.socket.id);
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from signaling server');
          this.isConnected = false;
          
          if (this.callbacks.onDisconnected) {
            this.callbacks.onDisconnected();
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });

        this.socket.on('user-joined', (data) => {
          console.log('User joined:', data.userId);
          if (this.callbacks.onUserJoined) {
            this.callbacks.onUserJoined(data.userId);
          }
        });

        this.socket.on('user-left', (data) => {
          console.log('User left:', data.userId);
          if (this.callbacks.onUserLeft) {
            this.callbacks.onUserLeft(data.userId);
          }
        });

        this.socket.on('offer', (data) => {
          console.log('Offer received from:', data.userId);
          if (this.callbacks.onOffer) {
            this.callbacks.onOffer(data.offer, data.userId);
          }
        });

        this.socket.on('answer', (data) => {
          console.log('Answer received from:', data.userId);
          if (this.callbacks.onAnswer) {
            this.callbacks.onAnswer(data.answer, data.userId);
          }
        });

        this.socket.on('ice-candidate', (data) => {
          console.log('ICE candidate received from:', data.userId);
          if (this.callbacks.onIceCandidate) {
            this.callbacks.onIceCandidate(data.candidate, data.userId);
          }
        });

        this.socket.on('message', (data) => {
          console.log('Message received:', data);
          if (this.callbacks.onMessage) {
            this.callbacks.onMessage(data.message, data.userId, data.timestamp);
          }
        });

      } catch (error) {
        console.error('Error creating socket connection:', error);
        reject(error);
      }
    });
  }

  createRoom() {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Not connected to signaling server'));
        return;
      }

      this.socket.emit('create-room', (response) => {
        if (response.success) {
          this.roomId = response.roomId;
          console.log('Room created:', this.roomId);
          
          if (this.callbacks.onRoomCreated) {
            this.callbacks.onRoomCreated(response.roomId, response.iceServers);
          }
          
          resolve(response);
        } else {
          console.error('Failed to create room:', response.error);
          reject(new Error(response.error || 'Failed to create room'));
        }
      });
    });
  }

  joinRoom(roomId) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Not connected to signaling server'));
        return;
      }

      this.socket.emit('join-room', roomId, (response) => {
        if (response.success) {
          this.roomId = roomId;
          console.log('Joined room:', roomId);
          
          if (this.callbacks.onRoomJoined) {
            this.callbacks.onRoomJoined(roomId, response.users, response.iceServers);
          }
          
          resolve(response);
        } else {
          console.error('Failed to join room:', response.error);
          reject(new Error(response.error || 'Failed to join room'));
        }
      });
    });
  }

  sendOffer(offer, targetUserId = null) {
    if (!this.socket || !this.roomId) {
      console.error('Cannot send offer: not in a room');
      return;
    }

    this.socket.emit('offer', {
      roomId: this.roomId,
      offer: offer,
      targetUserId: targetUserId
    });

    console.log('Offer sent to:', targetUserId || 'room');
  }

  sendAnswer(answer, targetUserId = null) {
    if (!this.socket || !this.roomId) {
      console.error('Cannot send answer: not in a room');
      return;
    }

    this.socket.emit('answer', {
      roomId: this.roomId,
      answer: answer,
      targetUserId: targetUserId
    });

    console.log('Answer sent to:', targetUserId || 'room');
  }

  sendIceCandidate(candidate, targetUserId = null) {
    if (!this.socket || !this.roomId) {
      console.error('Cannot send ICE candidate: not in a room');
      return;
    }

    this.socket.emit('ice-candidate', {
      roomId: this.roomId,
      candidate: candidate,
      targetUserId: targetUserId
    });

    console.log('ICE candidate sent to:', targetUserId || 'room');
  }

  sendMessage(message) {
    if (!this.socket || !this.roomId) {
      console.error('Cannot send message: not in a room');
      return;
    }

    this.socket.emit('message', {
      roomId: this.roomId,
      message: message
    });

    console.log('Message sent:', message);
  }

  leaveRoom() {
    if (this.socket && this.roomId) {
      this.socket.emit('leave-room');
      console.log('Left room:', this.roomId);
      this.roomId = null;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.roomId = null;
      console.log('Disconnected from signaling server');
    }
  }

  on(event, callback) {
    if (this.callbacks.hasOwnProperty('on' + event.charAt(0).toUpperCase() + event.slice(1))) {
      this.callbacks['on' + event.charAt(0).toUpperCase() + event.slice(1)] = callback;
    }
  }

  getRoomId() {
    return this.roomId;
  }

  isInRoom() {
    return this.roomId !== null;
  }

  getConnectionState() {
    return this.isConnected;
  }
}
