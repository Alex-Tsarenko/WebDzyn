# WebDzyn - WebRTC Звонилка

Веб-приложение для видео и аудио звонков на основе WebRTC технологии.

## 📋 Описание

WebDzyn - это браузерное приложение для осуществления звонков в реальном времени, использующее WebRTC API. Приложение позволяет устанавливать peer-to-peer соединения для аудио и видео коммуникации прямо в браузере без необходимости установки дополнительного ПО.

## ✨ Основные возможности

- 📞 Аудио звонки в реальном времени
- 🔒 Шифрование соединения (DTLS/SRTP)
- 🌐 Работа напрямую в браузере
- 💬 Текстовый чат через DataChannel
- 🎤 Управление микрофоном и камерой
- 🔇 Отключение звука и видео во время звонка

## 🛠 Технологический стек

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **WebRTC API**: RTCPeerConnection, getUserMedia, RTCDataChannel
- **Signaling Server**: WebSocket (Node.js + Socket.io / Python + WebSockets)
- **STUN/TURN серверы**: для NAT traversal

## 📦 Установка

### Требования

- Node.js >= 14.x (для сигнального сервера)
- Современный браузер с поддержкой WebRTC (Chrome 56+, Firefox 44+, Safari 11+, Edge 79+)
- HTTPS соединение (обязательно для production)

### Шаги установки

```bash
# Клонировать репозиторий
git clone https://github.com/Alex-Tsarenko/WebDzyn.git
cd WebDzyn

# Установить зависимости
npm install

# Запустить сигнальный сервер
npm start

# Открыть в браузере
# http://localhost:3000
```

## 🚀 Быстрый старт

1. Запустите сигнальный сервер
2. Откройте приложение в двух разных вкладках/браузерах
3. Один пользователь создает комнату и получает ID
4. Второй пользователь подключается к комнате по ID
5. Разрешите доступ к камере и микрофону
6. Начните звонок!

## 📁 Структура проекта

```
WebDzyn/
├── client/                 # Клиентская часть
│   ├── index.html         # Главная страница
│   ├── css/               # Стили
│   ├── js/                # JavaScript логика
│   │   ├── main.js        # Основной файл
│   │   ├── webrtc.js      # WebRTC логика
│   │   └── signaling.js   # Сигнализация
│   └── assets/            # Ресурсы (иконки, изображения)
├── server/                # Серверная часть
│   ├── server.js          # Сигнальный сервер
│   └── config.js          # Конфигурация
├── docs/                  # Документация
├── package.json
└── README.md
```

## 🔧 Конфигурация

### STUN/TURN серверы

Отредактируйте конфигурацию ICE серверов в `client/js/webrtc.js`:

```javascript
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:your-turn-server.com:3478',
      username: 'username',
      credential: 'password'
    }
  ]
};
```

## 🔐 Безопасность

- Используйте HTTPS в production
- Настройте CORS политики
- Используйте собственный TURN сервер для production
- Реализуйте аутентификацию пользователей
- Валидируйте все входящие данные на сервере

## 🌐 Поддержка браузеров

| Браузер | Минимальная версия |
|---------|-------------------|
| Chrome  | 56+               |
| Firefox | 44+               |
| Safari  | 11+               |
| Edge    | 79+               |
| Opera   | 43+               |

## 📝 API документация

### WebRTC Events

- `onicecandidate` - получение ICE кандидатов
- `ontrack` - получение медиа потока
- `ondatachannel` - получение data channel
- `onconnectionstatechange` - изменение состояния соединения

### Signaling Messages

- `join` - присоединение к комнате
- `offer` - отправка SDP offer
- `answer` - отправка SDP answer
- `ice-candidate` - обмен ICE кандидатами
- `leave` - выход из комнаты

## 🧪 Тестирование

```bash
# Запустить тесты
npm test

# Запустить в режиме разработки
npm run dev
```

## 🤝 Вклад в проект

Приветствуются pull requests! Для крупных изменений сначала откройте issue для обсуждения.

## 📄 Лицензия

[MIT](LICENSE)

## 👤 Автор

Alex Tsarenko

## 🔗 Полезные ссылки

- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [WebRTC Samples](https://webrtc.github.io/samples/)
- [STUN/TURN Server Setup](https://www.html5rocks.com/en/tutorials/webrtc/infrastructure/)

## 📞 Поддержка

Если у вас возникли вопросы или проблемы, создайте issue в репозитории.

---

**Статус проекта**: В разработке 🚧
