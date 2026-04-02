# Отладка проблем с аудио

## Архитектура аудио

Приложение использует **Audio Relay** через Socket.IO для передачи звука:
- Захват микрофона через `getUserMedia` → `AudioContext` (48kHz)
- Конвертация в `Int16Array` → отправка через `socket.volatile.emit('audio-data')`
- Сервер получает и broadcast'ит в комнату → клиенты воспроизводят через `AudioContext`

## Проверка работы аудио

### 1. Откройте консоль браузера (F12)

При успешном подключении вы должны видеть:

```
[AudioRelay] ✅ Microphone access granted
[AudioRelay] 🎤 Capture started { sampleRate: 48000, ... }
[AudioRelay] 🔊 Playback context created { sampleRate: 48000 }
```

### 2. Проверьте аудио элементы

```javascript
const localAudio = document.getElementById('local-audio');
console.log('Local srcObject:', localAudio.srcObject);
console.log('Local tracks:', localAudio.srcObject?.getAudioTracks());
```

### 3. Проверьте Audio Relay

```javascript
console.log('Is capturing:', audioRelay.isCapturing);
console.log('Is muted:', audioRelay.isMuted);
console.log('Sample rate:', audioRelay.targetSampleRate);
console.log('Buffer size:', audioRelay.bufferSize);
```

## Типичные проблемы и решения

### Проблема 1: Не слышно собеседника

**Возможные причины:**
1. **Аудио данные не приходят** — проверьте WebSocket соединение в Network → WS
2. **Playback context suspended** — браузер блокирует автовоспроизведение до взаимодействия
3. **Громкость выключена** — проверьте системную громкость

**Решение:**
```javascript
// Проверить состояние playback context
console.log('Playback state:', audioRelay.playbackContext?.state);

// Принудительно resume
if (audioRelay.playbackContext?.state === 'suspended') {
  audioRelay.playbackContext.resume();
}
```

### Проблема 2: Собеседник не слышит меня

**Возможные причины:**
1. **Микрофон выключен** — проверьте кнопку микрофона
2. **Нет разрешения на микрофон**
3. **Микрофон занят другим приложением**

**Решение:**
```javascript
console.log('Muted:', audioRelay.isMuted);
console.log('Capturing:', audioRelay.isCapturing);
console.log('Local stream:', !!audioRelay.localStream);

const track = audioRelay.localStream?.getAudioTracks()[0];
console.log('Track enabled:', track?.enabled);
console.log('Track state:', track?.readyState);
```

### Проблема 3: Эхо в звонке

**Причина**: Оба окна открыты на одном компьютере без наушников

**Решение:**
1. Используйте наушники
2. Тестируйте на разных устройствах
3. Выключите микрофон в одном из окон

### Проблема 4: Задержка звука

**Причина**: Audio relay через сервер добавляет задержку (буферизация + сеть)

**Нормальные значения:**
- Задержка < 200ms — отлично
- Задержка 200-500ms — приемлемо
- Задержка > 500ms — плохая сеть

**Решение:**
- Проверьте качество интернет-соединения
- Убедитесь, что сервер находится близко к пользователям

### Проблема 5: Плохое качество звука

**Возможные причины:**
1. Потеря пакетов (`socket.volatile` пропускает пакеты при нагрузке)
2. Плохое интернет-соединение
3. Много участников в комнате (каждый поток идёт через сервер)

**Решение:**
1. Проверьте скорость интернета
2. Закройте другие приложения, использующие сеть
3. Уменьшите количество участников

### Проблема 6: Нет доступа к микрофону

**Ошибка в консоли:**
```
NotAllowedError: Permission denied
```

**Решение:**
1. **Chrome/Edge:** Кликните на иконку замка → Разрешите микрофон → Перезагрузите
2. **Firefox:** Кликните на иконку микрофона → "Разрешить" → Перезагрузите
3. **Safari:** Safari → Настройки → Веб-сайты → Микрофон → Разрешите для localhost

## Тестовый скрипт для диагностики

```javascript
async function diagnoseAudio() {
  console.log('🔍 Диагностика аудио...\n');
  
  // 1. Проверка API
  console.log('1️⃣ Media API');
  console.log('getUserMedia:', !!navigator.mediaDevices?.getUserMedia);
  
  // 2. Проверка элементов
  console.log('\n2️⃣ HTML элементы');
  console.log('local-audio:', !!document.getElementById('local-audio'));
  console.log('remote-audio:', !!document.getElementById('remote-audio'));
  
  // 3. Проверка Audio Relay
  console.log('\n3️⃣ Audio Relay');
  console.log('Local stream:', !!audioRelay?.localStream);
  console.log('Capturing:', audioRelay?.isCapturing);
  console.log('Muted:', audioRelay?.isMuted);
  console.log('Capture context:', audioRelay?.captureContext?.state);
  console.log('Playback context:', audioRelay?.playbackContext?.state);
  
  // 4. Проверка разрешений
  console.log('\n4️⃣ Разрешения');
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    console.log('Microphone:', result.state);
  } catch (e) {
    console.log('Не удалось проверить');
  }
  
  // 5. Проверка сигнализации
  console.log('\n5️⃣ Сигнализация');
  console.log('Connected:', signalingManager?.isConnected);
  console.log('Room ID:', signalingManager?.roomId);
  
  console.log('\n✅ Диагностика завершена');
}

diagnoseAudio();
```

## Рекомендации для production

1. **Используйте HTTPS** — обязательно для `getUserMedia`
2. **Тестируйте на разных устройствах** — desktop, mobile, разные браузеры
3. **Мониторьте нагрузку на сервер** — каждый пользователь отправляет аудио через сервер
4. **Ограничьте размер комнат** — параметр `maxRoomSize` в `server/config.js`
