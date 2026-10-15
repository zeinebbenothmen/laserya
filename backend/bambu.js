/**
 * bambu.js — Suivi d'état des imprimantes Bambu Lab via MQTT LOCAL (lecture seule).
 *
 * Chaque imprimante expose un broker MQTT sur son IP locale (port 8883, TLS).
 *   • utilisateur : "bblp"   • mot de passe : code d'accès LAN (écran imprimante)
 *   • on s'abonne à  device/<serial>/report  et on demande un "pushall" complet.
 * On garde en cache le dernier état (avancement, températures, temps restant…).
 *
 * ⚠️ Le serveur doit être sur le MÊME réseau local que les imprimantes.
 *    En production hébergée, il faudrait l'API cloud Bambu ou un agent local.
 */
const mqtt = require('mqtt');

const conns = new Map(); // serial -> { cfg, client, print:{}, connected, lastSeen, error }

function connect(c) {
  const { host, serial, access_code } = c.cfg;
  let client;
  try {
    client = mqtt.connect(`mqtts://${host}:8883`, {
      username: 'bblp',
      password: access_code,
      rejectUnauthorized: false,      // certificat auto-signé de l'imprimante
      reconnectPeriod: 8000,
      connectTimeout: 8000,
      clientId: 'laserya_' + Math.random().toString(16).slice(2, 8),
    });
  } catch (e) { c.error = e.message; return; }
  c.client = client;

  client.on('connect', () => {
    c.connected = true; c.error = null;
    client.subscribe(`device/${serial}/report`, () => {});
    // Demande l'état complet (sinon on ne reçoit que des deltas)
    client.publish(`device/${serial}/request`,
      JSON.stringify({ pushing: { sequence_id: '0', command: 'pushall' } }));
  });
  client.on('message', (_topic, buf) => {
    try {
      const data = JSON.parse(buf.toString());
      if (data && data.print) { Object.assign(c.print, data.print); c.lastSeen = Date.now(); }
    } catch { /* message non-JSON ignoré */ }
  });
  client.on('error',   (e) => { c.error = e.message; });
  client.on('close',   () => { c.connected = false; });
  client.on('offline', () => { c.connected = false; });
}

function ensure(cfg) {
  let c = conns.get(cfg.serial);
  if (c) { c.cfg = cfg; return c; }
  c = { cfg, print: {}, connected: false, lastSeen: 0, error: null };
  conns.set(cfg.serial, c);
  connect(c);
  return c;
}

function disconnect(serial) {
  const c = conns.get(serial);
  if (c && c.client) { try { c.client.end(true); } catch {} }
  conns.delete(serial);
}

const STATE_FR = {
  IDLE: 'Au repos', PREPARE: 'Préparation', SLICING: 'Découpe',
  RUNNING: 'En impression', PAUSE: 'En pause', FINISH: 'Terminée',
  FAILED: 'Échec', OFFLINE: 'Hors ligne',
};

// État formaté (pour le front) d'une imprimante configurée
function statusFor(cfg) {
  const c = conns.get(cfg.serial);
  const p = (c && c.print) || {};
  const online = !!(c && c.connected);
  const state  = online ? (p.gcode_state || 'IDLE') : 'OFFLINE';
  return {
    id: cfg.id, name: cfg.name, model: cfg.model || '', host: cfg.host, serial: cfg.serial,
    online,
    error: c ? c.error : null,
    state,
    state_label: STATE_FR[state] || state,
    progress:      Math.round(Number(p.mc_percent) || 0),
    remaining_min: Math.round(Number(p.mc_remaining_time) || 0),
    layer:         Number(p.layer_num) || 0,
    total_layers:  Number(p.total_layer_num) || 0,
    job:           p.subtask_name || p.gcode_file || '',
    nozzle_temp:   Math.round(Number(p.nozzle_temper) || 0),
    nozzle_target: Math.round(Number(p.nozzle_target_temper) || 0),
    bed_temp:      Math.round(Number(p.bed_temper) || 0),
    bed_target:    Math.round(Number(p.bed_target_temper) || 0),
    last_seen:     c ? c.lastSeen : 0,
  };
}

// Réconcilie les connexions avec la liste configurée (ajoute/retire au besoin)
function reload(printers = []) {
  const wanted = new Set(printers.map(p => p.serial));
  for (const serial of [...conns.keys()]) if (!wanted.has(serial)) disconnect(serial);
  for (const p of printers) ensure(p);
}

module.exports = { ensure, disconnect, statusFor, reload };
