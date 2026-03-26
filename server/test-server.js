const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

console.log('🧪 Тестирование WebDzyn сервера...\n');

async function testHealthEndpoint() {
  console.log('1️⃣ Проверка Health endpoint...');
  try {
    const response = await fetch(`${SERVER_URL}/api/health`);
    const data = await response.json();
    console.log('✅ Health endpoint работает:', data);
    return true;
  } catch (error) {
    console.error('❌ Health endpoint не работает:', error.message);
    return false;
  }
}

async function testRoomsEndpoint() {
  console.log('\n2️⃣ Проверка Rooms endpoint...');
  try {
    const response = await fetch(`${SERVER_URL}/api/rooms`);
    const data = await response.json();
    console.log('✅ Rooms endpoint работает:', data);
    return true;
  } catch (error) {
    console.error('❌ Rooms endpoint не работает:', error.message);
    return false;
  }
}

function testWebSocket() {
  return new Promise((resolve) => {
    console.log('\n3️⃣ Проверка WebSocket соединения...');
    
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket подключен, Socket ID:', socket.id);
      
      console.log('\n4️⃣ Тестирование создания комнаты...');
      socket.emit('create-room', (response) => {
        if (response.success) {
          console.log('✅ Комната создана:', response.roomId);
          console.log('   ICE серверы получены:', response.iceServers.length);
          
          testJoinRoom(response.roomId, socket, resolve);
        } else {
          console.error('❌ Не удалось создать комнату');
          socket.disconnect();
          resolve(false);
        }
      });
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения WebSocket:', error.message);
      resolve(false);
    });

    setTimeout(() => {
      console.error('❌ Таймаут подключения WebSocket');
      socket.disconnect();
      resolve(false);
    }, 5000);
  });
}

function testJoinRoom(roomId, socket1, resolve) {
  console.log('\n5️⃣ Тестирование присоединения к комнате...');
  
  const socket2 = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: false
  });

  socket2.on('connect', () => {
    console.log('✅ Второй клиент подключен, Socket ID:', socket2.id);
    
    socket2.emit('join-room', roomId, (response) => {
      if (response.success) {
        console.log('✅ Присоединение к комнате успешно');
        console.log('   Пользователей в комнате:', response.users.length + 1);
        
        testSignaling(socket1, socket2, roomId, resolve);
      } else {
        console.error('❌ Не удалось присоединиться к комнате:', response.error);
        socket1.disconnect();
        socket2.disconnect();
        resolve(false);
      }
    });
  });

  socket1.on('user-joined', (data) => {
    console.log('✅ Событие user-joined получено:', data.userId);
  });
}

function testSignaling(socket1, socket2, roomId, resolve) {
  console.log('\n6️⃣ Тестирование обмена сигналами...');
  
  let testsCompleted = 0;
  const totalTests = 3;

  socket2.on('offer', (data) => {
    console.log('✅ Offer получен от:', data.userId);
    testsCompleted++;
    checkComplete();
  });

  socket1.on('answer', (data) => {
    console.log('✅ Answer получен от:', data.userId);
    testsCompleted++;
    checkComplete();
  });

  socket2.on('ice-candidate', (data) => {
    console.log('✅ ICE candidate получен от:', data.userId);
    testsCompleted++;
    checkComplete();
  });

  socket1.emit('offer', {
    roomId,
    offer: { type: 'offer', sdp: 'test-sdp' },
    targetUserId: socket2.id
  });

  socket2.emit('answer', {
    roomId,
    answer: { type: 'answer', sdp: 'test-sdp' },
    targetUserId: socket1.id
  });

  socket1.emit('ice-candidate', {
    roomId,
    candidate: { candidate: 'test-candidate' },
    targetUserId: socket2.id
  });

  function checkComplete() {
    if (testsCompleted === totalTests) {
      console.log('\n✅ Все тесты пройдены успешно!');
      socket1.disconnect();
      socket2.disconnect();
      resolve(true);
    }
  }

  setTimeout(() => {
    if (testsCompleted < totalTests) {
      console.error(`❌ Не все сигналы получены (${testsCompleted}/${totalTests})`);
      socket1.disconnect();
      socket2.disconnect();
      resolve(false);
    }
  }, 3000);
}

async function runTests() {
  const healthOk = await testHealthEndpoint();
  if (!healthOk) {
    console.error('\n❌ Сервер не запущен или недоступен');
    console.log('💡 Запустите сервер командой: npm start');
    process.exit(1);
  }

  await testRoomsEndpoint();
  await testWebSocket();

  console.log('\n🎉 Тестирование завершено!\n');
  process.exit(0);
}

runTests();
