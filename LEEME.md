# 📱 Tacho Inteligente — app móvil instalable (PWA)

Es una **app web instalable**: se abre desde un enlace, se instala en la pantalla de inicio como cualquier app,
usa la cámara del celular y **clasifica sin internet** (el modelo corre dentro del teléfono).

## 1. Obtener el modelo web
En el notebook, ejecuta la celda **12.4** (al final). Descarga `web_model.zip`; descomprímelo y copia su contenido
en la carpeta `model/` de este proyecto (`model.json`, los `.bin` y `metadata.json`).

## 2. Probar en tu laptop
    py -3.11 -m http.server 8000
y abre http://localhost:8000 (la cámara funciona en `localhost`). **Prueba una imagen del test** y compara con la
predicción que imprimió el notebook: debe dar la misma clase. Si no coincide, avísame (es el punto más delicado de la conversión).

## 3. Publicarla (necesario para el celular)
La cámara y la instalación solo funcionan con **HTTPS**. Sube esta carpeta a un hosting gratis con HTTPS
(por ejemplo GitHub Pages o Netlify) y abre el enlace en el celular.

## 4. Instalarla en el celular
- **Android (Chrome):** menú ⋮ → *Instalar app* / *Añadir a la pantalla de inicio*.
- **iPhone (Safari):** botón Compartir → *Añadir a pantalla de inicio*.
La primera vez necesita internet para descargar la app y el modelo; después funciona sin conexión.

## 5. ¿Un .apk real?
Una PWA publicada se puede empaquetar como paquete Android con herramientas como PWABuilder (pwabuilder.com).
No lo he probado; revisa su documentación actual.
