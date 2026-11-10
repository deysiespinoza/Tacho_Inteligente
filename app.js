// Tacho Inteligente — clasificación 100 % en el celular (TensorFlow.js)
const IMG = 224;       // tamaño de entrada del modelo
const UMBRAL = 0.60;   // por debajo se pide otra foto

// ---------- Datos de presentación por clase ----------
const NOMBRES = { plastico:'Plástico', papel_carton:'Papel y cartón', vidrio:'Vidrio', metal:'Metal',
                  organico:'Orgánico', peligroso:'Peligroso', otros:'Otros' };
const BINS = {
  plastico:     { nombre:'BLANCO',   g:['#f3f5fa','#bcc5d8'], txt:'#2a2f3d', ej:'Botellas, bolsas y envases', dot:'#c5cde0' },
  papel_carton: { nombre:'AZUL',     g:['#5aa0ee','#2e63cf'], txt:'#ffffff', ej:'Cajas, periódicos y cartón',  dot:'#3f79de' },
  vidrio:       { nombre:'VERDE',    g:['#4ccf9f','#1f9d78'], txt:'#ffffff', ej:'Botellas y frascos de vidrio', dot:'#2fb88a' },
  metal:        { nombre:'AMARILLO', g:['#ffd04a','#ff9f1c'], txt:'#3a2a00', ej:'Latas, tapas y envases metálicos', dot:'#ffb52e' },
  organico:     { nombre:'MARRÓN',   g:['#bd8a5b','#7d4f2c'], txt:'#ffffff', ej:'Restos de comida, cáscaras y hojas', dot:'#9a6a3f' },
  peligroso:    { nombre:'ROJO',     g:['#ff7a7a','#d93a3a'], txt:'#ffffff', ej:'Pilas, baterías y aparatos electrónicos', dot:'#e24b4b' },
  otros:        { nombre:'NEGRO',    g:['#5b6072','#23262f'], txt:'#ffffff', ej:'Zapatos, ropa y residuos no aprovechables', dot:'#3a3e4b' },
};
const ORDEN = ['plastico', 'papel_carton', 'vidrio', 'metal', 'organico', 'peligroso', 'otros'];

// ---------- Mascotas (SVG propios, una forma por tipo de residuo) ----------
const FORMAS = {
  plastico:     { c:'#6f8fd6', fy:2,  d:'<polygon points="50,10 90,40 75,88 25,88 10,40"/>' },
  papel_carton: { c:'#f5a623', fy:0,  d:'<rect x="12" y="12" width="76" height="76" rx="22"/>' },
  vidrio:       { c:'#38c4b2', fy:0,  d:'<polygon points="50,8 92,50 50,92 8,50"/>' },
  metal:        { c:'#f2c230', fy:16, d:'<polygon points="50,12 90,84 10,84"/>' },
  organico:     { c:'#7bc96f', fy:0,  d:'<ellipse cx="50" cy="52" rx="42" ry="38"/>' },
  peligroso:    { c:'#ef6a4c', fy:0,  d:'<circle cx="50" cy="50" r="42"/>' },
  otros:        { c:'#d98bb6', fy:2,  d:'<circle cx="34" cy="56" r="24"/><circle cx="62" cy="50" r="27"/><circle cx="50" cy="68" r="22"/>' },
};
const EXPR_DEF = { peligroso:'alerta', otros:'sueno' };

function mascota(clase, tam = 80, expr) {
  const f = FORMAS[clase] || FORMAS.otros;
  expr = expr || EXPR_DEF[clase] || 'feliz';
  const T = '#1a1a1a', ojo = (x) => `<circle cx="${x}" cy="50" r="6" fill="${T}"/><circle cx="${x + 2}" cy="48" r="2" fill="#fff"/>`;
  let cara;
  if (expr === 'alerta')
    cara = `<circle cx="38" cy="50" r="7" fill="${T}"/><circle cx="62" cy="50" r="7" fill="${T}"/><circle cx="40" cy="48" r="2.4" fill="#fff"/><circle cx="64" cy="48" r="2.4" fill="#fff"/><ellipse cx="50" cy="67" rx="5" ry="6" fill="${T}"/>`;
  else if (expr === 'sueno')
    cara = `<path d="M31 51 Q38 58 45 51 M55 51 Q62 58 69 51" stroke="${T}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M41 64 Q50 72 59 64" stroke="${T}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  else if (expr === 'duda')
    cara = `${ojo(38)}${ojo(62)}<path d="M42 67 Q50 62 58 67" stroke="${T}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  else
    cara = `${ojo(38)}${ojo(62)}<path d="M41 63 Q50 72 59 63" stroke="${T}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 100 100" width="${tam}" height="${tam}" aria-hidden="true">
    <g fill="${f.c}" stroke="${f.c}" stroke-width="8" stroke-linejoin="round">${f.d}</g>
    <g transform="translate(0 ${f.fy})">${cara}</g></svg>`;
}

// ---------- Utilidades ----------
const $ = id => document.getElementById(id);
const video = $('video'), foto = $('foto'), lienzo = $('lienzo'), ctx = lienzo.getContext('2d', { willReadFrequently: true });
let modelo = null, meta = null, stream = null, facing = 'environment', timer = null, ocupado = false;

function leer(k, def) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
function guardarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function estado(t) { $('estado').textContent = t; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------- Modelo y cámara ----------
async function cargarModelo() {
  try {
    meta = await (await fetch('model/metadata.json')).json();
    modelo = await tf.loadGraphModel('model/model.json');
    tf.tidy(() => { modelo.predict(tf.zeros([1, IMG, IMG, 3])); });   // calentamiento
    estado('Modelo listo — funciona sin internet');
    pintarAcerca();
  } catch (e) {
    estado('⚠️ No se pudo cargar el modelo. ¿Copiaste los archivos en la carpeta model/? ' + e.message);
  }
}

async function iniciarCamara() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  } catch (e) { estado('⚠️ No se pudo abrir la cámara: ' + e.message); return; }
  video.srcObject = stream; video.hidden = false; foto.hidden = true; $('visor').dataset.vacio = '0';
  await video.play();
  $('btnClasificar').disabled = $('btnAuto').disabled = $('btnGirar').disabled = false;
  $('btnCam').textContent = 'Cámara activa';
}

function detenerCamara() {
  detenerVivo();
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.hidden = true; $('visor').dataset.vacio = foto.hidden ? '1' : '0';
  $('btnClasificar').disabled = $('btnAuto').disabled = $('btnGirar').disabled = true;
  $('btnCam').textContent = 'Activar cámara';
}

// Recorte central cuadrado + resize (igual que en el entrenamiento)
async function predecir(fuente) {
  const w = fuente.videoWidth || fuente.naturalWidth, h = fuente.videoHeight || fuente.naturalHeight;
  if (!w || !h) return null;
  const s = Math.min(w, h);
  lienzo.width = lienzo.height = IMG;
  ctx.drawImage(fuente, (w - s) / 2, (h - s) / 2, s, s, 0, 0, IMG, IMG);
  const salida = tf.tidy(() => {
    const x = tf.browser.fromPixels(lienzo).toFloat().expandDims(0);   // valores 0-255
    let y = modelo.predict(x);
    if (Array.isArray(y)) y = y[0];
    return y.squeeze();
  });
  const p = Array.from(await salida.data()); salida.dispose();
  return p;
}

// ---------- Resultado ----------
function placeholderResultado() {
  $('resultado').innerHTML = `<div class="res">${mascota('papel_carton', 74, 'duda')}
    <div class="txt"><h2 style="font-size:1.15rem">¿Qué residuo tienes?</h2>
    <p class="peq" style="color:var(--suave)">Activa la cámara o sube una foto, y muéstralo dentro del recuadro.</p></div></div>`;
}

function mostrar(p, guardar) {
  const clases = meta.clases;
  const idx = p.map((v, i) => i).sort((a, b) => p[b] - p[a]).slice(0, 3);
  const c = clases[idx[0]], conf = p[idx[0]], pct = Math.round(conf * 100);
  const nombre = NOMBRES[c] || c;
  const top3 = idx.map(i => `<div><span>${esc(NOMBRES[clases[i]] || clases[i])}</span><div class="barra" style="background:rgba(120,120,120,.2)"><i style="width:${p[i] * 100}%"></i></div><span>${Math.round(p[i] * 100)}%</span></div>`).join('');
  let html;
  const chip = $('chip'); chip.hidden = false;
  if (conf < UMBRAL) {
    chip.style.background = 'rgba(30,20,50,.85)'; chip.style.color = '#fff';
    const bq = BINS[c];
    chip.innerHTML = `<span>🤔 Quizá ${esc(nombre)}${bq ? ' → ' + esc(bq.nombre.toLowerCase()) : ''}</span><span>${pct} %</span>`;
    html = `<div class="res">${mascota('otros', 78, 'duda')}
      <div class="txt"><p class="peq" style="color:var(--suave)">Mejor otra foto</p>
      <h2>No estoy seguro (${pct} %)</h2>
      <p style="margin:4px 0;font-weight:600">Podría ser: ${esc(nombre)}${bq ? ' → tacho ' + esc(bq.nombre.toLowerCase()) : ''}</p>
      <p class="peq" style="color:var(--suave)">Muestra el objeto completo, de cerca y con buena luz para estar seguro.</p>
      <div class="top3" style="color:var(--morado)">${top3}</div></div></div>`;
  } else {
    const b = BINS[c] || { nombre: (meta.bin_map && meta.bin_map[c]) || '—', g: ['#7b4fd0', '#b48cf0'], txt: '#fff', ej: '' };
    html = `<div class="res" style="background:linear-gradient(135deg,${b.g[0]},${b.g[1]});color:${b.txt}">
      <div class="txt"><p class="peq">${esc(nombre)} · ${pct} % de seguridad</p>
      <h2>Va al tacho ${esc(b.nombre)}</h2>
      <p class="peq">${esc(b.ej)}</p>
      <div class="barra"><i style="width:${pct}%"></i></div>
      <div class="top3">${top3}</div></div>
      ${mascota(c, 84)}</div>`;
    chip.style.background = `linear-gradient(135deg,${b.g[0]},${b.g[1]})`; chip.style.color = b.txt;
    chip.innerHTML = `<span>${esc(nombre)} → Tacho ${esc(b.nombre)}</span><span>${pct} %</span>`;
    if (guardar) { registrar(c, conf); }
  }
  $('resultado').innerHTML = html;
  if (guardar) $('resultado').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function clasificarFuente(fuente, guardar) {
  if (!modelo || ocupado) return;
  ocupado = true;
  try { const p = await predecir(fuente); if (p) mostrar(p, guardar); }
  catch (e) { estado('⚠️ Error al clasificar: ' + e.message); }
  ocupado = false;
}

function detenerVivo() { if (timer) { clearInterval(timer); timer = null; } $('btnAuto').textContent = 'Modo en vivo'; }

// ---------- Historial (guardado solo en este celular) ----------
function registrar(clase, conf) {
  const h = leer('tacho_hist', []);
  h.unshift({ t: Date.now(), c: clase, p: Math.round(conf * 100) });
  guardarLS('tacho_hist', h.slice(0, 200));
  pintarHeroHist();
}
function esHoy(t) { return new Date(t).toDateString() === new Date().toDateString(); }

function pintarFecha() {
  const f = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  $('fecha').innerHTML = `Hola 👋<small>${f.charAt(0).toUpperCase() + f.slice(1)}</small>`;
}
function pintarHero() {
  const hoy = leer('tacho_hist', []).filter(x => esHoy(x.t)).length;
  $('heroTxt').innerHTML = `<b>¡Cuidemos el planeta!</b><span>${hoy === 0 ? 'Aún no has clasificado nada hoy. ¡Empieza!' : `Hoy clasificaste ${hoy} residuo${hoy === 1 ? '' : 's'}. ¡Sigue así!`}</span>`;
  $('heroMasc').innerHTML = mascota('organico', 74);
}
function pintarHeroHist() { pintarHero(); pintarHist(); }

function pintarTachos() {
  $('gridTachos').innerHTML = ORDEN.map(c => {
    const b = BINS[c];
    return `<div class="tc" style="background:linear-gradient(135deg,${b.g[0]},${b.g[1]});color:${b.txt}">
      <div class="chip" style="background:${b.dot}"></div>
      <h3>${NOMBRES[c]}</h3><small>Tacho ${b.nombre.toLowerCase()}</small>
      ${mascota(c, 62)}<div class="ej">${b.ej}</div></div>`;
  }).join('');
}

function pintarHist() {
  const h = leer('tacho_hist', []);
  const cont = {}; h.forEach(x => cont[x.c] = (cont[x.c] || 0) + 1);
  $('histTipos').innerHTML = ORDEN.map(c =>
    `<div class="it"><span class="d" style="background:${BINS[c].dot}"></span>${NOMBRES[c]}<span class="n">${cont[c] || 0}</span></div>`).join('');
  $('histRec').innerHTML = h.length ? h.slice(0, 10).map(x => {
    const f = new Date(x.t), hora = f.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const dia = esHoy(x.t) ? 'Hoy' : f.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
    return `<div class="it">${mascota(x.c, 34)}<div>${NOMBRES[x.c] || x.c} <small>· ${x.p} %</small><br><small>${dia}, ${hora}</small></div><span class="n">Tacho ${(BINS[x.c] || {}).nombre ? BINS[x.c].nombre.toLowerCase() : ''}</span></div>`;
  }).join('') : '<div class="vacio">Aún no hay clasificaciones guardadas.</div>';
}

function pintarAcerca() {
  $('acercaMasc').innerHTML = mascota('plastico', 90);
  if (!meta) return;
  $('acercaModelo').innerHTML = `<b>Modelo:</b> ${esc(meta.modelo || '—')} · versión ${esc(meta.version || '—')} · ${meta.clases.length} clases`;
  $('acercaDatos').innerHTML = (meta.datasets || []).map(d => `<li>${esc(d)}</li>`).join('');
}

// ---------- Navegación ----------
function irA(v) {
  document.querySelectorAll('.vista').forEach(s => s.classList.toggle('activa', s.id === 'v-' + v));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v !== 'scan') detenerCamara();
  if (v === 'hist') pintarHist();
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav button').forEach(b => b.onclick = () => irA(b.dataset.v));

// ---------- Eventos de escaneo ----------
$('btnCam').onclick = iniciarCamara;
$('btnClasificar').onclick = () => clasificarFuente(video, true);
$('btnGirar').onclick = () => { facing = facing === 'environment' ? 'user' : 'environment'; iniciarCamara(); };
$('btnAuto').onclick = () => {
  if (timer) { detenerVivo(); return; }
  $('btnAuto').textContent = 'Detener';
  timer = setInterval(() => { if (!video.hidden) clasificarFuente(video, false); }, 900);   // en vivo no guarda historial
};
$('archivo').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  detenerCamara();
  foto.onload = () => { foto.hidden = false; $('visor').dataset.vacio = '0'; clasificarFuente(foto, true); };
  foto.src = URL.createObjectURL(f);
  e.target.value = '';
};
$('btnBorrar').onclick = () => { if (confirm('¿Borrar todo el historial de este celular?')) { guardarLS('tacho_hist', []); pintarHeroHist(); } };

// ---------- Onboarding (solo la primera vez) ----------
function iniciarOnboarding() {
  // mascotas de la portada
  const posiciones = [['plastico', 8, 90, 96], ['organico', 110, 20, 84], ['papel_carton', 205, 70, 90], ['vidrio', 60, 0, 80],
                      ['metal', 275, 8, 78], ['peligroso', 150, 100, 76], ['otros', 235, 130, 80]];
  $('nube').innerHTML = posiciones.map(([c, x, y, t]) => `<div style="position:absolute;left:${x}px;top:${y}px">${mascota(c, t)}</div>`).join('');
  $('blob1').innerHTML = mascota('plastico', 150);
  $('blob2').innerHTML = mascota('organico', 150);
  if (leer('tacho_onb', false)) return;
  $('onb').hidden = false;
  const slides = document.querySelectorAll('#onb .slide'), pts = document.querySelectorAll('#puntos i');
  let k = 0;
  $('btnSig').onclick = () => {
    if (k < slides.length - 1) {
      slides[k].classList.remove('activa'); k++; slides[k].classList.add('activa');
      pts.forEach((p, i) => p.classList.toggle('on', i === k));
      if (k === slides.length - 1) $('btnSig').textContent = 'Comenzar';
    } else { guardarLS('tacho_onb', true); $('onb').hidden = true; }
  };
}

// ---------- Arranque ----------
pintarFecha(); pintarHero(); pintarTachos(); pintarHist(); pintarAcerca(); placeholderResultado(); iniciarOnboarding();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
cargarModelo();
