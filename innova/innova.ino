#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>

#define BUZZER_PIN 8
// Definir pines para los LEDs
#define LED_ROJO_PIN 9
#define LED_VERDE_PIN 10
#define LED_BLANCO_PIN 11

LiquidCrystal_I2C lcd(0x27, 16, 2);
SoftwareSerial bluetooth(4, 5); // RX=4, TX=5 para HM-10

bool exerciseActive = false;
int pausesDone = 0;
const int maxPauses = 8;

// MPU6050 registros
const int MPU_ADDR = 0x68;  
int16_t ax, ay, az;

float progress = 0.0;
float progressMax = 3.0; // Progreso máximo más corto

String ejercicio = "CAMINATA"; // por defecto
int distanciaObjetivo = 3; // Distancia más corta por defecto

// Sensibilidad AUMENTADA para ejercicios cortos
float baseSensibilidad = 3.0; // Mayor sensibilidad = más fácil completar

void setup() {
  Wire.begin();
  Serial.begin(9600);
  bluetooth.begin(9600); // Inicializar Bluetooth HM-10

  pinMode(BUZZER_PIN, OUTPUT);
  
  // Configurar pines de LEDs como salida
  pinMode(LED_ROJO_PIN, OUTPUT);
  pinMode(LED_VERDE_PIN, OUTPUT);
  pinMode(LED_BLANCO_PIN, OUTPUT);
  
  // Apagar todos los LEDs al inicio
  apagarTodosLEDs();

  lcd.init();
  lcd.backlight();

  // Inicializar MPU6050
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);

  // Configurar HM-10 para proyecto fitness
  delay(1000);
  bluetooth.print("AT+NAMEFitness-Arduino");
  delay(500);
  bluetooth.print("AT+PWRM0"); // Desactivar modo bajo consumo
  delay(500);
  bluetooth.print("AT+ROLE0"); // Modo slave
  delay(500);

  lcd.setCursor(0,0);
  lcd.print("Fitness Ready!");
  lcd.setCursor(0,1);
  lcd.print("BLE: Active");
  
  Serial.println("=== FITNESS ARDUINO CON HM-10 ===");
  Serial.println("Esperando comandos desde webapp...");
  
  // Secuencia de inicio con LEDs
  secuenciaInicioLEDs();
  
  delay(2000);
  showProgress();
}

void loop() {
  // --- Recibe comando desde WebApp via Bluetooth ---
  if (bluetooth.available() > 0) {
    String mensaje = bluetooth.readStringUntil('\n');
    mensaje.trim();
    
    // Debug en Serial Monitor
    Serial.println("📱 Comando BLE: " + mensaje);
    
    procesarComando(mensaje);
  }
  
  // --- MANTENER compatibilidad Serial para debug ---
  if (Serial.available() > 0) {
    String mensaje = Serial.readStringUntil('\n');
    mensaje.trim();
    
    Serial.println("💻 Comando Serial: " + mensaje);
    procesarComando(mensaje);
  }

  // --- Ejercicio activo con MPU6050 y UMBRAL ---
  if (exerciseActive) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B);
    Wire.endTransmission(false);
    Wire.requestFrom(MPU_ADDR, 6, true);

    if (Wire.available() == 6) {
      ax = Wire.read() << 8 | Wire.read();
      ay = Wire.read() << 8 | Wire.read();
      az = Wire.read() << 8 | Wire.read();

      float aTotal = sqrt((long)ax*ax + (long)ay*ay + (long)az*az) / 16384.0;
      float movimiento = fabs(aTotal - 1.0);

      // UMBRAL REDUCIDO para ejercicios cortos: movimientos más suaves cuentan
      if (movimiento > 0.05) { // Umbral más bajo (era 0.10) = más sensible
        float progresoIncremento = movimiento * baseSensibilidad * (3.0 / progressMax);
        if (progresoIncremento < 0.05) progresoIncremento = 0.05; // Incremento mínimo mayor
        progress += progresoIncremento;
        if (progress > progressMax) progress = progressMax;
      }

      // Actualiza barra LCD
      lcd.setCursor(0,1);
      for (int i = 0; i < 16; i++) {
        if (i < int((progress/progressMax)*16)) {
          lcd.write(byte(255));
        } else {
          lcd.print(" ");
        }
      }

      // Envía avance por AMBOS canales (Serial + Bluetooth)
      int porcentaje = int((progress/progressMax)*100.0);
      String progressMsg = "PROGRESO:" + String(porcentaje);
      
      // Para WebApp vía Bluetooth
      bluetooth.println(progressMsg);
      
      // Para debug vía Serial
      Serial.println(progressMsg);

      // Termina rutina al llegar a la meta
      if (progress >= progressMax) {
        exerciseActive = false;
        pausesDone++;
        
        lcd.clear();
        lcd.setCursor(0,0);
        lcd.print("Completado!");
        lcd.setCursor(0,1);
        lcd.print("Pausas: ");
        lcd.print(pausesDone);
        delay(2000);
        
        // Apagar LEDs solo al finalizar completamente
        apagarTodosLEDs();
        showProgress();
        
        // Notificar terminación por ambos canales
        bluetooth.println("TERMINADO");
        Serial.println("TERMINADO");
      }
    }
  }
  
  // Heartbeat cada 10 segundos para mantener conexión BLE
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 10000) {
    bluetooth.print("H"); // Heartbeat silencioso
    lastHeartbeat = millis();
  }
}

void procesarComando(String mensaje) {
  int sep = mensaje.indexOf(':');
  if (sep != -1) {
    ejercicio = mensaje.substring(0, sep);
    distanciaObjetivo = mensaje.substring(sep + 1).toInt();
    if (distanciaObjetivo <= 0) distanciaObjetivo = 3; // Mínimo más bajo
    progressMax = float(distanciaObjetivo);
    pausesDone = 0;
    progress = 0.0;
    exerciseActive = true;  // Inicia ejercicio directamente

    // Responder por ambos canales
    String response = "Recibido: " + ejercicio + ", objetivo: " + String(distanciaObjetivo);
    bluetooth.println(response);
    Serial.println(response);

    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("Ejercicio:");
    lcd.setCursor(0,1);
    lcd.print(ejercicio.substring(0,7));
    delay(800);
    
    // Configurar LED según el ejercicio DESPUÉS de mostrar info
    configurarLEDPorEjercicio(ejercicio);
    
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("Muevete!");
    digitalWrite(BUZZER_PIN, HIGH);
    delay(900); // Buzzer breve
    digitalWrite(BUZZER_PIN, LOW);
    
    bluetooth.println("Ejercicio iniciado.");
    Serial.println("Ejercicio iniciado.");
  }
}

void configurarLEDPorEjercicio(String ejercicio) {
  // Apagar todos los LEDs primero
  apagarTodosLEDs();
  
  // Convertir a mayúsculas para comparación
  ejercicio.toUpperCase();
  
  // Debug: mostrar exactamente qué ejercicio se recibió
  Serial.println("Ejercicio recibido: '" + ejercicio + "'");
  Serial.println("Longitud: " + String(ejercicio.length()));
  
  // Configurar LED según los 3 ejercicios específicos de tu sistema
  if (ejercicio.indexOf("CAMINATA") >= 0) {
    // CAMINATA - LED ROJO
    digitalWrite(LED_VERDE_PIN, HIGH);
    Serial.println("🟢 LED VERDE activado - CORRER");
  }
  else if (ejercicio.indexOf("CORRER") >= 0) {
    // CORRER - LED VERDE
    digitalWrite(LED_ROJO_PIN, HIGH);
    Serial.println("🔴 LED ROJO activado - CAMINATA");
  }
  else if (ejercicio.indexOf("CICLISMO") >= 0) {
    // CICLISMO - LED BLANCO
    digitalWrite(LED_BLANCO_PIN, HIGH);
    Serial.println("⚪ LED BLANCO activado - CICLISMO");
  }
  else {
    // Ejercicio no reconocido - apagar todos los LEDs
    apagarTodosLEDs();
    Serial.println("❌ Ejercicio no reconocido: '" + ejercicio + "'");
    Serial.println("Verifica que el nombre sea exactamente: CAMINATA, CORRER o CICLISMO");
  }
}

void apagarTodosLEDs() {
  digitalWrite(LED_ROJO_PIN, LOW);
  digitalWrite(LED_VERDE_PIN, LOW);
  digitalWrite(LED_BLANCO_PIN, LOW);
}

void secuenciaInicioLEDs() {
  // Secuencia de encendido al inicio para probar todos los LEDs
  Serial.println("Probando LED ROJO...");
  digitalWrite(LED_ROJO_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_ROJO_PIN, LOW);
  
  Serial.println("Probando LED VERDE...");
  digitalWrite(LED_VERDE_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_VERDE_PIN, LOW);
  
  Serial.println("Probando LED BLANCO...");
  digitalWrite(LED_BLANCO_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_BLANCO_PIN, LOW);
  
  Serial.println("Probando todos juntos...");
  // Encender todos juntos brevemente
  digitalWrite(LED_ROJO_PIN, HIGH);
  digitalWrite(LED_VERDE_PIN, HIGH);
  digitalWrite(LED_BLANCO_PIN, HIGH);
  delay(1000);
  apagarTodosLEDs();
  Serial.println("Prueba de LEDs completada");
}

void efectoFinalizacion() {
  // Efecto de parpadeo al finalizar ejercicio
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_ROJO_PIN, HIGH);
    digitalWrite(LED_VERDE_PIN, HIGH);
    digitalWrite(LED_BLANCO_PIN, HIGH);
    delay(200);
    apagarTodosLEDs();
    delay(200);
  }
}

void showProgress() {
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Esperando orden");
  lcd.setCursor(0,1);
  lcd.print("de la webapp...");
  digitalWrite(BUZZER_PIN, LOW);
  
  // Solo apagar LEDs si NO hay ejercicio activo
  if (!exerciseActive) {
    apagarTodosLEDs();
  }
}