# Тестирование WebDzyn сервера

## Методы проверки работоспособности

### 1. Автоматический тест-скрипт

```bash
# Сначала запустите сервер в одном терминале
npm start

# В другом терминале запустите тесты
node server/test-server.js
```

Скрипт проверит:
- ✅ REST API endpoints (`/api/health`, `/api/rooms`)
- ✅ WebSocket подключение
- ✅ Создание комнаты
- ✅ Присоединение к комнате
- ✅ Обмен аудио данными через Socket.IO

### 2. Ручная проверка через curl

#### Проверка health endpoint:
```bash
curl http://localhost:3000/api/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "rooms": 0,
  "users": 0
}
```

#### Проверка списка комнат:
```bash
curl http://localhost:3000/api/rooms
```

Ожидаемый ответ:
```json
{
  "rooms": []
}
```

### 3. Проверка через браузер

1. Откройте в браузере: `http://localhost:3000/api/health`
2. Должен отобразиться JSON с информацией о сервере

### 4. Проверка WebSocket через консоль браузера

```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Подключено! Socket ID:', socket.id);
  
  socket.emit('create-room', (response) => {
    console.log('Комната создана:', response);
  });
});

socket.on('connect_error', (error) => {
  console.error('Ошибка подключения:', error);
});
```

### 5. Проверка логов сервера

При запуске:
```
🚀 WebDzyn Server running on http://localhost:3000
📡 WebSocket server ready for connections
```

При подключении клиента:
```
[INFO] New client connected { socketId: 'abc123' }
```

### 6. Тестирование с несколькими браузерами

1. Откройте два-три окна браузера
2. В первом окне создайте комнату
3. Скопируйте ID комнаты
4. В остальных окнах присоединитесь к комнате по ID
5. Проверьте логи сервера на наличие событий `user-joined`
6. Проверьте что аудио данные передаются (`audio-data` в логах Network → WS)

## Проверка переменных окружения

```bash
cp .env.example .env
```

```env
PORT=3000
CORS_ORIGIN=*
LOG_LEVEL=info
NODE_ENV=development
```

## Устранение неполадок

### Сервер не запускается

**Проблема**: `Error: listen EADDRINUSE: address already in use`

**Решение**:
```bash
lsof -i :3000
kill -9 <PID>
```

### WebSocket не подключается

**Решение**:
1. Проверьте, что сервер запущен
2. Проверьте CORS настройки в `server/config.js`
3. Убедитесь, что используете правильный URL

### Комната не создается

**Решение**:
1. Проверьте логи сервера
2. Убедитесь, что WebSocket подключен
3. Проверьте формат запроса

## Мониторинг в реальном времени

```bash
watch -n 1 'curl -s http://localhost:3000/api/health | jq'
```

## Checklist проверки

- [ ] Сервер запускается без ошибок
- [ ] `/api/health` возвращает статус "ok"
- [ ] `/api/rooms` возвращает список комнат
- [ ] WebSocket подключение устанавливается
- [ ] Комната создается успешно
- [ ] Несколько пользователей могут присоединиться (до 10)
- [ ] Аудио данные передаются между участниками
- [ ] Пользователь может покинуть комнату
- [ ] Логи отображаются корректно
