# ColorMic

ColorMic es un instrumento web para performance audiovisual con micrófono. La voz entra por Web Audio, se analiza en vivo y controla métricas visuales reactivas (flash, barras EQ, formas de onda). 

Incluye efectos de síntesis en tiempo real: Filtro, Compresor, Reverb, Delay rítmico (con Tap Tempo), LFO, y Ring Modulator (efecto robótico).

Sitio publicado:

https://vlasvlasvlas.github.io/colormic/

## Estado actual

- App estática: `HTML + CSS + JS`, sin build step.
- Pensada para GitHub Pages.
- Interfaz renovada con panel lateral lleno de controles visuales (sliders, toggles, color pickers) para todos los parámetros de Sonido y Color.
- Parámetros avanzados en formato YAML disponibles bajo secciones colapsables (`<details>`).
- Efectos de síntesis extra: Ring Modulator (efecto robótico), y Tap Tempo con selector de subdivisión para el Delay.
- Motor visual nítido y rápido: fondo "flash" directo, EQ bars, línea de frecuencia y forma de onda HD.

## Uso

1. Abrir la app.
2. Click en `MIC`.
3. Aceptar permiso de micrófono.
4. Hablar, cantar o emitir sonido.
5. Abrir el sidebar con el botón de menú `≡` para ajustar todos los efectos en vivo.

El micrófono funciona en `localhost` o en HTTPS. Por eso GitHub Pages funciona, y abrir el archivo local directamente como `file://` puede fallar por permisos o carga de presets (fetch).

## Sidebar y Controles

El panel lateral agrupa controles en dos grandes categorías:

### 1. Visual y Color
- **Métricas:** Muestra `Frecuencia` (Hz), `Nota` musical (ej. A4) y `Volumen` (%).
- **Rango de Voz:** Define qué rango de frecuencias (Piso Hz / Techo Hz) mapea a qué colores (Piso / Techo).
- **Interpolación & Brillo:** Controla el espacio de color (ej. LAB, HSL) y cuánto el volumen afecta el brillo.
- **Toggles visuales:** 
  - `Color flash`: Tintes sólidos sobre el fondo reaccionando a la frecuencia.
  - `Barras EQ`: Espectrograma en la base.
  - `Onda`: Representación lineal de la onda de audio.

### 2. Sonido y Efectos
- **Filtro:** Tipo (lowpass, highpass, bandpass, etc), frecuencia de corte y resonancia (Q).
- **Delay y Reverb:** Mix, tiempo, cola y repeticiones.
- **Tap Tempo:** Un botón `TAP` que permite sincronizar el Delay al ritmo deseado con varias subdivisiones musicales (1/4, 1/8, etc).
- **LFO:** Modula el filtro o el master gain a distintas formas de onda y velocidades.
- **Fx Voz — Robot:** Un "Ring Modulator" que multiplica tu voz con un oscilador portador para lograr timbres metálicos y sintetizados.

## Presets y YAML avanzado

Los dropdowns superiores cargan presets predefinidos. Toda la configuración visual se sincroniza en ambas direcciones:
- Si mueves un slider de sonido/color, el cambio es instantáneo.
- Si abres las opciones **"YAML avanzado"** verás el estado actual serializado. 
- Puedes editar el YAML a mano y al tocar el botón `Apply` del panel, todo se actualizará.

Color presets: `presets/colors/*.yaml`
Sound presets: `presets/sound/*.yaml`

## Local

```bash
python3 -m http.server 5174
```

Abrir:

```text
http://localhost:5174/
```

## Deploy

El deploy corre con GitHub Actions:

```text
.github/workflows/pages.yml
```

Cada push a `master` publica el sitio en GitHub Pages.

## Estructura

```text
index.html
styles.css
app.js
js/
  chroma.js
  js-yaml.min.js
presets/
  colors/
  sound/
.github/workflows/pages.yml
```

## Notas técnicas

- `app.js` contiene todo el motor: cadena de Web Audio, renderizado de canvas y lógica UI de sincronización con YAML.
- `js/chroma.js` y `js/js-yaml.min.js` están vendorizados para no depender de internet/CDN en vivo.
- El Ring Modulator se logró ruteando un `GainNode` controlado por un `OscillatorNode` antes del dry-gain general.
- No requiere Node, bundler ni instalación de paquetes para correr.
