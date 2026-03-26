class WebRTCManager {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.iceServers = null;
    this.isMuted = false;
    this.onRemoteStreamCallback = null;
    this.onConnectionStateChangeCallback = null;
  }

  async initialize(iceServers) {
    this.iceServers = iceServers;
    
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      console.log('Local stream obtained:', this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Не удалось получить доступ к микрофону. Проверьте разрешения.');
    }
  }

  createPeerConnection(onIceCandidateCallback) {
    const configuration = {
      iceServers: this.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate generated:', event.candidate);
        if (onIceCandidateCallback) {
          onIceCandidateCallback(event.candidate);
        }
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('Remote track received:', event.streams[0]);
      this.remoteStream = event.streams[0];
      
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(this.peerConnection.connectionState);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
    };

    console.log('Peer connection created');
    return this.peerConnection;
  }

  async createOffer() {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      await this.peerConnection.setLocalDescription(offer);
      console.log('Offer created:', offer);
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  async createAnswer() {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('Answer created:', answer);
      return answer;
    } catch (error) {
      console.error('Error creating answer:', error);
      throw error;
    }
  }

  async handleOffer(offer) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Remote offer set');
    } catch (error) {
      console.error('Error setting remote offer:', error);
      throw error;
    }
  }

  async handleAnswer(answer) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Remote answer set');
    } catch (error) {
      console.error('Error setting remote answer:', error);
      throw error;
    }
  }

  async addIceCandidate(candidate) {
    if (!this.peerConnection) {
      console.warn('Peer connection not initialized, ignoring ICE candidate');
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('ICE candidate added');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  toggleMute() {
    if (!this.localStream) {
      return false;
    }

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.isMuted = !audioTrack.enabled;
      console.log('Microphone muted:', this.isMuted);
      return this.isMuted;
    }

    return false;
  }

  getMuteState() {
    return this.isMuted;
  }

  onRemoteStream(callback) {
    this.onRemoteStreamCallback = callback;
  }

  onConnectionStateChange(callback) {
    this.onConnectionStateChangeCallback = callback;
  }

  close() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('Peer connection closed');
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
      console.log('Local stream stopped');
    }

    this.remoteStream = null;
    this.isMuted = false;
  }

  getConnectionState() {
    return this.peerConnection ? this.peerConnection.connectionState : 'closed';
  }
}
