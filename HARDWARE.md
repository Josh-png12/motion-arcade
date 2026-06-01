# Lista de Hardware — Motion Arcade

## Componentes del ESP32

| Componente | Especificación | Cantidad | Precio aprox. |
|------------|---------------|----------|---------------|
| ESP32 DevKit V1 | 38 pines, WiFi+BT | 1 | $4-8 USD |
| Protoboard | 830 puntos | 1 | $3-5 USD |
| LED Verde | 5mm, 2.1V forward | 1 | $0.10 USD |
| LED Rojo | 5mm, 2.0V forward | 1 | $0.10 USD |
| LED Azul | 5mm, 3.2V forward | 1 | $0.15 USD |
| LED Amarillo | 5mm, 2.1V forward | 1 | $0.10 USD |
| Resistencia | 220Ω, 1/4W, 5% | 4 | $0.05/c | 
| Cables M-M | 10cm, colores | 10 | $0.50 |
| Cables M-F | 10cm, colores | 5 | $0.30 |
| Cable USB | Micro-USB | 1 | $2-3 USD |

**Total estimado**: ~$12-18 USD

## Especificaciones del ESP32 DevKit V1

- Microcontrolador: Xtensa LX6 dual-core 240MHz
- RAM: 520KB SRAM
- Flash: 4MB
- WiFi: 802.11 b/g/n (2.4GHz)
- Bluetooth: BT 4.2 + BLE
- Pines GPIO: 34 (18 con ADC, 2 con DAC)
- Alimentación: 3.3V (lógica), 5V (USB)
- Corriente máxima por pin: 40mA
- Dimensiones: 55mm × 26mm

## Cálculo de resistencias

Con la ley de Ohm: R = (Vcc - Vf) / If

| LED | Vforward | Corriente target | Resistencia calculada | Valor comercial |
|-----|----------|------------------|-----------------------|-----------------|
| Verde | 2.1V | 15mA | (3.3-2.1)/0.015 = 80Ω | **220Ω** (seguro) |
| Rojo | 2.0V | 15mA | (3.3-2.0)/0.015 = 87Ω | **220Ω** |
| Azul | 3.2V | 15mA | (3.3-3.2)/0.015 = 7Ω | **220Ω** (limitará corriente) |
| Amarillo | 2.1V | 15mA | (3.3-2.1)/0.015 = 80Ω | **220Ω** |

> Nota: 220Ω es conservador para el LED azul (reduce brillo), pero es seguro
> y simplifica usar la misma resistencia para todos los LEDs.

## Para la demostración en feria

### Setup mínimo (solo web)
- Celular con cámara frontal y Chrome/Safari
- TV o monitor con conexión HDMI para el celular

### Setup completo (con ESP32)
- Todo lo anterior
- ESP32 con circuito de LEDs montado en protoboard
- Alimentado por USB desde cualquier cargador

### Conexión a pantalla grande
- Android: cable USB-C a HDMI + adaptador, o Chromecast
- iPhone: cable Lightning a HDMI
- Laptop: abrir la app y conectar por HDMI directamente

## Alternativas de componentes

Si no consigues el ESP32 DevKit V1 exacto:
- ESP32-WROOM-32 en cualquier breakout board funciona igual
- NodeMCU-32S es compatible pin-a-pin
- ESP32-S2 o ESP32-S3 también son compatibles con este firmware
