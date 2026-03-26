# Отладка проблем с аудио

## Исправленные проблемы

### ✅ Локальный аудио поток не подключался к элементу
**Проблема**: Локальный поток не присваивался элементу `<audio id="local-audio">`  
**Исправление**: Добавлено `elements.localAudio.srcObject = localStream;` после инициализации

### ✅ Отсутствие обработки ошибок при получении offer
**Проблема**: Ошибки при обработке offer не отлавливались  
**Исправление**: Добавлен try-catch блок в обработчике offer

## Проверка работы аудио

### 1. Откройте консоль браузера (F12)

При успешном подключении вы должны видеть:

```javascript
// При создании/присоединении к комнате
Local stream obtained: MediaStream {...}

// При установке соединения
Peer connection created
Offer created: RTCSessionDescription {...}
ICE candidate generated: RTCIceCandidate {...}

// При получении удаленного потока
Remote track received: MediaStream {...}
Connection state: connected
```

### 2. Проверьте аудио элементы

Вставьте в консоль:

```javascript
// Проверить локальный поток
const localAudio = document.getElementById('local-audio');
console.log('Local audio element:', localAudio);
console.log('Local srcObject:', localAudio.srcObject);
console.log('Local tracks:', localAudio.srcObject?.getAudioTracks());

// Проверить удаленный поток
const remoteAudio = document.getElementById('remote-audio');
console.log('Remote audio element:', remoteAudio);
console.log('Remote srcObject:', remoteAudio.srcObject);
console.log('Remote tracks:', remoteAudio.srcObject?.getAudioTracks());

// Проверить состояние треков
if (localAudio.srcObject) {
  const track = localAudio.srcObject.getAudioTracks()[0];
  console.log('Local track enabled:', track.enabled);
  console.log('Local track muted:', track.muted);
  console.log('Local track readyState:', track.readyState);
}

if (remoteAudio.srcObject) {
  const track = remoteAudio.srcObject.getAudioTracks()[0];
  console.log('Remote track enabled:', track.enabled);
  console.log('Remote track muted:', track.muted);
  console.log('Remote track readyState:', track.readyState);
}
```

### 3. Проверьте WebRTC соединение

```javascript
// Проверить состояние peer connection
console.log('Connection state:', webrtcManager.peerConnection?.connectionState);
console.log('ICE connection state:', webrtcManager.peerConnection?.iceConnectionState);
console.log('Signaling state:', webrtcManager.peerConnection?.signalingState);

// Проверить отправителей и получателей
console.log('Senders:', webrtcManager.peerConnection?.getSenders());
console.log('Receivers:', webrtcManager.peerConnection?.getReceivers());

// Проверить статистику
webrtcManager.peerConnection?.getStats().then(stats => {
  stats.forEach(report => {
    if (report.type === 'inbound-rtp' && report.kind === 'audio') {
      console.log('Inbound audio stats:', report);
    }
    if (report.type === 'outbound-rtp' && report.kind === 'audio') {
      console.log('Outbound audio stats:', report);
    }
  });
});
```

## Типичные проблемы и решения

### Проблема 1: Не слышно собеседника

**Диагностика:**
```javascript
const remoteAudio = document.getElementById('remote-audio');
console.log('Remote stream exists:', !!remoteAudio.srcObject);
console.log('Remote audio tracks:', remoteAudio.srcObject?.getAudioTracks().length);
```

**Возможные причины:**
1. **Удаленный поток не получен**
   - Проверьте консоль на наличие "Remote track received"
   - Убедитесь, что WebRTC соединение в состоянии "connected"

2. **Громкость выключена**
   - Проверьте громкость в системе
   - Проверьте: `remoteAudio.volume` (должно быть 1.0)
   - Проверьте: `remoteAudio.muted` (должно быть false)

3. **Autoplay заблокирован браузером**
   - Попробуйте кликнуть на странице
   - Проверьте: `remoteAudio.play()` в консоли

**Решение:**
```javascript
// Принудительно воспроизвести
const remoteAudio = document.getElementById('remote-audio');
remoteAudio.volume = 1.0;
remoteAudio.muted = false;
remoteAudio.play().then(() => {
  console.log('✅ Audio playing');
}).catch(err => {
  console.error('❌ Audio play failed:', err);
});
```

### Проблема 2: Собеседник не слышит меня

**Диагностика:**
```javascript
const localStream = webrtcManager.localStream;
console.log('Local stream exists:', !!localStream);
const track = localStream?.getAudioTracks()[0];
console.log('Local track enabled:', track?.enabled);
console.log('Local track muted:', track?.muted);
```

**Возможные причины:**
1. **Микрофон выключен**
   - Проверьте кнопку микрофона (не должна быть красной)
   - Проверьте: `webrtcManager.isMuted` (должно быть false)

2. **Нет разрешения на микрофон**
   - Проверьте иконку в адресной строке браузера
   - Перезагрузите страницу и дайте разрешение

3. **Микрофон занят другим приложением**
   - Закройте Zoom, Skype, Discord и т.д.
   - Проверьте системные настройки микрофона

**Решение:**
```javascript
// Включить микрофон
if (webrtcManager.isMuted) {
  webrtcManager.toggleMute();
}

// Проверить трек
const track = webrtcManager.localStream?.getAudioTracks()[0];
if (track) {
  track.enabled = true;
  console.log('✅ Microphone enabled');
}
```

### Проблема 3: Эхо в звонке

**Причина**: Оба окна открыты на одном компьютере без наушников

**Решение:**
1. Используйте наушники
2. Тестируйте на разных устройствах
3. Выключите микрофон в одном из окон

### Проблема 4: Задержка звука

**Диагностика:**
```javascript
webrtcManager.peerConnection?.getStats().then(stats => {
  stats.forEach(report => {
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      console.log('Round trip time:', report.currentRoundTripTime * 1000, 'ms');
    }
  });
});
```

**Нормальные значения:**
- RTT < 100ms - отлично
- RTT 100-300ms - приемлемо
- RTT > 300ms - плохо

**Решение:**
- Проверьте качество интернет-соединения
- Используйте TURN сервер для лучшей маршрутизации

### Проблема 5: Плохое качество звука

**Диагностика:**
```javascript
webrtcManager.peerConnection?.getStats().then(stats => {
  stats.forEach(report => {
    if (report.type === 'inbound-rtp' && report.kind === 'audio') {
      console.log('Packets lost:', report.packetsLost);
      console.log('Jitter:', report.jitter);
    }
  });
});
```

**Решение:**
1. Проверьте скорость интернета
2. Закройте другие приложения, использующие сеть
3. Подключитесь к более стабильной сети

### Проблема 6: Нет доступа к микрофону

**Ошибка в консоли:**
```
NotAllowedError: Permission denied
```

**Решение:**
1. **Chrome/Edge:**
   - Кликните на иконку замка в адресной строке
   - Разрешите доступ к микрофону
   - Перезагрузите страницу

2. **Firefox:**
   - Кликните на иконку микрофона в адресной строке
   - Выберите "Разрешить"
   - Перезагрузите страницу

3. **Safari:**
   - Safari → Настройки → Веб-сайты → Микрофон
   - Разрешите для localhost

### Проблема 7: WebRTC соединение не устанавливается

**Диагностика:**
```javascript
console.log('Connection state:', webrtcManager.peerConnection?.connectionState);
console.log('ICE state:', webrtcManager.peerConnection?.iceConnectionState);
```

**Если состояние "failed" или "disconnected":**

1. **Проверьте STUN серверы:**
```javascript
console.log('ICE servers:', webrtcManager.iceServers);
```

2. **Проверьте ICE candidates:**
```javascript
webrtcManager.peerConnection?.addEventListener('icecandidate', (event) => {
  console.log('ICE candidate:', event.candidate);
});
```

3. **Используйте TURN сервер** (для сетей с строгим NAT/firewall)

## Тестовый скрипт для полной диагностики

Вставьте в консоль браузера:

```javascript
async function diagnoseAudio() {
  console.log('🔍 Диагностика аудио...\n');
  
  // 1. Проверка API
  console.log('1️⃣ Проверка WebRTC API');
  console.log('getUserMedia:', !!navigator.mediaDevices?.getUserMedia);
  console.log('RTCPeerConnection:', !!window.RTCPeerConnection);
  
  // 2. Проверка элементов
  console.log('\n2️⃣ Проверка HTML элементов');
  const localAudio = document.getElementById('local-audio');
  const remoteAudio = document.getElementById('remote-audio');
  console.log('Local audio element:', !!localAudio);
  console.log('Remote audio element:', !!remoteAudio);
  
  // 3. Проверка потоков
  console.log('\n3️⃣ Проверка медиа потоков');
  console.log('Local stream:', !!localAudio?.srcObject);
  console.log('Remote stream:', !!remoteAudio?.srcObject);
  
  if (localAudio?.srcObject) {
    const tracks = localAudio.srcObject.getAudioTracks();
    console.log('Local audio tracks:', tracks.length);
    if (tracks[0]) {
      console.log('  - Enabled:', tracks[0].enabled);
      console.log('  - Muted:', tracks[0].muted);
      console.log('  - State:', tracks[0].readyState);
    }
  }
  
  if (remoteAudio?.srcObject) {
    const tracks = remoteAudio.srcObject.getAudioTracks();
    console.log('Remote audio tracks:', tracks.length);
    if (tracks[0]) {
      console.log('  - Enabled:', tracks[0].enabled);
      console.log('  - Muted:', tracks[0].muted);
      console.log('  - State:', tracks[0].readyState);
    }
  }
  
  // 4. Проверка WebRTC
  console.log('\n4️⃣ Проверка WebRTC соединения');
  if (webrtcManager?.peerConnection) {
    console.log('Connection state:', webrtcManager.peerConnection.connectionState);
    console.log('ICE state:', webrtcManager.peerConnection.iceConnectionState);
    console.log('Signaling state:', webrtcManager.peerConnection.signalingState);
    
    const senders = webrtcManager.peerConnection.getSenders();
    const receivers = webrtcManager.peerConnection.getReceivers();
    console.log('Senders:', senders.length);
    console.log('Receivers:', receivers.length);
  } else {
    console.log('❌ Peer connection не создан');
  }
  
  // 5. Проверка разрешений
  console.log('\n5️⃣ Проверка разрешений');
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    console.log('Microphone permission:', result.state);
  } catch (e) {
    console.log('Не удалось проверить разрешения');
  }
  
  console.log('\n✅ Диагностика завершена');
}

diagnoseAudio();
```

## Рекомендации для production

1. **Используйте HTTPS** - обязательно для WebRTC
2. **Настройте TURN сервер** - для работы за NAT/firewall
3. **Добавьте обработку ошибок** - для всех WebRTC операций
4. **Тестируйте на разных устройствах** - desktop, mobile, разные браузеры
5. **Мониторьте качество** - используйте getStats() для отслеживания
6. **Добавьте fallback** - на случай проблем с WebRTC

## Полезные ссылки

- [WebRTC Troubleshooting](https://webrtc.github.io/samples/)
- [Chrome WebRTC Internals](chrome://webrtc-internals/)
- [Firefox about:webrtc](about:webrtc)
