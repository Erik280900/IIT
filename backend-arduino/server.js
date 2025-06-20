// Backend ultra-simple para Web Bluetooth
// Solo maneja estado de la webapp, la comunicación BLE es directa navegador ↔ Arduino
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3001 });

let clients = [];

wss.on('connection', (ws) => {
  console.log('🌐 WebApp conectada');
  clients.push(ws);
  
  // Notificar que está listo para Bluetooth
  ws.send('WEB_BLUETOOTH_READY');
  
  ws.on('message', (data) => {
    const message = data.toString();
    console.log('📱 Estado webapp:', message);
    
    // Solo logging y state management
    if (message.startsWith('BLUETOOTH_CONNECTED')) {
      console.log('✅ Arduino conectado vía Web Bluetooth');
    }
    
    if (message.startsWith('EJERCICIO_INICIADO')) {
      console.log('🏃 Ejercicio iniciado:', message);
    }
    
    // Sync entre múltiples clientes si los hay
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
  
  ws.on('close', () => {
    console.log('🌐 WebApp desconectada');
    clients = clients.filter(client => client !== ws);
  });
});

console.log('🚀 Fitness Backend iniciado en puerto 3001');
console.log('📱 Navegador se conectará directamente al Arduino');
console.log('🔗 Sin cables USB, sin dependencias nativas');
console.log('');
console.log('✅ Listo para Web Bluetooth API!');