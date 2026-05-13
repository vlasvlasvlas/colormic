# ColorMic

ColorMic es un instrumento web para performance audiovisual con microfono. La voz entra por Web Audio, se analiza en vivo y controla un campo de color full-screen: la energia cambia intensidad/luz y el pitch de la voz mueve la rampa de color.

Sitio publicado:

https://vlasvlasvlas.github.io/colormic/

## Estado actual

- App estatica: `HTML + CSS + JS`, sin build step.
- Pensada para GitHub Pages.
- Canvas full-screen con fondo negro/blanco seleccionable.
- Sidebar ocultable para configuracion.
- Presets YAML para color y sonido.
- Procesamiento de audio con filtro, compresor, reverb, delay y LFO.
- Controles live para sensibilidad del mic, intensidad de color y capas graficas.

## Uso

1. Abrir la app.
2. Click en `MIC`.
3. Aceptar permiso de microfono.
4. Hablar, cantar o emitir sonido.
5. Abrir el sidebar con el boton de menu para ajustar controles.

El microfono funciona en `localhost` o en HTTPS. Por eso GitHub Pages funciona, y abrir el archivo local directamente como `file://` puede fallar por permisos o por carga de YAML.

## Controles live

- `MIC`: prende o apaga la entrada de microfono.
- `B/W`: alterna fondo negro/blanco.
- `?`: abre informacion y link al repo.
- `Mic sensitivity`: escala la respuesta visual al volumen del microfono.
- `Color intensity`: sube o baja la presencia del color.
- `Piso Hz` / `Techo Hz`: rango de frecuencias que se mapea al degrade vocal.
- `Piso voz`: color usado para frecuencias graves de la voz.
- `Techo voz`: color usado para frecuencias agudas de la voz.
- `Color blend`: prende/apaga el campo principal de color.
- `Bloom`: prende/apaga halos de color.
- `Waveform`: prende/apaga la forma de onda.

## Mapeo audiovisual

- `RMS`: energia/volumen de la senal.
- `Pitch`: frecuencia fundamental estimada de la voz.
- `Voice Hz`: frecuencia usada para la rampa de color. Combina pitch tonal y energia espectral de la voz.
- `Flux`: cambio espectral entre frames.

El color principal usa `Voice Hz`, una frecuencia vocal calculada desde pitch tonal y energia espectral. La rampa va de `Piso voz` a `Techo voz` dentro del rango configurable `Piso Hz` / `Techo Hz`. El default es `60-4000 Hz`: grave se acerca al color piso, agudo se acerca al color techo. La energia (`RMS`) aumenta luz, saturacion y tamano de los gradientes.

## Presets

Color:

- `presets/colors/oceanic.yaml`
- `presets/colors/magma.yaml`

Sonido:

- `presets/sound/ambient_glass.yaml`
- `presets/sound/ritual_echo.yaml`

Los YAML se cargan en el sidebar y se pueden editar en vivo. Usar `Apply` para aplicar cambios manuales.

Ejemplo de color:

```yaml
name: Oceanic Flux

# Opciones: lab, rgb, hsl, hsv, hcl.
interpolation: lab

voice_range:
  floor_hz: 60
  ceiling_hz: 4000
  floor_color: "#2447ff"
  ceiling_color: "#ffcf4a"

reactivity:
  energy_to_brightness: 0.65
  centroid_to_hue_shift: 0.4
```

Ejemplo de sonido:

```yaml
name: Ambient Glass
input_gain: 1.0
master_gain: 0.8
filter:
  # Opciones: lowpass, highpass, bandpass, lowshelf, highshelf, peaking, notch, allpass.
  type: lowpass
  frequency: 6800
  q: 0.7
reverb:
  seconds: 2.8
  decay: 2.5
  pre_delay_ms: 35
  mix: 0.45
delay:
  time_s: 0.38
  feedback: 0.35
  mix: 0.28
lfo:
  enabled: true
  # Opciones target: filter.frequency, master_gain.
  target: filter.frequency
  # Opciones waveform: sine, square, sawtooth, triangle.
  waveform: sine
  frequency_hz: 0.17
  amount: 1800
```

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
chroma.js
js-yaml.min.js
presets/
  colors/
  sound/
.github/workflows/pages.yml
```

## Notas tecnicas

- `app.js` contiene el motor de audio, analisis, render y UI.
- `chroma.js` se usa para interpolacion de color.
- `js-yaml.min.js` esta vendorizado para evitar depender de CDN.
- No requiere Node, bundler ni instalacion de paquetes para correr.
