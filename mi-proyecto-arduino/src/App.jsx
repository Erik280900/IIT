import { useState, useEffect, useRef } from "react";

// Componentes de iconos simples con CSS
const IconWalk = ({ size = 32 }) => (
  <div style={{ 
    fontSize: size, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    width: size,
    height: size
  }}>🚶</div>
);

const IconRun = ({ size = 32 }) => (
  <div style={{ 
    fontSize: size, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    width: size,
    height: size
  }}>🏃</div>
);

const IconBike = ({ size = 32 }) => (
  <div style={{ 
    fontSize: size, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    width: size,
    height: size
  }}>🚴</div>
);

const IconMic = ({ size = 18 }) => (
  <div style={{ 
    fontSize: size, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    width: size,
    height: size
  }}>🎤</div>
);

const IconBluetooth = ({ size = 18 }) => (
  <div style={{ 
    fontSize: size, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    width: size,
    height: size
  }}>📶</div>
);

const IconLink = ({ size = 16 }) => (
  <div style={{ 
    fontSize: size, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    width: size,
    height: size
  }}>🔗</div>
);
// Importar los GIFs originales del usuario
import caminataGif from "./assets/Chill Relax GIF by RainToMe.gif";
import correrGif from "./assets/bugs bunny running GIF.gif";
import ciclismoGif from "./assets/bicycle GIF.gif";

const ejercicios = [
  {
    nombre: "Caminata",
    valor: "CAMINATA",
    icon: <IconWalk size={32} />,
    color: "#42b983",
    bg: "linear-gradient(120deg,#e0f7fa,#fff)",
    gif: caminataGif,
  },
  {
    nombre: "Correr",
    valor: "CORRER",
    icon: <IconRun size={32} />,
    color: "#fa5555",
    bg: "linear-gradient(120deg,#fff1f0,#fff)",
    gif: correrGif,
  },
  {
    nombre: "Ciclismo",
    valor: "CICLISMO",
    icon: <IconBike size={32} />,
    color: "#4699fa",
    bg: "linear-gradient(120deg,#e0f2ff,#fff)",
    gif: ciclismoGif,
  },
];

function App() {
  const [selected, setSelected] = useState(ejercicios[0]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Esperando...");
  const [isRunning, setIsRunning] = useState(false);
  const [textoVoz, setTextoVoz] = useState("");
  const [distancia, setDistancia] = useState(3);
  const [isMobile, setIsMobile] = useState(false);
  const wsRef = useRef(null);

  // Estados para Web Bluetooth
  const [bluetoothDevice, setBluetoothDevice] = useState(null);
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [txCharacteristic, setTxCharacteristic] = useState(null);

  // Detectar si es móvil (más preciso)
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(width <= 768 || isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  // Set global font and background + viewport meta
  useEffect(() => {
    // Agregar meta viewport si no existe
    let viewport = document.querySelector("meta[name=viewport]");
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.getElementsByTagName('head')[0].appendChild(viewport);
    } else {
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    }
    
    document.body.style.background = "#f3f8fb";
    document.body.style.fontFamily = "Nunito, Montserrat, Arial, sans-serif";
    document.body.style.margin = "0";
    document.body.style.minHeight = "100vh";
    document.body.style.overflowX = "hidden"; // Evitar scroll horizontal
  }, []);

  // WebSocket conexión
  useEffect(() => {
    wsRef.current = new window.WebSocket("ws://localhost:3001");
    wsRef.current.onopen = () => {
      if (!bluetoothConnected) {
        setStatus("Conectado vía USB ✔️");
      }
    };
    wsRef.current.onclose = () => {
      if (!bluetoothConnected) {
        setStatus("Desconectado");
      }
    };
    wsRef.current.onerror = () => {
      if (!bluetoothConnected) {
        setStatus("Error WS");
      }
    };

    wsRef.current.onmessage = (msg) => {
      if (!bluetoothConnected) {
        if (msg.data.startsWith("PROGRESO:")) {
          const value = Number(msg.data.split(":")[1]);
          setProgress(value);
          setIsRunning(true);
        }
        if (msg.data.trim() === "TERMINADO") {
          setStatus("¡Ejercicio terminado!");
          setProgress(100);
          setIsRunning(false);
        }
      }
    };

    return () => {
      wsRef.current && wsRef.current.close();
    };
  }, [bluetoothConnected]);

  // Conectar al Arduino vía Web Bluetooth
  const connectBluetooth = async () => {
    if (!navigator.bluetooth) {
      alert('Tu navegador no soporta Web Bluetooth. Usa Chrome/Edge.');
      return;
    }

    try {
      setStatus('🔍 Buscando Arduino-HM10...');
      
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'Arduino-HM10' }],
        optionalServices: [
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
        ]
      });
      
      console.log('✅ Dispositivo encontrado:', device.name);
      setStatus('🔗 Conectando...');
      
      const server = await device.gatt.connect();
      console.log('✅ Conectado al GATT server');
      
      let service, txChar, rxChar;
      
      try {
        service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
        console.log('✅ Servicio HM-10 obtenido');
        
        txChar = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
        rxChar = txChar;
        
      } catch (error) {
        console.log('⚠️ Servicio HM-10 no encontrado, intentando Nordic UART...');
        
        service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
        console.log('✅ Servicio Nordic UART obtenido');
        
        txChar = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
        rxChar = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
      }
      
      setTxCharacteristic(txChar);
      
      await rxChar.startNotifications();
      
      rxChar.addEventListener('characteristicvaluechanged', (event) => {
        const value = new TextDecoder().decode(event.target.value);
        console.log('📥 Arduino responde:', value);
        
        if (value.startsWith('PROGRESO:')) {
          const progressValue = Number(value.split(':')[1]);
          setProgress(progressValue);
          setIsRunning(true);
          setStatus(`Ejercitando... ${progressValue}% 💪`);
        }
        
        if (value.trim() === 'TERMINADO') {
          setStatus('¡Ejercicio completado! 🎉');
          setProgress(100);
          setIsRunning(false);
        }
        
        if (value.includes('Ejercicio iniciado')) {
          setStatus('¡Ejercicio en progreso! 🏃‍♂️');
        }
      });
      
      device.addEventListener('gattserverdisconnected', () => {
        console.log('📱 Arduino desconectado');
        setBluetoothConnected(false);
        setBluetoothDevice(null);
        setTxCharacteristic(null);
        setStatus('Arduino desconectado');
      });
      
      setBluetoothDevice(device);
      setBluetoothConnected(true);
      setStatus('✅ Arduino conectado vía Bluetooth 📱');
      
      console.log('🎉 ¡Conexión Web Bluetooth exitosa!');
      
    } catch (error) {
      console.error('❌ Error conectando Bluetooth:', error);
      setStatus('Error: ' + error.message);
    }
  };

  // Enviar comando al Arduino vía Bluetooth
  const sendBluetoothCommand = async (command) => {
    if (!txCharacteristic || !bluetoothDevice || !bluetoothDevice.gatt.connected) {
      setStatus('❌ Arduino no conectado vía Bluetooth');
      console.log('❌ No hay conexión BLE válida');
      return false;
    }
    
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(command + '\n');
      await txCharacteristic.writeValue(data);
      console.log('📤 Comando enviado vía Bluetooth:', command);
      setStatus(`📤 Comando enviado: ${command}`);
      return true;
    } catch (error) {
      console.error('❌ Error enviando comando:', error);
      setStatus('❌ Error enviando comando: ' + error.message);
      setBluetoothConnected(false);
      setBluetoothDevice(null);
      setTxCharacteristic(null);
      return false;
    }
  };

  // Desconectar Bluetooth
  const disconnectBluetooth = () => {
    console.log('🔌 Desconectando Bluetooth...');
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
      bluetoothDevice.gatt.disconnect();
    }
    setBluetoothConnected(false);
    setBluetoothDevice(null);
    setTxCharacteristic(null);
    setStatus('🔌 Bluetooth desconectado manualmente');
  };

  // Función iniciarEjercicio
  const iniciarEjercicio = () => {
    const comando = `${selected.valor}:${distancia}`;
    
    if (bluetoothConnected) {
      if (sendBluetoothCommand(comando)) {
        setStatus(`Iniciando ${selected.nombre} (${distancia}m) vía BLE...`);
        setProgress(0);
        setIsRunning(true);
      }
    } else if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(comando);
      setStatus(`Iniciando ${selected.nombre} (${distancia}m) vía USB...`);
      setProgress(0);
      setIsRunning(true);
    } else {
      setStatus('❌ No hay conexión disponible');
    }
  };

  // Reconocimiento de voz
  const escucharVoz = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "es-PE";
    recognition.onresult = (event) => {
      const resultado = event.results[0][0].transcript.toLowerCase();
      setTextoVoz(resultado);

      const distanciaMatch = resultado.match(/distancia (\d+)/);
      if (distanciaMatch) setDistancia(Number(distanciaMatch[1]));

      if (resultado.includes("iniciar caminata")) {
        setSelected(ejercicios[0]);
        setDistancia(3);
        setTimeout(() => iniciarEjercicio(), 400);
      } else if (resultado.includes("iniciar correr")) {
        setSelected(ejercicios[1]);
        setDistancia(2);
        setTimeout(() => iniciarEjercicio(), 400);
      } else if (resultado.includes("iniciar ciclismo")) {
        setSelected(ejercicios[2]);
        setDistancia(5);
        setTimeout(() => iniciarEjercicio(), 400);
      }
    };
    recognition.onerror = () => setTextoVoz("No se reconoció ningún comando.");
    recognition.start();
  };

  // Estilos responsive para las cards
  const cardStyle = (ej) => ({
    minWidth: isMobile ? 90 : 110,
    height: isMobile ? 110 : 130,
    cursor: isRunning ? "not-allowed" : "pointer",
    border: selected.valor === ej.valor ? `2.5px solid ${ej.color}` : "2px solid #e3e8ef",
    background: ej.bg,
    transition: "all .19s cubic-bezier(.4,1.6,.3,1)",
    boxShadow: selected.valor === ej.valor ? "0 8px 24px #aaa3" : "0 2px 12px #ccd3",
    opacity: isRunning ? 0.7 : 1,
    borderRadius: 18,
    margin: isMobile ? "0 4px" : "0 7px",
    padding: isMobile ? "12px 4px 6px 4px" : "16px 7px 8px 7px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: isMobile ? 4 : 6,
  });

  const containerStyle = {
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    overflow: "hidden", // Evitar scroll no deseado
  };

  const leftPanelStyle = {
    width: isMobile ? "100%" : "410px",
    minWidth: isMobile ? "100%" : "300px",
    height: isMobile ? "auto" : "100vh",
    background: "#fff",
    borderRight: isMobile ? "none" : "1.5px solid #e7ecf2",
    borderBottom: isMobile ? "1.5px solid #e7ecf2" : "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: isMobile ? "16px 12px 20px 12px" : "32px 22px 0 22px",
    boxSizing: "border-box",
  };

  const rightPanelStyle = {
    flexGrow: 1,
    minHeight: isMobile ? "50vh" : "100vh",
    background: "#f3f8fb",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: isMobile ? "12px" : "20px 0",
    boxSizing: "border-box",
  };

  const mainCardStyle = {
    width: "100%",
    maxWidth: isMobile ? "100%" : 480,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "#fff",
    borderRadius: 20,
    boxShadow: "0 6px 40px #aee4ff29",
    padding: isMobile ? "12px" : "22px 22px 18px 22px",
    boxSizing: "border-box",
  };

  return (
    <div style={containerStyle}>
      {/* Panel izquierdo */}
      <div style={leftPanelStyle}>
        <div style={{
          fontWeight: 900,
          fontSize: isMobile ? "1.8rem" : "2.6rem",
          color: "#166aaa",
          letterSpacing: isMobile ? "1.5px" : "2.5px",
          marginBottom: isMobile ? 16 : 26,
          textShadow: "0 2px 16px #64bcff19",
          textAlign: "center"
        }}>
          Mi Fitness Case
        </div>

        {/* Estado de conexión */}
        <div style={{
          background: status.includes("Conectado") || status.includes("✅") ? "#e9faf1" : "#fffbe9",
          color: status.includes("Conectado") || status.includes("✅") ? "#2b8a5e" : "#f68639",
          fontWeight: 600,
          borderRadius: 9,
          padding: isMobile ? "4px 12px" : "6px 15px",
          marginBottom: isMobile ? 12 : 20,
          fontSize: isMobile ? "0.9rem" : "1.06rem",
          display: "flex",
          alignItems: "center",
          gap: 7,
          textAlign: "center",
          width: "100%",
          maxWidth: isMobile ? "100%" : "auto",
          justifyContent: "center"
        }}>
          <IconLink size={16} style={{ opacity: 0.8 }} /> 
          <span style={{ wordBreak: "break-word" }}>{status}</span>
        </div>

        {/* Cards de ejercicios */}
        <div style={{ 
          width: "100%", 
          marginBottom: isMobile ? 12 : 18, 
          display: "flex", 
          justifyContent: "center",
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: isMobile ? "8px" : "0"
        }}>
          {ejercicios.map((ej) => (
            <div
              key={ej.valor}
              style={cardStyle(ej)}
              onClick={() => !isRunning && setSelected(ej)}
            >
              <div style={{
                background: ej.color + "22",
                borderRadius: "50%",
                padding: isMobile ? 5 : 7,
                marginBottom: 3
              }}>
                {ej.icon}
              </div>
              <div style={{
                fontWeight: 700,
                fontSize: isMobile ? 16 : 19,
                color: ej.color,
                marginBottom: 3,
                textAlign: "center"
              }}>{ej.nombre}</div>
            </div>
          ))}
        </div>

        {/* Input de distancia */}
        <div style={{ width: "100%", maxWidth: isMobile ? "100%" : 250, margin: isMobile ? "6px 0 10px 0" : "8px 0 13px 0" }}>
          <label htmlFor="distancia" style={{ 
            fontWeight: 700, 
            marginBottom: 4, 
            color: "#386",
            fontSize: isMobile ? "0.9rem" : "1rem",
            display: "block"
          }}>
            Distancia objetivo (m):
          </label>
          <input
            id="distancia"
            type="number"
            min={1}
            max={20}
            value={distancia}
            onChange={e => setDistancia(e.target.value)}
            style={{
              borderRadius: 12, 
              fontWeight: 700, 
              padding: isMobile ? 6 : 7, 
              fontSize: isMobile ? 16 : 18, 
              border: "1.4px solid #b6dee3",
              background: "#f7fcff",
              width: "100%",
              boxSizing: "border-box"
            }}
            disabled={isRunning}
          />
          <small style={{ 
            color: "#666", 
            fontSize: isMobile ? "0.8rem" : "0.9rem", 
            marginTop: "4px", 
            display: "block" 
          }}>
            💡 Recomendado: 2-5m para pruebas rápidas
          </small>
        </div>

        {/* Botones */}
        <div style={{ width: "100%", maxWidth: isMobile ? "100%" : 250 }}>
          {/* Botón de conexión Bluetooth */}
          <button
            style={{
              width: "100%", 
              borderRadius: 16, 
              fontSize: isMobile ? "1rem" : "1.1rem", 
              fontWeight: 700,
              marginBottom: 8,
              background: bluetoothConnected ? "#28a745" : "#007bff",
              color: "white",
              border: "none",
              boxShadow: "0 2px 14px #0066cc49",
              padding: isMobile ? "10px" : "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
            onClick={bluetoothConnected ? disconnectBluetooth : connectBluetooth}
            disabled={isRunning}
          >
            <IconBluetooth size={18} />
            {bluetoothConnected ? '✅ Bluetooth OK' : '📱 Conectar Arduino'}
          </button>

          <button
            style={{
              width: "100%", 
              borderRadius: 16, 
              fontSize: isMobile ? "1.1rem" : "1.2rem", 
              fontWeight: 700,
              marginBottom: 8, 
              background: selected.color, 
              border: "none", 
              boxShadow: "0 2px 14px #84ccfa49",
              color: "white",
              padding: isMobile ? "10px" : "12px"
            }}
            onClick={iniciarEjercicio}
            disabled={isRunning}
          >
            Iniciar
          </button>
          
          <button
            style={{
              width: "100%", 
              borderRadius: 16, 
              fontSize: isMobile ? "1rem" : "1.1rem", 
              fontWeight: 600, 
              boxShadow: "0 1px 7px #4441",
              background: "#343a40",
              color: "white",
              border: "none",
              padding: isMobile ? "10px" : "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
            onClick={escucharVoz}
            disabled={isRunning}
          >
            <IconMic size={18} /> Voz
          </button>
        </div>

        {/* Comando de voz */}
        {textoVoz && (
          <div style={{ width: "100%", maxWidth: isMobile ? "100%" : 250, marginTop: 8 }}>
            <div
              style={{
                minHeight: 35,
                fontSize: isMobile ? 14 : 15,
                color: textoVoz && textoVoz.includes("iniciar") ? "#3c7a44" : "#666",
                background: textoVoz && textoVoz.includes("iniciar") ? "#e6faee" : "#f3f3f7",
                borderRadius: 9,
                border: "1.2px solid #e0ecf3",
                fontWeight: 600,
                boxShadow: "0 1px 8px #0001",
                padding: "6px 10px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                wordBreak: "break-word"
              }}
            >
              <IconMic size={16} style={{ opacity: 0.7, flexShrink: 0 }} />
              <span>{textoVoz}</span>
            </div>
          </div>
        )}
      </div>

      {/* Panel derecho */}
      <div style={rightPanelStyle}>
        <div style={mainCardStyle}>
          <img
            src={selected.gif}
            alt="Ejercicio en progreso"
            style={{
              height: isMobile ? 180 : 220,
              width: "auto",
              maxWidth: "100%",
              borderRadius: 15,
              marginBottom: isMobile ? 16 : 20,
              boxShadow: "0 2px 24px #22cfff17",
              background: "#f8fcff"
            }}
          />
          
          {/* Barra de progreso */}
          <div style={{ width: "100%", marginBottom: isMobile ? 12 : 16 }}>
            <div style={{
              height: isMobile ? "24px" : "28px",
              background: "#eef3f7",
              borderRadius: "16px",
              boxShadow: "0 2px 12px #8cf8ff33",
              overflow: "hidden",
              position: "relative"
            }}>
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: `linear-gradient(90deg,${selected.color} 70%,#fff6 100%)`,
                  transition: "width .7s cubic-bezier(.4,2.3,.3,1)",
                  borderRadius: "16px 0 0 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: isMobile ? 16 : 18,
                  paddingRight: isMobile ? 12 : 16,
                  letterSpacing: 1
                }}
              >
                {progress > 0 ? `${progress}%` : ""}
              </div>
            </div>
          </div>
          
          <div style={{ 
            textAlign: "center", 
            color: "#14537a", 
            fontWeight: 800, 
            fontSize: isMobile ? 20 : 23, 
            letterSpacing: 0.5, 
            marginBottom: isMobile ? 8 : 10,
            wordBreak: "break-word"
          }}>
            {status}
          </div>
          
          {/* Instrucciones */}
          <div
            style={{
              width: "100%",
              background: "#eafdff",
              border: "1.3px solid #b4e9fa",
              borderRadius: 11,
              padding: isMobile ? "10px 12px" : "13px 18px",
              color: "#12618a",
              fontSize: isMobile ? 14 : 16.2,
              fontWeight: 500,
              boxShadow: "0 1px 8px #90d6fa11",
              textAlign: "center",
              letterSpacing: 0.05,
              marginTop: isMobile ? 8 : 10,
              marginBottom: 0,
              lineHeight: isMobile ? 1.4 : 1.5
            }}
          >
            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div><b>1. Conecta Arduino vía Bluetooth</b></div>
                <div><b>2. Usa distancias cortas (2-5m)</b></div>
                <div><b>3. Pulsa Iniciar o usa Voz</b></div>
                <div><b>4. ¡Mueve el sensor suavemente!</b></div>
              </div>
            ) : (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
                flexWrap: "nowrap",
                overflow: "hidden"
              }}>
                <span><b>1. Conecta Arduino vía Bluetooth.</b></span>
                <span>|</span>
                <span><b>2. Usa distancias cortas (2-5m) para pruebas.</b></span>
                <span>|</span>
                <span><b>3. Pulsa Iniciar o usa Voz.</b></span>
                <span>|</span>
                <span><b>4. ¡Mueve el sensor suavemente!</b></span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;