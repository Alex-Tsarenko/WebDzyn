class AudioRelayManager {
  constructor() {
    this.captureContext = null;
    this.playbackContext = null;
    this.processor = null;
    this.source = null;
    this.sendCallback = null;
    this.isCapturing = false;
    this.isMuted = false;
    this.nextPlayTime = 0;
    this.localStream = null;
    this.targetSampleRate = 16000;
    this.bufferSize = 4096;
  }

  async initialize() {
    console.log('[AudioRelay] 🎤 Requesting microphone access...');
    
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      
      console.log('[AudioRelay] ✅ Microphone access granted', {
        tracks: this.localStream.getAudioTracks().map(t => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled,
          muted: t.muted
        }))
      });
      
      return this.localStream;
    } catch (error) {
      console.error('[AudioRelay] ❌ Microphone access denied:', error);
      throw new Error('Не удалось получить доступ к микрофону: ' + error.message);
    }
  }

  startCapture(sendCallback) {
    if (!this.localStream) {
      console.error('[AudioRelay] ❌ No local stream - call initialize() first');
      return;
    }
    
    this.sendCallback = sendCallback;
    this.captureContext = new AudioContext();
    const actualSampleRate = this.captureContext.sampleRate;
    const ratio = actualSampleRate / this.targetSampleRate;
    
    this.source = this.captureContext.createMediaStreamSource(this.localStream);
    this.processor = this.captureContext.createScriptProcessor(this.bufferSize, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      if (!this.isCapturing || this.isMuted) return;
      
      const input = e.inputBuffer.getChannelData(0);
      const downsampled = this._downsample(input, ratio);
      const int16 = this._float32ToInt16(downsampled);
      
      if (this.sendCallback) {
        this.sendCallback(int16.buffer);
      }
    };
    
    this.source.connect(this.processor);
    this.processor.connect(this.captureContext.destination);
    this.isCapturing = true;
    
    console.log('[AudioRelay] 🎤 Capture started', {
      sampleRate: actualSampleRate,
      targetRate: this.targetSampleRate,
      downsampleRatio: ratio,
      bufferSize: this.bufferSize,
      chunkDuration: (this.bufferSize / actualSampleRate * 1000).toFixed(1) + 'ms'
    });
  }

  playAudio(arrayBuffer) {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext();
      this.nextPlayTime = 0;
      console.log('[AudioRelay] 🔊 Playback context created', {
        sampleRate: this.playbackContext.sampleRate
      });
    }
    
    if (this.playbackContext.state === 'suspended') {
      this.playbackContext.resume();
    }
    
    const int16 = new Int16Array(arrayBuffer);
    const float32 = this._int16ToFloat32(int16);
    
    const buffer = this.playbackContext.createBuffer(1, float32.length, this.targetSampleRate);
    buffer.getChannelData(0).set(float32);
    
    const source = this.playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playbackContext.destination);
    
    const now = this.playbackContext.currentTime;
    if (this.nextPlayTime < now) {
      this.nextPlayTime = now + 0.05;
    }
    
    source.start(this.nextPlayTime);
    this.nextPlayTime += buffer.duration;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
    }
    
    console.log('[AudioRelay] 🎤 Mute toggled:', this.isMuted);
    return this.isMuted;
  }

  getMuteState() {
    return this.isMuted;
  }

  stop() {
    this.isCapturing = false;
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.captureContext) {
      this.captureContext.close().catch(() => {});
      this.captureContext = null;
    }
    if (this.playbackContext) {
      this.playbackContext.close().catch(() => {});
      this.playbackContext = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log('[AudioRelay] 🛑 Stopping track:', track.kind, track.label);
        track.stop();
      });
      this.localStream = null;
    }
    
    this.nextPlayTime = 0;
    this.isMuted = false;
    this.sendCallback = null;
    console.log('[AudioRelay] 🛑 Audio relay stopped');
  }

  _downsample(buffer, ratio) {
    if (ratio <= 1) return buffer;
    const newLength = Math.floor(buffer.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      result[i] = buffer[Math.floor(i * ratio)];
    }
    return result;
  }

  _float32ToInt16(float32) {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }

  _int16ToFloat32(int16) {
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
    }
    return float32;
  }
}
