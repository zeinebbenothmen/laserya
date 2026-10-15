const MAX_TRIANGLES = 1_000_000;

function parseSTL(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 84) throw new Error('Le fichier STL est trop court ou illisible.');

  const declared = buffer.readUInt32LE(80);
  const isBinary = 84 + declared * 50 === buffer.length && declared > 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let triangleCount = 0;
  let signedVolume = 0;

  const addTriangle = (a, b, c) => {
    if (![...a, ...b, ...c].every(Number.isFinite)) return;
    for (const p of [a, b, c]) for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], p[axis]);
      max[axis] = Math.max(max[axis], p[axis]);
    }
    signedVolume += (
      a[0] * (b[1] * c[2] - b[2] * c[1]) +
      a[1] * (b[2] * c[0] - b[0] * c[2]) +
      a[2] * (b[0] * c[1] - b[1] * c[0])
    ) / 6;
    triangleCount++;
  };

  if (isBinary) {
    if (declared > MAX_TRIANGLES) throw new Error('Le STL contient trop de triangles (maximum 1 million).');
    for (let i = 0; i < declared; i++) {
      const offset = 84 + i * 50 + 12;
      const v = [];
      for (let j = 0; j < 9; j++) v.push(buffer.readFloatLE(offset + j * 4));
      addTriangle(v.slice(0, 3), v.slice(3, 6), v.slice(6, 9));
    }
  } else {
    const text = buffer.toString('utf8');
    const vertex = /\bvertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/gi;
    let match;
    let tri = [];
    while ((match = vertex.exec(text))) {
      tri.push(match.slice(1, 4).map(Number));
      if (tri.length === 3) {
        addTriangle(tri[0], tri[1], tri[2]);
        tri = [];
        if (triangleCount > MAX_TRIANGLES) throw new Error('Le STL contient trop de triangles (maximum 1 million).');
      }
    }
  }

  if (triangleCount < 4) throw new Error('Le STL ne contient pas assez de triangles valides.');
  const sizeMm = max.map((v, i) => v - min[i]);
  if (sizeMm.some(v => !Number.isFinite(v) || v <= 0)) throw new Error('Les dimensions de ce STL sont invalides.');

  return {
    triangleCount,
    boundsMm: sizeMm.map(v => Math.round(v * 100) / 100),
    meshVolumeMm3: Math.round(Math.abs(signedVolume) * 100) / 100,
  };
}

function scaleToRequestedSize(mesh, requestedMm) {
  const scales = mesh.boundsMm.map((v, i) => requestedMm[i] / v);
  return {
    scale: scales.map(v => Math.round(v * 1000) / 1000),
    volumeCm3: Math.round(mesh.meshVolumeMm3 * scales[0] * scales[1] * scales[2] / 1000) / 1000,
  };
}

module.exports = { parseSTL, scaleToRequestedSize };
