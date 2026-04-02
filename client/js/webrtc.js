class WebRTCManager {
  constructor() {
    this.peerConnections = new Map();
    this.localStream = null;
    this.iceServers = null;
    this.isMuted = false;
    this._pendingCandidates = new Map();
    this._initPromise = null;

    this.onIceCandidate = null;
    this.onRemoteStream = null;
    this.onRemoteStreamRemoved = null;
    this.onPeerStateChange = null;
  }

  async initialize(iceServers) {
    this.iceServers = iceServers;
    console.log('[WebRTC] 🎬 Initializing with ICE servers:', iceServers);
    this._initPromise = this._doInit();
    return this._initPromise;
  }

  async _doInit() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      console.log('[WebRTC] ✅ Local stream obtained, tracks:', this.localStream.getAudioTracks().length);
      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] ❌ Microphone error:', error);
      throw new Error('Не удалось получить доступ к микрофону. Проверьте разрешения.');
    }
  }

  async _ensureInit() {
    if (this._initPromise) await this._initPromise;
  }

  _createPC(userId) {
    const config = {
      iceServers: this.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    console.log(`[WebRTC] 🔗 Creating peer connection for [${userId}]`);
    const pc = new RTCPeerConnection(config);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
      console.log(`[WebRTC] 📤 Local tracks added for [${userId}]`);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate, userId);
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] 📥 Remote track from [${userId}]`, event.track.kind);
      if (this.onRemoteStream) {
        this.onRemoteStream(event.streams[0], userId);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] 🔄 [${userId}] connection: ${pc.connectionState}`);
      if (this.onPeerStateChange) {
        this.onPeerStateChange(pc.connectionState, userId);
      }
      if (pc.connectionState === 'failed') {
        console.warn(`[WebRTC] ⚠️ Connection failed for [${userId}]`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] 🧊 [${userId}] ICE: ${pc.iceConnectionState}`);
    };

    this.peerConnections.set(userId, pc);
    return pc;
  }

  async createOffer(userId) {
    await this._ensureInit();
    const pc = this._createPC(userId);

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });
    await pc.setLocalDescription(offer);
    console.log(`[WebRTC] 📝 Offer created for [${userId}]`);
    return offer;
  }

  async handleOffer(offer, userId) {
    await this._ensureInit();

    let pc = this.peerConnections.get(userId);
    if (!pc) {
      pc = this._createPC(userId);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this._flushCandidates(userId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log(`[WebRTC] 📝 Answer created for [${userId}]`);
    return answer;
  }

  async handleAnswer(answer, userId) {
    const pc = this.peerConnections.get(userId);
    if (!pc) {
      console.warn(`[WebRTC] ⚠️ No PC for answer from [${userId}]`);
      return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    console.log(`[WebRTC] ✅ Answer set for [${userId}]`);
    await this._flushCandidates(userId);
  }

  async addIceCandidate(candidate, userId) {
    const pc = this.peerConnections.get(userId);

    if (!pc || !pc.remoteDescription) {
      if (!this._pendingCandidates.has(userId)) {
        this._pendingCandidates.set(userId, []);
      }
      this._pendingCandidates.get(userId).push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error(`[WebRTC] ❌ ICE error [${userId}]:`, e);
    }
  }

  async _flushCandidates(userId) {
    const pending = this._pendingCandidates.get(userId);
    if (!pending || pending.length === 0) return;

    const pc = this.peerConnections.get(userId);
    if (!pc || !pc.remoteDescription) return;

    console.log(`[WebRTC] 🧊 Flushing ${pending.length} candidates for [${userId}]`);
    for (const c of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.error('[WebRTC] ❌ Flush ICE error:', e);
      }
    }
    this._pendingCandidates.delete(userId);
  }

  removePeer(userId) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
    this._pendingCandidates.delete(userId);

    if (this.onRemoteStreamRemoved) {
      this.onRemoteStreamRemoved(userId);
    }
    console.log(`[WebRTC] 🗑️ Peer removed: [${userId}]`);
  }

  toggleMute() {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      this.isMuted = !track.enabled;
      console.log('[WebRTC] 🎤 Mute:', this.isMuted);
      return this.isMuted;
    }
    return false;
  }

  getMuteState() {
    return this.isMuted;
  }

  close() {
    console.log('[WebRTC] 🔚 Closing all connections...');
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this._pendingCandidates.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

    this.isMuted = false;
    this._initPromise = null;
    console.log('[WebRTC] ✅ Cleanup complete');
  }
}
