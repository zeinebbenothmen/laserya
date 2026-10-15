const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { computeEstimate, SIZE_LABELS, TYPE_LABELS } = require('../print-estimate');
const { parseSTL, scaleToRequestedSize } = require('../stl-analysis');
const { analyzePrintRequest, analyzeModelUrl } = require('../ai-print-estimate');

const router = express.Router();
getDb().exec(`CREATE TABLE IF NOT EXISTS print3d_price_quotes (
  id TEXT PRIMARY KEY,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  consumed_order_id TEXT DEFAULT ''
)`);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `3d_${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /stl|obj|3mf|jpeg|jpg|png/;
    const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
    cb(null, allowed.test(ext));
  }
});

const DRAFT_DIR = path.join(__dirname, '../uploads/_print_estimate_drafts');
fs.mkdirSync(DRAFT_DIR, { recursive: true });
for (const name of fs.readdirSync(DRAFT_DIR)) {
  const filePath = path.join(DRAFT_DIR, name);
  try { if (Date.now() - fs.statSync(filePath).mtimeMs > 60 * 60 * 1000) fs.unlinkSync(filePath); } catch {}
}
const pendingEstimates = new Map();
const draftStorage = multer.diskStorage({
  destination: DRAFT_DIR,
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
});
const estimateUpload = multer({
  storage: draftStorage,
  limits: { fileSize: 50 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'stl' && ext === '.stl') return cb(null, true);
    if (file.fieldname === 'referenceImage' && ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return cb(null, true);
    cb(new Error(file.fieldname === 'stl' ? 'Le modèle doit être un fichier STL.' : 'La photo doit être au format JPG, PNG ou WEBP.'));
  },
});

function removeDraft(entry) {
  for (const file of Object.values(entry.files || {})) {
    try { fs.unlinkSync(file.path); } catch {}
  }
}

function pruneDrafts() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, entry] of pendingEstimates) {
    if (entry.createdAt < cutoff) {
      removeDraft(entry);
      pendingEstimates.delete(id);
    }
  }
}
const draftPruner = setInterval(pruneDrafts, 10 * 60 * 1000);
draftPruner.unref?.();

function priceGeometry({ volumeCm3, options, complexityFactor }) {
  const materials = {
    PLA:  { density: 1.24, costPerGram: 0.075 },
    PETG: { density: 1.27, costPerGram: 0.090 },
    ABS:  { density: 1.04, costPerGram: 0.085 },
    TPU:  { density: 1.21, costPerGram: 0.130 },
  };
  const layerSpeed = { '0.08': 1.75, '0.12': 1.4, '0.20': 1, '0.28': 0.86 };
  const material = materials[options.material];
  const precisionFactor = layerSpeed[options.layerHeight];
  const effectiveVolume = Math.max(0.2, volumeCm3 * 0.24); // parois + remplissage moyen
  const grams = Math.max(1, effectiveVolume * material.density);
  const printHours = Math.max(0.35, (grams / 8) * precisionFactor + volumeCm3 / 300);
  const materialCost = grams * material.costPerGram;
  const machineAndSetup = 10 + printHours * 4.5;
  const colorFactor = options.multicolor ? 1.28 : 1;
  const quantity = options.quantity;
  const quantityFactor = quantity >= 25 ? 0.82 : quantity >= 10 ? 0.9 : quantity >= 5 ? 0.95 : 1;
  const unitPrice = Math.max(12, (materialCost + machineAndSetup) * complexityFactor * colorFactor * quantityFactor);
  const roundedUnit = Math.ceil(unitPrice * 2) / 2;
  return {
    unitPrice: roundedUnit,
    totalPrice: Math.ceil(roundedUnit * quantity * 2) / 2,
    materialGrams: Math.ceil(grams),
    estimatedPrintHours: Math.round(printHours * 10) / 10,
    precisionFactor,
    colorFactor,
    quantityFactor,
  };
}

function parsePositiveDimension(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 300) return null;
  return Math.round(n * 10) / 10;
}

function parseCentimeterDimension(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0.1 || n > 30) return null;
  return Math.round(n * 10); // convert cm to mm for internal geometry and pricing
}

function parsePublicModelUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (!hostname || net.isIP(hostname) || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) return null;
    return url.toString();
  } catch { return null; }
}

function priceLinkedModel({ volumeCm3, quantity, complexityFactor }) {
  const filamentDensity = 1.24; // PLA, barème interne
  const usageRatio = 0.20; // parois et remplissage moyen, estimation atelier
  const wasteFactor = 1.12;
  const grams = Math.max(1, volumeCm3 * usageRatio * filamentDensity * wasteFactor);
  const printHours = Math.max(0.35, (grams / 8) + volumeCm3 / 300); // profil standard interne
  const filamentCostPerKg = Math.max(1, Number(process.env.PRINT3D_FILAMENT_PRICE_PER_KG) || 75);
  const printerPowerKw = Math.max(0.01, Number(process.env.PRINT3D_PRINTER_POWER_KW) || 0.12);
  const electricityPerKwh = Math.max(0, Number(process.env.PRINT3D_ELECTRICITY_TND_PER_KWH) || 0.35);
  const setupAndLabor = 10 + printHours * 2;
  const materialCost = grams * filamentCostPerKg / 1000;
  const electricityCost = printHours * printerPowerKw * electricityPerKwh;
  const profitMarkup = Math.max(0, Number(process.env.PRINT3D_PROFIT_MARKUP) || 0.45);
  const quantityFactor = quantity >= 25 ? 0.82 : quantity >= 10 ? 0.9 : quantity >= 5 ? 0.95 : 1;
  const unitPrice = Math.ceil(Math.max(12, (materialCost + electricityCost + setupAndLabor) * complexityFactor * (1 + profitMarkup) * quantityFactor) * 2) / 2;
  return {
    unitPrice,
    totalPrice: Math.ceil(unitPrice * quantity * 2) / 2,
    materialGrams: Math.ceil(grams),
    estimatedPrintHours: Math.round(printHours * 10) / 10,
  };
}

const VALID_STATUSES = ['new', 'reviewing', 'quoted', 'approved', 'printing', 'done', 'cancelled'];

function truthyNote(v) { return v === true || v === 1 || v === '1' || v === 'true'; }

// POST /api/3d-print/estimate — estimation publique (le client voit le prix avant d'envoyer)
router.post('/estimate', (req, res) => {
  res.json(computeEstimate(req.body || {}));
});

// Estimation publique à partir d'un lien de modèle consulté par la recherche web OpenAI.
router.post('/estimate/link', async (req, res) => {
  try {
    const modelUrl = parsePublicModelUrl(req.body?.model_url);
    if (!modelUrl) throw Object.assign(new Error('Saisissez un lien public valide (https://) vers une page de modèle 3D.'), { status: 400 });
    const dims = [req.body.dimension_x, req.body.dimension_y, req.body.dimension_z].map(parseCentimeterDimension);
    if (dims.some(v => v === null)) throw Object.assign(new Error('Saisissez la longueur, la largeur et la hauteur en centimètres (maximum 30 cm par côté).'), { status: 400 });
    const quantity = Math.max(1, Math.min(100, parseInt(req.body.quantity, 10) || 1));
    const ai = await analyzeModelUrl({ modelUrl, dimensionsMm: dims });
    const volumeCm3 = dims.reduce((product, value) => product * value, 1) / 1000;
    const estimate = priceLinkedModel({ volumeCm3, quantity, complexityFactor: ai.complexityFactor });
    const id = uuidv4();
    const geometry = { requestedDimensionsMm: dims, estimatedSolidVolumeCm3: Math.round(volumeCm3 * 0.2 * 100) / 100 };
    pendingEstimates.set(id, {
      createdAt: Date.now(), modelUrl, geometry,
      options: { dimensionsMm: dims, quantity }, ai, estimate,
    });
    res.json({ estimateId: id, price: estimate.totalPrice, unitPrice: estimate.unitPrice, quantity, currency: 'TND' });
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message || 'Impossible d’estimer ce modèle. Vérifiez le lien puis réessayez.' });
  }
});

// Analyse IA + géométrie STL pour le configurateur client.
router.post('/estimate/ai', estimateUpload.fields([
  { name: 'stl', maxCount: 1 },
  { name: 'referenceImage', maxCount: 1 },
]), async (req, res) => {
  const uploaded = req.files || {};
  const stlFile = uploaded.stl?.[0];
  const imageFile = uploaded.referenceImage?.[0];
  let draft;
  try {
    if (!stlFile || !imageFile) throw Object.assign(new Error('Ajoutez le fichier STL et la photo de référence.'), { status: 400 });
    if (req.body.ai_consent !== '1') throw Object.assign(new Error('Confirmez l’envoi de la photo à OpenAI pour lancer l’analyse IA.'), { status: 400 });

    const dims = [req.body.dimension_x, req.body.dimension_y, req.body.dimension_z].map(parsePositiveDimension);
    if (dims.some(v => v === null)) throw Object.assign(new Error('Saisissez les trois dimensions souhaitées en millimètres (maximum 300 mm par axe).'), { status: 400 });
    const material = ['PLA', 'PETG', 'ABS', 'TPU'].includes(req.body.material) ? req.body.material : null;
    const layerHeight = ['0.08', '0.12', '0.20', '0.28'].includes(req.body.layer_height) ? req.body.layer_height : null;
    if (!material || !layerHeight) throw Object.assign(new Error('Choisissez un filament et une précision valides.'), { status: 400 });
    const quantity = Math.max(1, Math.min(100, parseInt(req.body.quantity, 10) || 1));
    const multicolor = req.body.multicolor === '1';

    const mesh = parseSTL(fs.readFileSync(stlFile.path));
    if (mesh.meshVolumeMm3 <= 0) throw Object.assign(new Error('Le maillage STL semble ouvert ou non-manifold. Réparez-le dans votre logiciel 3D puis réessayez.'), { status: 422 });
    const scaled = scaleToRequestedSize(mesh, dims);
    const options = { dimensionsMm: dims, material, layerHeight, multicolor, quantity };
    const geometry = {
      triangleCount: mesh.triangleCount,
      sourceBoundsMm: mesh.boundsMm,
      requestedDimensionsMm: dims,
      scale: scaled.scale,
      estimatedSolidVolumeCm3: scaled.volumeCm3,
    };
    const ai = await analyzePrintRequest({
      image: { buffer: fs.readFileSync(imageFile.path), mimetype: imageFile.mimetype },
      geometry,
      options,
    });
    const estimate = priceGeometry({ volumeCm3: scaled.volumeCm3, options, complexityFactor: ai.complexityFactor });
    const id = uuidv4();
    draft = { createdAt: Date.now(), files: { stl: stlFile, referenceImage: imageFile }, geometry, options, ai, estimate };
    pendingEstimates.set(id, draft);

    res.json({
      estimateId: id,
      price: estimate.totalPrice,
      unitPrice: estimate.unitPrice,
      currency: 'TND',
      quantity,
      geometry,
      materialGrams: estimate.materialGrams,
      estimatedPrintHours: estimate.estimatedPrintHours,
      ai: { objectSummary: ai.objectSummary, printability: ai.printability, productionNotes: ai.productionNotes },
      disclaimer: 'Prix estimatif basé sur les informations fournies; l’atelier confirme la faisabilité avant la fabrication.',
    });
  } catch (error) {
    if (draft) pendingEstimates.delete(draft.id);
    for (const file of [...(uploaded.stl || []), ...(uploaded.referenceImage || [])]) {
      try { fs.unlinkSync(file.path); } catch {}
    }
    const status = error.status || 400;
    res.status(status).json({ error: error.message || 'Impossible d’analyser ces fichiers.' });
  }
});

// L’acceptation du devis déplace les fichiers temporaires vers les pièces jointes de commande.
router.post('/estimate/:id/commit', (req, res) => {
  const entry = pendingEstimates.get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Ce devis a expiré. Relancez l’analyse.' });
  const committedPaths = [];
  try {
    const files = {};
    if (entry.files) {
      for (const [key, file] of Object.entries(entry.files)) {
        const filename = `3d_${uuidv4()}${path.extname(file.originalname).toLowerCase()}`;
        const finalPath = path.join(__dirname, '../uploads', filename);
        fs.renameSync(file.path, finalPath);
        committedPaths.push(finalPath);
        files[key] = `/uploads/${filename}`;
      }
    }
    const quoteId = uuidv4();
    const safeModelName = entry.files
      ? path.basename(entry.files.stl.originalname).replace(/[<>"'`]/g, '').slice(0, 100)
      : String(entry.ai.objectSummary || 'Modèle 3D').replace(/[<>"'`]/g, '').slice(0, 100);
    const details = {
      type: 'Impression 3D sur mesure',
      name: entry.modelUrl ? 'Impression 3D sur mesure' : `Impression 3D sur mesure — ${safeModelName}`,
      ...(files.stl ? { stl_url: files.stl } : {}),
      ...(files.referenceImage ? { photo_url: files.referenceImage } : {}),
      ...(entry.modelUrl ? { model_url: entry.modelUrl } : {}),
      dimensions: entry.modelUrl
        ? `${entry.options.dimensionsMm.map(v => (v / 10).toFixed(1)).join(' × ')} cm`
        : `${entry.options.dimensionsMm.join(' × ')} mm`,
      prix_total_estime: entry.estimate.totalPrice,
      ...(entry.geometry?.estimatedSolidVolumeCm3 ? { volume_estime: `${entry.geometry.estimatedSolidVolumeCm3} cm³` } : {}),
      ...(entry.estimate.materialGrams ? { masse_estimee: `${entry.estimate.materialGrams} g` } : {}),
      ...(entry.estimate.estimatedPrintHours ? { temps_estime: `${entry.estimate.estimatedPrintHours} h` } : {}),
      analyse_ia: entry.ai.objectSummary,
      remarques_ia: entry.ai.productionNotes,
    };
    getDb().prepare('INSERT INTO print3d_price_quotes (id, unit_price, quantity, details) VALUES (?, ?, ?, ?)')
      .run(quoteId, entry.estimate.unitPrice, entry.options.quantity, JSON.stringify(details));
    pendingEstimates.delete(req.params.id);
    res.json({ files, quoteId, name: details.name, modelUrl: entry.modelUrl || '' });
  } catch {
    for (const filePath of committedPaths) { try { fs.unlinkSync(filePath); } catch {} }
    removeDraft(entry);
    pendingEstimates.delete(req.params.id);
    res.status(500).json({ error: 'Impossible de finaliser les pièces jointes. Relancez l’analyse.' });
  }
});

router.delete('/estimate/:id', (req, res) => {
  const entry = pendingEstimates.get(req.params.id);
  if (entry) {
    removeDraft(entry);
    pendingEstimates.delete(req.params.id);
  }
  res.json({ success: true });
});

// POST /api/3d-print  — soumettre une demande (public)
router.post('/', upload.single('file'), (req, res) => {
  const { customer_name, customer_phone, customer_email,
          material, quality, quantity, color, notes,
          type, size, detailed, multicolor, dims: dimsInput } = req.body;

  if (!customer_name || !customer_phone)
    return res.status(400).json({ error: 'Nom et téléphone requis' });

  const db = getDb();
  const id = uuidv4();
  const fileUrl  = req.file ? `/uploads/${req.file.filename}` : '';
  const fileName = req.file ? req.file.originalname : '';
  // Estimation « par type de produit » (même calcul que ce que le client a vu).
  const est   = computeEstimate({ type, size, detailed, multicolor, material, quantity });
  const price = est.price;
  // Dimensions affichées à l'admin : taille + dimensions décrites par le client.
  const sizeLbl = SIZE_LABELS[size] || '';
  const dims    = [sizeLbl, dimsInput].filter(Boolean).join(' · ');
  // Récap descriptif pour l'admin (type / détail / couleurs) ajouté aux notes.
  const descr   = [
    TYPE_LABELS[type] || 'Produit',
    truthyNote(detailed) ? 'détaillé' : 'simple',
    truthyNote(multicolor) ? 'plusieurs couleurs' : '1 couleur',
    `fourchette ${est.range} TND`,
  ].join(' · ');
  const fullNotes = [descr, notes].filter(Boolean).join(' — ');

  db.prepare(`
    INSERT INTO print3d_quotes
      (id, customer_name, customer_phone, customer_email, file_url, file_name,
       material, quality, quantity, color, dimensions, notes, estimated_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, customer_name, customer_phone, customer_email || '',
         fileUrl, fileName, material || 'PLA', quality || 'standard',
         parseInt(quantity) || 1, color || '', dims, fullNotes, price);

  res.status(201).json({ id, estimated_price: price, range: est.range, success: true });
});

// GET /api/3d-print  — liste admin (protected)
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const { status, search } = req.query;

  let sql = 'SELECT * FROM print3d_quotes WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    sql += ' AND (customer_name LIKE ? OR customer_phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY created_at DESC';

  res.json(db.prepare(sql).all(...params));
});

// GET /api/3d-print/:id  (admin)
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const quote = db.prepare('SELECT * FROM print3d_quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Devis non trouvé' });
  res.json(quote);
});

// PUT /api/3d-print/:id/status  (admin)
router.put('/:id/status', authMiddleware, (req, res) => {
  const { status, estimated_price } = req.body;
  if (!VALID_STATUSES.includes(status))
    return res.status(400).json({ error: `Statut invalide. Valeurs: ${VALID_STATUSES.join(', ')}` });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM print3d_quotes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Devis non trouvé' });

  if (estimated_price !== undefined) {
    db.prepare('UPDATE print3d_quotes SET status=?, estimated_price=? WHERE id=?')
      .run(status, parseFloat(estimated_price), req.params.id);
  } else {
    db.prepare('UPDATE print3d_quotes SET status=? WHERE id=?').run(status, req.params.id);
  }
  res.json({ success: true, status });
});

// DELETE /api/3d-print/:id  (admin)
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM print3d_quotes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Devis non trouvé' });
  db.prepare('DELETE FROM print3d_quotes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
