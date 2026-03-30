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
    console.log('[WebRTC] 🎬 Initializing WebRTC with ICE servers:', iceServers);
    
    try {
      console.log('[WebRTC] 🎤 Requesting microphone access...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      console.log('[WebRTC] ✅ Local stream obtained:', this.localStream);
      console.log('[WebRTC] 🎵 Audio tracks:', this.localStream.getAudioTracks());
      this.localStream.getAudioTracks().forEach((track, index) => {
        console.log(`[WebRTC] 🎵 Audio track ${index}:`, {
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings()
        });
      });
      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] ❌ Error accessing media devices:', error);
      console.error('[WebRTC] ❌ Error name:', error.name);
      console.error('[WebRTC] ❌ Error message:', error.message);
      throw new Error('Не удалось получить доступ к микрофону. Проверьте разрешения.');
    }
  }

  createPeerConnection(onIceCandidateCallback) {
    const configuration = {
      iceServers: this.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };

    console.log('[WebRTC] 🔗 Creating peer connection with config:', configuration);
    this.peerConnection = new RTCPeerConnection(configuration);

    if (this.localStream) {
      console.log('[WebRTC] 📤 Adding local tracks to peer connection...');
      this.localStream.getTracks().forEach((track, index) => {
        const sender = this.peerConnection.addTrack(track, this.localStream);
        console.log(`[WebRTC] 📤 Track ${index} added:`, {
          kind: track.kind,
          id: track.id,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          sender: sender
        });
      });
    } else {
      console.warn('[WebRTC] ⚠️ No local stream available when creating peer connection!');
    }

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] 🧊 ICE candidate generated:', {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port
        });
        if (onIceCandidateCallback) {
          onIceCandidateCallback(event.candidate);
        }
      } else {
        console.log('[WebRTC] 🧊 ICE candidate gathering complete (null candidate)');
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] 📥 Remote track received!');
      console.log('[WebRTC] 📥 Track details:', {
        kind: event.track.kind,
        id: event.track.id,
        label: event.track.label,
        enabled: event.track.enabled,
        muted: event.track.muted,
        readyState: event.track.readyState
      });
      console.log('[WebRTC] 📥 Streams:', event.streams);
      
      event.track.onunmute = () => {
        console.log('[WebRTC] 🔊 Remote track UNMUTED - media is flowing!', {
          kind: event.track.kind,
          id: event.track.id,
          muted: event.track.muted
        });
      };
      
      event.track.onmute = () => {
        console.log('[WebRTC] 🔇 Remote track MUTED - media stopped!', {
          kind: event.track.kind,
          id: event.track.id,
          muted: event.track.muted
        });
      };
      
      this.remoteStream = event.streams[0];
      
      if (this.remoteStream) {
        console.log('[WebRTC] 📥 Remote stream tracks:', this.remoteStream.getTracks());
        this.remoteStream.getTracks().forEach((track, index) => {
          console.log(`[WebRTC] 📥 Remote track ${index}:`, {
            kind: track.kind,
            id: track.id,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState
          });
        });
      }
      
      if (this.onRemoteStreamCallback) {
        console.log('[WebRTC] 📥 Calling remote stream callback...');
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTC] 🔄 Connection state changed:', this.peerConnection.connectionState);
      
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(this.peerConnection.connectionState);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] 🧊 ICE connection state:', this.peerConnection.iceConnectionState);
      console.log('[WebRTC] 🧊 ICE gathering state:', this.peerConnection.iceGatheringState);
      
      if (this.peerConnection.iceConnectionState === 'connected' || 
          this.peerConnection.iceConnectionState === 'completed') {
        this._logConnectionStats();
      }
    };

    this.peerConnection.onsignalingstatechange = () => {
      console.log('[WebRTC] 📡 Signaling state:', this.peerConnection.signalingState);
    };

    this.peerConnection.onnegotiationneeded = () => {
      console.log('[WebRTC] 🤝 Negotiation needed');
    };

    console.log('[WebRTC] ✅ Peer connection created successfully');
    return this.peerConnection;
  }

  async createOffer() {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      console.log('[WebRTC] 📝 Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      console.log('[WebRTC] 📝 Offer created:', {
        type: offer.type,
        sdp: offer.sdp.substring(0, 200) + '...'
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('[WebRTC] 📝 Local description set (offer)');
      console.log('[WebRTC] 📝 Current signaling state:', this.peerConnection.signalingState);
      
      return offer;
    } catch (error) {
      console.error('[WebRTC] ❌ Error creating offer:', error);
      throw error;
    }
  }

  async createAnswer() {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      console.log('[WebRTC] 📝 Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      
      console.log('[WebRTC] 📝 Answer created:', {
        type: answer.type,
        sdp: answer.sdp.substring(0, 200) + '...'
      });
      
      await this.peerConnection.setLocalDescription(answer);
      console.log('[WebRTC] 📝 Local description set (answer)');
      console.log('[WebRTC] 📝 Current signaling state:', this.peerConnection.signalingState);
      
      return answer;
    } catch (error) {
      console.error('[WebRTC] ❌ Error creating answer:', error);
      throw error;
    }
  }

  async handleOffer(offer) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      console.log('[WebRTC] 📥 Handling remote offer:', {
        type: offer.type,
        sdp: offer.sdp ? offer.sdp.substring(0, 200) + '...' : 'no sdp'
      });
      
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[WebRTC] ✅ Remote offer set successfully');
      console.log('[WebRTC] 📡 Current signaling state:', this.peerConnection.signalingState);
    } catch (error) {
      console.error('[WebRTC] ❌ Error setting remote offer:', error);
      throw error;
    }
  }

  async handleAnswer(answer) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      console.log('[WebRTC] 📥 Handling remote answer:', {
        type: answer.type,
        sdp: answer.sdp ? answer.sdp.substring(0, 200) + '...' : 'no sdp'
      });
      
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTC] ✅ Remote answer set successfully');
      console.log('[WebRTC] 📡 Current signaling state:', this.peerConnection.signalingState);
    } catch (error) {
      console.error('[WebRTC] ❌ Error setting remote answer:', error);
      throw error;
    }
  }

  async addIceCandidate(candidate) {
    if (!this.peerConnection) {
      console.warn('[WebRTC] ⚠️ Peer connection not initialized, ignoring ICE candidate');
      return;
    }

    try {
      console.log('[WebRTC] 🧊 Adding ICE candidate:', {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex
      });
      
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC] ✅ ICE candidate added successfully');
    } catch (error) {
      console.error('[WebRTC] ❌ Error adding ICE candidate:', error);
    }
  }

  toggleMute() {
    if (!this.localStream) {
      console.warn('[WebRTC] ⚠️ No local stream to mute');
      return false;
    }

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.isMuted = !audioTrack.enabled;
      console.log('[WebRTC] 🎤 Microphone muted:', this.isMuted, 'Track enabled:', audioTrack.enabled);
      return this.isMuted;
    }

    console.warn('[WebRTC] ⚠️ No audio track found to mute');
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
    console.log('[WebRTC] 🔚 Closing WebRTC connection...');
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('[WebRTC] ✅ Peer connection closed');
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log('[WebRTC] 🛑 Stopping track:', track.kind, track.id);
        track.stop();
      });
      this.localStream = null;
      console.log('[WebRTC] ✅ Local stream stopped');
    }

    this.remoteStream = null;
    this.isMuted = false;
    console.log('[WebRTC] ✅ WebRTC cleanup complete');
  }

  async _logConnectionStats() {
    if (!this.peerConnection) return;
    
    try {
      const stats = await this.peerConnection.getStats();
      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          console.log('[WebRTC] 📊 Active candidate pair:', {
            localCandidateId: report.localCandidateId,
            remoteCandidateId: report.remoteCandidateId,
            bytesSent: report.bytesSent,
            bytesReceived: report.bytesReceived,
            currentRoundTripTime: report.currentRoundTripTime
          });
        }
        if (report.type === 'local-candidate') {
          console.log('[WebRTC] 📊 Local candidate:', {
            id: report.id,
            type: report.candidateType,
            protocol: report.protocol,
            address: report.address,
            port: report.port
          });
        }
        if (report.type === 'remote-candidate') {
          console.log('[WebRTC] 📊 Remote candidate:', {
            id: report.id,
            type: report.candidateType,
            protocol: report.protocol,
            address: report.address,
            port: report.port
          });
        }
      });
      
      if (this.remoteStream) {
        const audioTracks = this.remoteStream.getAudioTracks();
        console.log('[WebRTC] 📊 Remote audio tracks status:', audioTracks.map(t => ({
          id: t.id,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState
        })));
      }
    } catch (e) {
      console.error('[WebRTC] ❌ Error getting stats:', e);
    }
  }

  getConnectionState() {
    return this.peerConnection ? this.peerConnection.connectionState : 'closed';
  }
}
