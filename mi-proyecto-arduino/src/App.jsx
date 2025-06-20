import { useState, useEffect, useRef } from "react";
import { PersonWalking, Bicycle, Activity, MicFill, BoxArrowUpRight, Bluetooth } from "react-bootstrap-icons";
import caminataGif from "./assets/Chill Relax GIF by RainToMe.gif";
import correrGif from "./assets/bugs bunny running GIF.gif";
import ciclismoGif from "./assets/bicycle GIF.gif";

const ejercicios = [
  {
    nombre: "Caminata",
    valor: "CAMINATA",
    icon: <PersonWalking size={38} />,
    color: "#42b983",
    bg: "linear-gradient(120deg,#e0f7fa,#fff)",
    gif: caminataGif,
  },
  {
    nombre: "Correr",
    valor: "CORRER",
    icon: <Activity size={38} />,
    color: "#fa5555",
    bg: "linear-gradient(120deg,#fff1f0,#fff)",
    gif: correrGif,
  },
  {
    nombre: "Ciclismo",
    valor: "CICLISMO",
    icon: <Bicycle size={38} />,
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
  const wsRef = useRef(null);

  // 🆕 Estados para Web Bluetooth
  const [bluetoothDevice, setBluetoothDevice] = useState(null);
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [txCharacteristic, setTxCharacteristic] = useState(null);

  // Set global font and background
  useEffect(() => {
    document.body.style.background = "#f3f8fb";
    document.body.style.fontFamily = "Nunito, Montserrat, Arial, sans-serif";
    document.body.style.margin = "0";
    document.body.style.minHeight = "100vh";
  }, []);

  // WebSocket conexión (mantener como fallback)
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
      // Solo procesar mensajes WebSocket si no está conectado vía Bluetooth
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

  // 🆕 Conectar al Arduino vía Web Bluetooth
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
          '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 Service
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e'  // Nordic UART fallback
        ]
      });
      
      console.log('✅ Dispositivo encontrado:', device.name);
      setStatus('🔗 Conectando...');
      
      const server = await device.gatt.connect();
      console.log('✅ Conectado al GATT server');
      
      // Intentar servicio HM-10 estándar primero
      let service, txChar, rxChar;
      
      try {
        // UUID estándar HM-10
        service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
        console.log('✅ Servicio HM-10 obtenido');
        
        // En HM-10, TX y RX usan la misma característica
        txChar = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
        rxChar = txChar; // Misma característica para ambos
        
      } catch (error) {
        console.log('⚠️ Servicio HM-10 no encontrado, intentando Nordic UART...');
        
        // Fallback a Nordic UART
        service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
        console.log('✅ Servicio Nordic UART obtenido');
        
        txChar = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
        rxChar = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
      }
      
      setTxCharacteristic(txChar);
      
      // Configurar notificaciones para recibir datos
      await rxChar.startNotifications();
      
      rxChar.addEventListener('characteristicvaluechanged', (event) => {
        const value = new TextDecoder().decode(event.target.value);
        console.log('📥 Arduino responde:', value);
        
        // Procesar mensajes del Arduino
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
      
      // Manejar desconexión
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

  // 🆕 Enviar comando al Arduino vía Bluetooth
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
      // Si falla el envío, probablemente se desconectó
      setBluetoothConnected(false);
      setBluetoothDevice(null);
      setTxCharacteristic(null);
      return false;
    }
  };

  // 🆕 Desconectar Bluetooth
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

  // 🔄 Función iniciarEjercicio modificada
  const iniciarEjercicio = () => {
    const comando = `${selected.valor}:${distancia}`;
    
    if (bluetoothConnected) {
      // 🆕 Usar conexión Bluetooth directa
      if (sendBluetoothCommand(comando)) {
        setStatus(`Iniciando ${selected.nombre} (${distancia}m) vía BLE...`);
        setProgress(0);
        setIsRunning(true);
      }
    } else if (wsRef.current && wsRef.current.readyState === 1) {
      // Fallback a WebSocket (USB)
      wsRef.current.send(comando);
      setStatus(`Iniciando ${selected.nombre} (${distancia}m) vía USB...`);
      setProgress(0);
      setIsRunning(true);
    } else {
      setStatus('❌ No hay conexión disponible');
    }
  };

  // Reconocimiento de voz (sin cambios)
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
        setDistancia(3); // Distancia corta automática
        setTimeout(() => iniciarEjercicio(), 400);
      } else if (resultado.includes("iniciar correr")) {
        setSelected(ejercicios[1]);
        setDistancia(2); // Aún más corta para correr
        setTimeout(() => iniciarEjercicio(), 400);
      } else if (resultado.includes("iniciar ciclismo")) {
        setSelected(ejercicios[2]);
        setDistancia(5); // Un poco más larga para ciclismo
        setTimeout(() => iniciarEjercicio(), 400);
      }
    };
    recognition.onerror = () => setTextoVoz("No se reconoció ningún comando.");
    recognition.start();
  };

  // CARD Styles (sin cambios)
  const cardStyle = (ej) => ({
    minWidth: 110,
    height: 130,
    cursor: isRunning ? "not-allowed" : "pointer",
    border: selected.valor === ej.valor ? `2.5px solid ${ej.color}` : "2px solid #e3e8ef",
    background: ej.bg,
    transition: "all .19s cubic-bezier(.4,1.6,.3,1)",
    boxShadow: selected.valor === ej.valor ? "0 8px 24px #aaa3" : "0 2px 12px #ccd3",
    opacity: isRunning ? 0.7 : 1,
    borderRadius: 18,
    margin: "0 7px",
    padding: "16px 7px 8px 7px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  });

  return (
    <div style={{ minHeight: "100vh", width: "100vw", display: "flex" }}>
      {/* Panel izquierdo */}
      <div
        style={{
          width: "410px",
          minWidth: "300px",
          height: "100vh",
          background: "#fff",
          borderRight: "1.5px solid #e7ecf2",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "32px 22px 0 22px",
        }}
      >
        <div style={{
          fontWeight: 900,
          fontSize: "2.6rem",
          color: "#166aaa",
          letterSpacing: "2.5px",
          marginBottom: 26,
          textShadow: "0 2px 16px #64bcff19"
        }}>
          Mi Fitness Case
        </div>

        {/* Estado de conexión */}
        <div style={{
          background: status.includes("Conectado") || status.includes("✅") ? "#e9faf1" : "#fffbe9",
          color: status.includes("Conectado") || status.includes("✅") ? "#2b8a5e" : "#f68639",
          fontWeight: 600,
          borderRadius: 9,
          padding: "6px 15px",
          marginBottom: 20,
          fontSize: "1.06rem",
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}>
          <BoxArrowUpRight style={{ opacity: 0.8, fontSize: 16 }} /> {status}
        </div>

        <div style={{ width: "100%", marginBottom: 18, display: "flex", justifyContent: "center" }}>
          {ejercicios.map((ej) => (
            <div
              key={ej.valor}
              style={cardStyle(ej)}
              onClick={() => !isRunning && setSelected(ej)}
            >
              <div style={{
                background: ej.color + "22",
                borderRadius: "50%",
                padding: 7,
                marginBottom: 3
              }}>
                {ej.icon}
              </div>
              <div style={{
                fontWeight: 700,
                fontSize: 19,
                color: ej.color,
                marginBottom: 3
              }}>{ej.nombre}</div>
            </div>
          ))}
        </div>

        <div style={{ width: "100%", maxWidth: 250, margin: "8px 0 13px 0" }}>
          <label htmlFor="distancia" style={{ fontWeight: 700, marginBottom: 4, color: "#386" }}>
            Distancia objetivo (m):
          </label>
          <input
            id="distancia"
            type="number"
            min={1}
            max={20}
            value={distancia}
            onChange={e => setDistancia(e.target.value)}
            className="form-control"
            style={{
              borderRadius: 12, fontWeight: 700, padding: 7, fontSize: 18, border: "1.4px solid #b6dee3",
              background: "#f7fcff"
            }}
            disabled={isRunning}
          />
          <small style={{ color: "#666", fontSize: "0.9rem", marginTop: "4px", display: "block" }}>
            💡 Recomendado: 2-5m para pruebas rápidas
          </small>
        </div>

        <div className="w-100 mb-2" style={{ maxWidth: 250 }}>
          {/* 🆕 Botón de conexión Bluetooth */}
          <button
            className="btn"
            style={{
              width: "100%", 
              borderRadius: 16, 
              fontSize: "1.1rem", 
              fontWeight: 700,
              marginBottom: 8,
              background: bluetoothConnected ? "#28a745" : "#007bff",
              color: "white",
              border: "none",
              boxShadow: "0 2px 14px #0066cc49"
            }}
            onClick={bluetoothConnected ? disconnectBluetooth : connectBluetooth}
            disabled={isRunning}
          >
            <Bluetooth size={20} className="mb-1" style={{ marginRight: 8 }} />
            {bluetoothConnected ? '✅ Bluetooth Conectado' : '📱 Conectar Arduino'}
          </button>

          <button
            className="btn btn-primary shadow"
            style={{
              width: "100%", borderRadius: 16, fontSize: "1.2rem", fontWeight: 700,
              marginBottom: 8, background: selected.color, border: "none", boxShadow: "0 2px 14px #84ccfa49"
            }}
            onClick={iniciarEjercicio}
            disabled={isRunning}
          >
            Iniciar
          </button>
          <button
            className="btn btn-dark"
            style={{
              width: "100%", borderRadius: 16, fontSize: "1.1rem", fontWeight: 600, boxShadow: "0 1px 7px #4441"
            }}
            onClick={escucharVoz}
            disabled={isRunning}
          >
            <MicFill size={21} className="mb-1" /> Voz
          </button>
        </div>

        {/* Comando de voz */}
        <div className="w-100 mb-2" style={{ maxWidth: 250 }}>
          <div
            style={{
              minHeight: 35,
              fontSize: 15,
              color: textoVoz && textoVoz.includes("iniciar") ? "#3c7a44" : "#666",
              background: textoVoz && textoVoz.includes("iniciar") ? "#e6faee" : "#f3f3f7",
              borderRadius: 9,
              border: "1.2px solid #e0ecf3",
              fontWeight: 600,
              boxShadow: "0 1px 8px #0001",
              padding: "6px 10px",
              marginBottom: 3,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <MicFill size={16} style={{ opacity: 0.7 }} />
            {textoVoz ? <> {textoVoz} </> : <> Comando de voz no detectado </>}
          </div>
        </div>
      </div>

      {/* Panel derecho - GIF, barra y instrucciones (sin cambios) */}
      <div
        style={{
          flexGrow: 1,
          minHeight: "100vh",
          background: "#f3f8fb",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 0",
        }}
      >
        <div style={{
          width: "100%",
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 6px 40px #aee4ff29",
          padding: "22px 22px 18px 22px",
        }}>
          <img
            src={selected.gif}
            alt="Ejercicio en progreso"
            style={{
              height: 220,
              width: "auto",
              borderRadius: 15,
              marginBottom: 20,
              boxShadow: "0 2px 24px #22cfff17",
              background: "#f8fcff"
            }}
          />
          {/* Barra de progreso */}
          <div style={{ width: "100%", marginBottom: 16 }}>
            <div style={{
              height: "28px",
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
                  fontSize: 18,
                  paddingRight: 16,
                  letterSpacing: 1
                }}
              >
                {progress > 0 ? `${progress}%` : ""}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center", color: "#14537a", fontWeight: 800, fontSize: 23, letterSpacing: 0.5, marginBottom: 10 }}>
            {status}
          </div>
          {/* INSTRUCCIONES EN FRANJA HORIZONTAL */}
          <div
            style={{
              width: "100%",
              background: "#eafdff",
              border: "1.3px solid #b4e9fa",
              borderRadius: 11,
              padding: "13px 18px",
              color: "#12618a",
              fontSize: 16.2,
              fontWeight: 500,
              boxShadow: "0 1px 8px #90d6fa11",
              textAlign: "center",
              letterSpacing: 0.05,
              marginTop: 10,
              marginBottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              flexWrap: "nowrap",
              overflow: "hidden"
            }}
          >
            <span><b>1. Conecta Arduino vía Bluetooth.</b></span>
            <span>|</span>
            <span><b>2. Usa distancias cortas (2-5m) para pruebas.</b></span>
            <span>|</span>
            <span><b>3. Pulsa Iniciar o usa Voz.</b></span>
            <span>|</span>
            <span><b>4. ¡Mueve el sensor suavemente!</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;