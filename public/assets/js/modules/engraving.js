/**
 * The engraved stage.
 *
 * One fixed plate behind the whole page, cut in hand-written WebGL — no
 * library, no bundler, in keeping with the rest of the site. It has two acts,
 * and the scroll is what turns the page between them:
 *
 *   I.  A classical bust, for the front matter. A real 3D model, drawn as a
 *       hidden-line engraving.
 *   II. A terrestrial globe, from the education section onward: Natural Earth
 *       coastlines on a graticule, turned to Sumatra, with Jambi and Palembang
 *       labelled the way a plate in an atlas would label them.
 *
 * In both acts the solid is painted into the depth buffer alone, so only the
 * lines a burin would actually cut survive.
 *
 * It can also be taken hold of. A pointer that is precise enough gets a grip on
 * the circle the plate actually occupies — never on the rest of the page — and
 * can turn it, with the weight carrying on after the hand lets go. Every
 * reader, on any screen, can open the instrument panel's *examination*: the
 * plate alone, full strength, turned by finger or key, drawn closer by pinch or
 * wheel, with the marked places answering to a tap. Under
 * `prefers-reduced-motion` nothing moves on its own; it still answers the hand.
 */

const BUST = '/assets/models/bust.glb';
const COASTLINE = '/assets/models/coastline.json';

const CREASE = Math.cos((16 * Math.PI) / 180); /* keep an edge sharper than this */
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/* Where the two acts hand over, as a fraction of the whole scroll. */
const ACT = { close: 0.24, open: 0.40 };

/* How far the plate may be drawn in or pushed back. */
const ZOOM = { min: 0.62, max: 3.2 };
const PITCH_LIMIT = 1.15;

/* The places the globe is turned to, and drawn for. */
const PLACES = [
  {
    id: 'jambi',
    lat: -1.6101,
    lon: 103.6131,
    name: 'Jambi',
    note: 'MAN Insan Cendekia Jambi &middot; 2020&ndash;2023',
  },
  {
    id: 'palembang',
    lat: -2.9761,
    lon: 104.7754,
    name: 'Palembang',
    note: 'Universitas Sriwijaya &middot; since 2024',
  },
];

const VERT = `
attribute vec3 aPos;
uniform mat4 uMvp;
void main() { gl_Position = uMvp * vec4(aPos, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec4 uColor;
void main() { gl_FragColor = uColor; }`;

/* ---- A very small column-major matrix kit ------------------------------- */

const mul = (a, b) => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
};

const translate = (x, y, z) =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);

const scale = (s) =>
  new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);

const rotX = (a) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
};

const rotY = (a) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
};

const FOV = 0.6;

const perspective = (fovy, aspect, near, far) => {
  const f = 1 / Math.tan(fovy / 2);
  const d = near - far;
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / d, -1,
    0, 0, (2 * far * near) / d, 0,
  ]);
};

/** Applies a 4x4 to a point and returns the clip-space result. */
const apply = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
  m[3] * x + m[7] * y + m[11] * z + m[15],
];

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const clamp = (t, low, high) => Math.min(Math.max(t, low), high);
const mix = (a, b, t) => a + (b - a) * t;

/* ---- Act I: the bust ---------------------------------------------------- */

const TYPED = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

async function loadBust(url) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const view = new DataView(buffer);
  const total = view.getUint32(8, true);

  let gltf = null;
  let bin = null;

  for (let at = 12; at < total;) {
    const length = view.getUint32(at, true);
    const kind = view.getUint32(at + 4, true);
    const body = buffer.slice(at + 8, at + 8 + length);
    if (kind === 0x4e4f534a) gltf = JSON.parse(new TextDecoder().decode(body));
    else if (kind === 0x004e4942) bin = body;
    at += 8 + length;
  }
  if (!gltf || !bin) throw new Error('not a glb');

  const read = (index) => {
    const accessor = gltf.accessors[index];
    const slot = gltf.bufferViews[accessor.bufferView];
    const at = (slot.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    return new TYPED[accessor.componentType](bin, at, accessor.count * WIDTH[accessor.type]);
  };

  const primitive = gltf.meshes[0].primitives[0];
  return { positions: read(primitive.attributes.POSITION), triangles: read(primitive.indices) };
}

/**
 * Welds the duplicated seam vertices, then keeps only the edges a burin would
 * cut: the silhouette, and the creases where two facets meet at an angle. A
 * full wireframe reads as mesh, not as a drawing.
 */
function cutBust(positions, triangles) {
  const seen = new Map();
  const welded = [];
  const to = new Int32Array(positions.length / 3);

  for (let i = 0; i < to.length; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let index = seen.get(key);
    if (index === undefined) {
      index = welded.length / 3;
      seen.set(key, index);
      welded.push(x, y, z);
    }
    to[i] = index;
  }

  const points = new Float32Array(welded);
  const edges = new Map();

  for (let t = 0; t < triangles.length; t += 3) {
    const a = to[triangles[t]];
    const b = to[triangles[t + 1]];
    const c = to[triangles[t + 2]];

    const ux = points[b * 3] - points[a * 3];
    const uy = points[b * 3 + 1] - points[a * 3 + 1];
    const uz = points[b * 3 + 2] - points[a * 3 + 2];
    const vx = points[c * 3] - points[a * 3];
    const vy = points[c * 3 + 1] - points[a * 3 + 1];
    const vz = points[c * 3 + 2] - points[a * 3 + 2];

    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const key = p < q ? `${p}_${q}` : `${q}_${p}`;
      const found = edges.get(key);
      if (found) found.second = [nx, ny, nz];
      else edges.set(key, { p, q, first: [nx, ny, nz], second: null });
    }
  }

  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    minX = Math.min(minX, points[i]); maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]); maxY = Math.max(maxY, points[i + 1]);
    minZ = Math.min(minZ, points[i + 2]); maxZ = Math.max(maxZ, points[i + 2]);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 || 1;

  /* Centre and normalise here, so the draw code never has to think about it. */
  const place = (i, out) => {
    out.push((points[i * 3] - cx) / radius, (points[i * 3 + 1] - cy) / radius,
      (points[i * 3 + 2] - cz) / radius);
  };

  const fill = [];
  for (let t = 0; t < triangles.length; t++) place(to[triangles[t]], fill);

  const lines = [];
  for (const { p, q, first, second } of edges.values()) {
    const sharp = !second
      || first[0] * second[0] + first[1] * second[1] + first[2] * second[2] < CREASE;
    if (sharp) { place(p, lines); place(q, lines); }
  }

  return { fill: new Float32Array(fill), lines: new Float32Array(lines) };
}

/* ---- Act II: the globe -------------------------------------------------- */

const onSphere = (lat, lon, r = 1) => {
  const a = lat * RAD;
  const b = lon * RAD;
  const k = Math.cos(a) * r;
  return [k * Math.sin(b), Math.sin(a) * r, k * Math.cos(b)];
};

/**
 * Reads the coastline: polylines of delta-encoded hundredths of a degree,
 * which keeps almost every number in the file one or two characters long.
 */
async function loadCoastline(url) {
  const { scale, lines } = await (await fetch(url)).json();

  return lines.map((deltas) => {
    const line = new Float64Array(deltas.length);
    let lon = 0;
    let lat = 0;
    for (let i = 0; i < deltas.length; i += 2) {
      lon += deltas[i];
      lat += deltas[i + 1];
      line[i] = lon / scale;
      line[i + 1] = lat / scale;
    }
    return line;
  });
}

/** Every polyline becomes a run of line segments on the sphere. */
function drapeCoastline(strokes, r) {
  const out = [];
  for (const line of strokes) {
    for (let p = 0; p < line.length / 2 - 1; p++) {
      out.push(...onSphere(line[p * 2 + 1], line[p * 2], r));
      out.push(...onSphere(line[p * 2 + 3], line[p * 2 + 2], r));
    }
  }
  return new Float32Array(out);
}

/** Meridians and parallels every fifteen degrees, as an engraver would rule them. */
function graticule(r) {
  const out = [];
  const step = 3;

  for (let lon = -180; lon < 180; lon += 15) {
    for (let lat = -90; lat < 90; lat += step) {
      out.push(...onSphere(lat, lon, r), ...onSphere(lat + step, lon, r));
    }
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    for (let lon = -180; lon < 180; lon += step) {
      out.push(...onSphere(lat, lon, r), ...onSphere(lat, lon + step, r));
    }
  }
  return new Float32Array(out);
}

/** The equator, the prime meridian, and a meridian ring standing off the sphere. */
function rings(r) {
  const out = [];
  const step = 2;

  for (let lon = -180; lon < 180; lon += step) {
    out.push(...onSphere(0, lon, r), ...onSphere(0, lon + step, r));
  }
  for (let lat = -90; lat < 90; lat += step) {
    out.push(...onSphere(lat, 0, r), ...onSphere(lat + step, 0, r));
  }

  /* The brass meridian an antique globe is hung in, tilted off the axis. */
  const tilt = 23.4 * RAD;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const hoop = (t) => {
    const x = Math.sin(t) * 1.26;
    const y = Math.cos(t) * 1.26;
    return [x * cos - y * sin, x * sin + y * cos, 0];
  };
  for (let a = 0; a < 360; a += step) {
    out.push(...hoop(a * RAD), ...hoop((a + step) * RAD));
  }
  return new Float32Array(out);
}

/** A closed sphere, drawn only into depth so the far side stays hidden. */
function shell(r) {
  const out = [];
  const bands = 36;
  const rows = 24;

  for (let i = 0; i < rows; i++) {
    const lat0 = -90 + (180 * i) / rows;
    const lat1 = -90 + (180 * (i + 1)) / rows;
    for (let j = 0; j < bands; j++) {
      const lon0 = -180 + (360 * j) / bands;
      const lon1 = -180 + (360 * (j + 1)) / bands;
      const a = onSphere(lat0, lon0, r);
      const b = onSphere(lat1, lon0, r);
      const c = onSphere(lat1, lon1, r);
      const d = onSphere(lat0, lon1, r);
      out.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  return new Float32Array(out);
}

/** A short cross of meridians round one place, so a marked point reads as a mark. */
function placeMarks(places, r) {
  const out = [];
  const arm = 2.6;

  for (const place of places) {
    for (const [dLat, dLon] of [[arm, 0], [0, arm]]) {
      out.push(...onSphere(place.lat - dLat, place.lon - dLon, r));
      out.push(...onSphere(place.lat + dLat, place.lon + dLon, r));
    }
    /* A small ring, drawn as a twelve-sided figure. */
    for (let a = 0; a < 360; a += 30) {
      const b = a + 30;
      out.push(...onSphere(place.lat + Math.sin(a * RAD) * 1.5,
        place.lon + Math.cos(a * RAD) * 1.5, r));
      out.push(...onSphere(place.lat + Math.sin(b * RAD) * 1.5,
        place.lon + Math.cos(b * RAD) * 1.5, r));
    }
  }
  return new Float32Array(out);
}

/* ---- Readings ------------------------------------------------------------ */

const reading = (value, positive, negative) => {
  const side = value >= 0 ? positive : negative;
  const total = Math.abs(value);
  const degrees = Math.floor(total);
  const minutes = Math.round((total - degrees) * 60);
  return `${degrees + (minutes === 60 ? 1 : 0)}°${String(minutes % 60)
    .padStart(2, '0')}′${side}`;
};

/* ---- The plate ---------------------------------------------------------- */

function compile(gl) {
  const program = gl.createProgram();

  for (const [type, source] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
    }
    gl.attachShader(program, shader);
  }

  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'link');
  }
  return program;
}

export function initEngraving() {
  const canvas = document.getElementById('engraving');
  if (!canvas) return;

  const options = { alpha: true, antialias: true, premultipliedAlpha: false };
  const gl = canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options);
  if (!gl) return;

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  const pinBoard = document.getElementById('engraving-pins');
  const dividers = document.getElementById('dividers');
  const grip = document.getElementById('grip');
  const instrument = document.getElementById('instrument');
  const camera = document.getElementById('camera');
  const surface = document.getElementById('camera-surface');

  Promise.all([loadBust(BUST), loadCoastline(COASTLINE)]).then(([raw, strokes]) => {
    const bust = cutBust(raw.positions, raw.triangles);
    const program = compile(gl);
    const uMvp = gl.getUniformLocation(program, 'uMvp');
    const uColor = gl.getUniformLocation(program, 'uColor');

    /* Every batch is a plain run of vertices; nothing here needs an index. */
    const batch = (data, mode) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return { buffer, mode, count: data.length / 3 };
    };

    const parts = {
      bustFill: batch(bust.fill, gl.TRIANGLES),
      bustLines: batch(bust.lines, gl.LINES),
      globeFill: batch(shell(0.994), gl.TRIANGLES),
      coast: batch(drapeCoastline(strokes, 1.004), gl.LINES),
      grid: batch(graticule(1.001), gl.LINES),
      rings: batch(rings(1.002), gl.LINES),
      marks: batch(placeMarks(PLACES, 1.008), gl.LINES),
    };

    gl.useProgram(program);
    gl.enableVertexAttribArray(0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    /* Behind the page the plate is a watermark; under examination it is the
       subject, and takes as much ink as the paper will hold. */
    const inked = new Float32Array(4);

    const strength = () => {
      inked.set(ink);
      inked[3] = Math.min(ink[3] * (1 + 0.5 * ease(state.focus)), 1);
      return inked;
    };

    const draw = (part, mvp, alpha, pen) => {
      if (alpha <= 0.002) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, part.buffer);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(uMvp, false, mvp);

      if (part.mode === gl.TRIANGLES) {
        /* Depth only: it hides what is behind the surface without inking it. */
        gl.colorMask(false, false, false, false);
        gl.depthFunc(gl.LESS);
      } else {
        gl.colorMask(true, true, true, true);
        gl.depthFunc(gl.LEQUAL);
        gl.uniform4f(uColor, pen[0], pen[1], pen[2], pen[3] * alpha);
      }
      gl.drawArrays(part.mode, 0, part.count);
    };

    /* The ink is a stylesheet decision, so both editions can set their own. */
    const ink = new Float32Array([0, 0, 0, 0.75]);
    const readInk = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--engraving-ink').trim();
      const numbers = value.split(/[\s,/]+/).map(Number).filter(Number.isFinite);
      if (numbers.length >= 3) {
        ink[0] = numbers[0] / 255;
        ink[1] = numbers[1] / 255;
        ink[2] = numbers[2] / 255;
        if (numbers.length >= 4) ink[3] = numbers[3];
      }
    };

    let width = 1;
    let height = 1;
    let roomy = true;

    const resize = () => {
      /* A phone gains nothing from three device pixels per CSS pixel here, and
         loses a good deal of battery to them. */
      const dpr = Math.min(devicePixelRatio || 1, fine ? 2 : 1.5);
      width = Math.max(Math.round(innerWidth * dpr), 1);
      height = Math.max(Math.round(innerHeight * dpr), 1);
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      roomy = innerWidth >= 1024;
    };

    /* ---- What the plate is doing ---------------------------------------- */

    const pointer = { x: 0, y: 0, sx: -400, sy: -400 };
    const eased = { turn: 0, x: 0, y: 0, cx: -400, cy: -400 };

    /* Everything the reader has done to the plate by hand. */
    const hand = { yaw: 0, pitch: 0, zoom: 1, vYaw: 0, vPitch: 0, held: false };

    const state = {
      subject: 'auto', /* 'auto' | 'bust' | 'globe' */
      turning: false,
      blend: 0, /* 0 = the bust, 1 = the globe */
      focus: 0, /* how far into the examination */
      wantFocus: 0,
      marked: null, /* the place whose card is open */
    };

    const pins = PLACES.map((place) => ({
      ...place,
      node: pinBoard?.querySelector(`[data-pin="${place.id}"]`) ?? null,
      point: onSphere(place.lat, place.lon, 1.01),
      screen: null,
    }));

    const progress = () => {
      const travel = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      return clamp01(scrollY / travel);
    };

    /** Where the two acts stand, before the hand is taken into account. */
    const wantedBlend = () => {
      if (state.subject === 'bust') return 0;
      if (state.subject === 'globe') return 1;
      return ease(clamp01((eased.turn - ACT.close) / (ACT.open - ACT.close)));
    };

    /* What the page itself contributes to the globe's pose, before the hand. */
    const globeYaw = (p, lean) => -102.2 * RAD + (p - 0.55) * 1.5 + eased.x * 0.30 * lean;
    const globePitch = (lean) => 0.30 + eased.y * 0.16 * lean;

    /** Far enough back that a solid of this radius fits the shorter side. */
    const fitDistance = (radius) => {
      const half = Math.tan(FOV / 2);
      const aspect = width / height;
      return radius / (half * Math.min(1, aspect)) + 0.35;
    };

    /** The plate's seat, eased between its place on the page and the examination. */
    const seat = (ambient, radius) => {
      const focused = [0, 0, -fitDistance(radius)];
      const t = ease(state.focus);
      return [
        mix(ambient[0], focused[0], t),
        mix(ambient[1], focused[1], t),
        mix(ambient[2], focused[2], t) / hand.zoom,
      ];
    };

    /* What the last frame drew, so a tap can be matched against it. */
    let lastGlobe = null;

    const render = () => {
      const p = eased.turn;
      const projection = perspective(FOV, width / height, 0.1, 60);

      /* The two acts cross over once, and only once. */
      const bustAlpha = clamp01(1 - state.blend * 1.7);
      const globeAlpha = clamp01((state.blend - 0.34) / 0.66);
      const pen = strength();

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      lastGlobe = null;

      /* Under examination the plate answers the hand alone; the lean the pointer
         gives it across the page would only fight the drag. */
      const lean = 1 - ease(state.focus);

      if (bustAlpha > 0.002) {
        const yaw = -0.5 + (p / ACT.open) * 1.5 + eased.x * 0.34 * lean + hand.yaw;
        const at = seat(roomy ? [1.32, 0, -4.4] : [0, 0, -6.2], 1.15);
        const model = mul(
          mul(translate(at[0], at[1], at[2]), rotY(yaw)),
          rotX(clamp(eased.y * 0.22 * lean + hand.pitch, -PITCH_LIMIT, PITCH_LIMIT)),
        );
        const mvp = mul(projection, model);
        draw(parts.bustFill, mvp, bustAlpha, pen);
        draw(parts.bustLines, mvp, bustAlpha, pen);
      }

      if (globeAlpha > 0.002) {
        /* Turned so Sumatra faces the reader as the education section lands,
           then kept slowly drifting for the rest of the page. */
        const yaw = globeYaw(p, lean) + hand.yaw;
        const pitch = clamp(globePitch(lean) + hand.pitch, -PITCH_LIMIT, PITCH_LIMIT);
        const spun = mul(rotX(pitch), rotY(yaw));
        const at = seat(roomy ? [1.45, 0, -4.0] : [0.15, 0, -6.4], 1.38);
        const model = mul(translate(at[0], at[1], at[2]), mul(spun, scale(1)));
        const mvp = mul(projection, model);

        draw(parts.globeFill, mvp, globeAlpha, pen);
        draw(parts.grid, mvp, globeAlpha * 0.42, pen);
        draw(parts.coast, mvp, globeAlpha, pen);
        draw(parts.rings, mvp, globeAlpha * 0.8, pen);
        draw(parts.marks, mvp, globeAlpha, pen);

        lastGlobe = { mvp, spun, alpha: globeAlpha, at };
      }

      /* The labels are ordinary HTML, moved to wherever their point landed. */
      const labelled = lastGlobe && (roomy || state.focus > 0.6);

      for (const pin of pins) {
        pin.screen = null;

        if (!lastGlobe) { if (pin.node) pin.node.style.opacity = '0'; continue; }

        const [x, y, z] = pin.point;
        const { spun, mvp, alpha } = lastGlobe;
        const facing = spun[2] * x + spun[6] * y + spun[10] * z;
        const clip = apply(mvp, x, y, z);
        if (clip[3] <= 0) { if (pin.node) pin.node.style.opacity = '0'; continue; }

        const sx = ((clip[0] / clip[3]) * 0.5 + 0.5) * innerWidth;
        const sy = (0.5 - (clip[1] / clip[3]) * 0.5) * innerHeight;
        if (facing > 0.06) pin.screen = { x: sx, y: sy };

        if (!pin.node) continue;
        if (!labelled || alpha <= 0.02 || facing <= 0.12) { pin.node.style.opacity = '0'; continue; }

        pin.node.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
        pin.node.style.opacity = (alpha * clamp01((facing - 0.12) / 0.25)).toFixed(3);
      }

      if (dividers) {
        dividers.style.transform =
          `translate3d(${eased.cx.toFixed(1)}px, ${eased.cy.toFixed(1)}px, 0)`;
      }

      placeGrip(projection, globeAlpha > bustAlpha ? 1.38 : 1.15);
      if (state.focus > 0.5 && lastGlobe) showReading(lastGlobe.spun);
      naming();
    };

    /* ---- The grip -------------------------------------------------------- */

    /**
     * The only part of the backdrop that takes the pointer: a circle the size of
     * the solid, over the solid. Everything outside it belongs to the page.
     * A coarse pointer never gets one — a thumb over the middle of the column
     * would swallow taps meant for the text — and uses the examination instead.
     */
    function placeGrip(projection, radius) {
      if (!grip || !fine) return;

      if (state.focus > 0.05) { grip.hidden = true; return; }

      const at = seat(roomy ? [1.4, 0, -4.2] : [0.1, 0, -6.3], radius);
      const centre = apply(projection, at[0], at[1], at[2]);
      const edge = apply(projection, at[0] + radius, at[1], at[2]);
      if (centre[3] <= 0) { grip.hidden = true; return; }

      const cx = ((centre[0] / centre[3]) * 0.5 + 0.5) * innerWidth;
      const cy = (0.5 - (centre[1] / centre[3]) * 0.5) * innerHeight;
      const r = Math.abs(((edge[0] / edge[3]) * 0.5 + 0.5) * innerWidth - cx);

      grip.hidden = false;
      grip.style.width = `${(r * 2).toFixed(0)}px`;
      grip.style.height = `${(r * 2).toFixed(0)}px`;
      grip.style.transform = `translate3d(${(cx - r).toFixed(0)}px, ${(cy - r).toFixed(0)}px, 0)`;
    }

    /* ---- The reading at the centre of the disc --------------------------- */

    const readout = document.getElementById('camera-readout');

    function showReading(spun) {
      if (!readout) return;
      /* The model-space direction that is facing the reader: the transpose of
         the rotation applied to the camera's own axis. */
      const x = spun[2];
      const y = spun[6];
      const z = spun[10];
      const lat = Math.asin(clamp(y, -1, 1)) * DEG;
      const lon = Math.atan2(x, z) * DEG;
      readout.textContent = `${reading(lat, 'N', 'S')} ${reading(lon, 'E', 'W')}`;
    }

    /* ---- The loop -------------------------------------------------------- */

    const pose = () => ({
      turn: progress(),
      x: pointer.x,
      y: pointer.y,
      cx: pointer.sx,
      cy: pointer.sy,
    });

    let running = false;

    const settle = () => {
      const want = pose();

      /* A jump — an anchor, the palette, a restored position — should not make
         the plate wind slowly through every act on the way. */
      const gap = Math.abs(want.turn - eased.turn);
      eased.turn += (want.turn - eased.turn) * (gap > 0.06 ? 0.45 : 0.12);
      eased.x += (want.x - eased.x) * 0.06;
      eased.y += (want.y - eased.y) * 0.06;
      eased.cx += (want.cx - eased.cx) * 0.22;
      eased.cy += (want.cy - eased.cy) * 0.22;

      state.focus += (state.wantFocus - state.focus) * (still ? 1 : 0.16);
      if (Math.abs(state.wantFocus - state.focus) < 0.002) state.focus = state.wantFocus;

      const blend = wantedBlend();
      state.blend += (blend - state.blend) * (still ? 1 : 0.14);

      /* The weight of the plate, once the hand has let go. */
      if (!hand.held && !still) {
        hand.yaw += hand.vYaw;
        hand.pitch = clamp(hand.pitch + hand.vPitch, -PITCH_LIMIT, PITCH_LIMIT);
        hand.vYaw *= 0.945;
        hand.vPitch *= 0.9;
        if (Math.abs(hand.vYaw) < 0.00012) hand.vYaw = 0;
        if (Math.abs(hand.vPitch) < 0.00012) hand.vPitch = 0;

        if (state.turning) hand.yaw += 0.0032;
      }

      render();

      const rest = Math.abs(want.turn - eased.turn) * 40
        + Math.abs(want.x - eased.x)
        + Math.abs(want.y - eased.y)
        + Math.abs(blend - state.blend) * 10
        + Math.abs(state.wantFocus - state.focus) * 10
        + (Math.abs(hand.vYaw) + Math.abs(hand.vPitch)) * 100
        + (Math.abs(want.cx - eased.cx) + Math.abs(want.cy - eased.cy)) * 0.01;

      if (rest > 0.002 || (state.turning && !still) || hand.held) requestAnimationFrame(settle);
      else running = false;
    };

    const nudge = () => {
      if (running) return;
      running = true;
      requestAnimationFrame(settle);
    };

    const jump = () => {
      Object.assign(eased, pose());
      state.blend = wantedBlend();
    };

    /* ---- Taking hold ----------------------------------------------------- */

    const held = new Map();
    let pinchFrom = 0;
    let moved = 0;

    const spread = () => {
      const [a, b] = [...held.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const down = (event) => {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      held.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (held.size === 1) {
        hand.held = true;
        hand.vYaw = 0;
        hand.vPitch = 0;
        moved = 0;
        event.currentTarget.dataset.held = 'true';
      }
      if (held.size === 2) pinchFrom = spread();
      nudge();
    };

    const move = (event) => {
      const was = held.get(event.pointerId);
      if (!was) return;

      const dx = event.clientX - was.x;
      const dy = event.clientY - was.y;
      held.set(event.pointerId, { x: event.clientX, y: event.clientY });
      moved += Math.abs(dx) + Math.abs(dy);

      if (held.size >= 2) {
        const now = spread();
        if (pinchFrom > 4) hand.zoom = clamp(hand.zoom * (now / pinchFrom), ZOOM.min, ZOOM.max);
        pinchFrom = now;
        nudge();
        return;
      }

      /* A degree of turn for a degree of travel across the plate. */
      const step = 3.4 / Math.max(innerWidth, 480);
      hand.yaw += dx * step;
      hand.vYaw = dx * step * 0.55;

      hand.pitch = clamp(hand.pitch - dy * step * 0.8, -PITCH_LIMIT, PITCH_LIMIT);
      hand.vPitch = -dy * step * 0.4;

      nudge();
    };

    const up = (event) => {
      held.delete(event.pointerId);
      if (held.size) return;

      hand.held = false;
      delete event.currentTarget.dataset.held;

      /* A tap, not a drag: see whether it landed on a marked place. */
      if (moved < 8 && state.focus > 0.5) pick(event.clientX, event.clientY);
      nudge();
    };

    const wire = (node) => {
      if (!node) return;
      node.addEventListener('pointerdown', down);
      node.addEventListener('pointermove', move, { passive: true });
      node.addEventListener('pointerup', up);
      node.addEventListener('pointercancel', up);
    };

    wire(grip);
    wire(surface);

    surface?.addEventListener('wheel', (event) => {
      event.preventDefault();
      hand.zoom = clamp(hand.zoom * (event.deltaY > 0 ? 0.92 : 1.08), ZOOM.min, ZOOM.max);
      nudge();
    }, { passive: false });

    surface?.addEventListener('dblclick', () => square());

    /* ---- The instrument panel -------------------------------------------- */

    const card = document.getElementById('camera-card');
    const cardName = document.getElementById('camera-card-name');
    const cardNote = document.getElementById('camera-card-note');
    const actLabel = document.getElementById('instrument-act');
    const subjectLabel = document.getElementById('instrument-subject');
    const cameraAct = document.getElementById('camera-act');
    const cameraTitle = document.getElementById('camera-title');
    const turnButton = document.getElementById('plate-turn');

    const naming = () => {
      const globe = state.blend > 0.5;
      const act = globe ? 'II' : 'I';
      const name = globe ? 'The terrestrial globe' : 'The bust';
      if (actLabel) actLabel.textContent = act;
      if (subjectLabel) subjectLabel.textContent = name;
      if (cameraAct) cameraAct.textContent = act;
      if (cameraTitle) cameraTitle.textContent = name;
    };

    /** Opens the card for a place, or closes it when handed nothing. */
    const mark = (place) => {
      state.marked = place;
      if (!card) return;
      card.hidden = !place;
      if (!place) return;
      if (cardName) cardName.textContent = place.name;
      if (cardNote) {
        cardNote.innerHTML = `${reading(place.lat, 'N', 'S')} ${reading(place.lon, 'E', 'W')}`
          + ` &middot; ${place.note}`;
      }
      navigator.vibrate?.(8);
    };

    /** The nearest marked place to a tap, if the tap was near enough to one. */
    function pick(x, y) {
      if (!lastGlobe) return;

      let best = null;
      let nearest = 44;

      for (const pin of pins) {
        if (!pin.screen) continue;
        const away = Math.hypot(pin.screen.x - x, pin.screen.y - y);
        if (away < nearest) { nearest = away; best = pin; }
      }

      if (best) { turnTo(best); mark(best); }
      else if (state.marked) mark(null);
    }

    /** Brings a place round to face the reader. */
    function turnTo(place) {
      if (state.subject === 'bust') state.subject = 'globe';

      /* Undo the pose the page itself contributes, so the place lands centred. */
      const lean = 1 - ease(state.focus);
      hand.yaw = -globeYaw(eased.turn, lean) - place.lon * RAD;
      hand.pitch = clamp(place.lat * RAD - globePitch(lean), -PITCH_LIMIT, PITCH_LIMIT);
      hand.vYaw = 0;
      hand.vPitch = 0;
      naming();
      nudge();
    }

    function square() {
      hand.yaw = 0;
      hand.pitch = 0;
      hand.zoom = 1;
      hand.vYaw = 0;
      hand.vPitch = 0;
      mark(null);
      nudge();
    }

    const setTurning = (on) => {
      state.turning = on && !still;
      turnButton?.setAttribute('aria-pressed', String(state.turning));
      nudge();
    };

    const setFocus = (on) => {
      state.wantFocus = on ? 1 : 0;
      document.body.dataset.plate = on ? 'focus' : 'page';
      if (camera) camera.hidden = !on;
      document.documentElement.style.overflow = on ? 'hidden' : '';

      if (on) {
        /* An examination is worth a subject that stays put while it is examined. */
        if (state.subject === 'auto') state.subject = state.blend > 0.5 ? 'globe' : 'bust';
        setTurning(true);
        document.getElementById('camera-close')?.focus({ preventScroll: true });
      } else {
        setTurning(false);
        mark(null);
        document.getElementById('plate-examine')?.focus({ preventScroll: true });
      }

      naming();
      nudge();
    };

    document.getElementById('plate-examine')?.addEventListener('click', () => setFocus(true));
    document.getElementById('camera-close')?.addEventListener('click', () => setFocus(false));
    document.getElementById('camera-scrim')?.addEventListener('click', () => setFocus(false));
    document.getElementById('plate-square')?.addEventListener('click', square);
    turnButton?.addEventListener('click', () => setTurning(!state.turning));

    document.getElementById('plate-subject')?.addEventListener('click', () => {
      state.subject = state.blend > 0.5 ? 'bust' : 'globe';
      mark(null);
      naming();
      nudge();
    });

    document.getElementById('camera-in')?.addEventListener('click', () => {
      hand.zoom = clamp(hand.zoom * 1.18, ZOOM.min, ZOOM.max);
      nudge();
    });

    document.getElementById('camera-out')?.addEventListener('click', () => {
      hand.zoom = clamp(hand.zoom / 1.18, ZOOM.min, ZOOM.max);
      nudge();
    });

    /* A button for each marked place, so the globe is reachable from the keyboard. */
    const legend = document.getElementById('camera-legend');
    if (legend) {
      const bar = document.createElement('div');
      bar.className = 'camera__places';

      for (const pin of pins) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'camera__place';
        button.textContent = pin.name;
        button.addEventListener('click', () => {
          state.subject = 'globe';
          setTurning(false);
          turnTo(pin);
          mark(pin);
        });
        bar.append(button);
      }

      legend.after(bar);
    }

    addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.wantFocus) { setFocus(false); return; }
      if (!state.wantFocus) return;

      const step = event.shiftKey ? 0.24 : 0.08;
      const keys = {
        ArrowLeft: () => { hand.yaw -= step; },
        ArrowRight: () => { hand.yaw += step; },
        ArrowUp: () => { hand.pitch = clamp(hand.pitch + step, -PITCH_LIMIT, PITCH_LIMIT); },
        ArrowDown: () => { hand.pitch = clamp(hand.pitch - step, -PITCH_LIMIT, PITCH_LIMIT); },
        '+': () => { hand.zoom = clamp(hand.zoom * 1.12, ZOOM.min, ZOOM.max); },
        '=': () => { hand.zoom = clamp(hand.zoom * 1.12, ZOOM.min, ZOOM.max); },
        '-': () => { hand.zoom = clamp(hand.zoom / 1.12, ZOOM.min, ZOOM.max); },
        '0': square,
      };

      const act = keys[event.key];
      if (!act) return;
      event.preventDefault();
      act();
      nudge();
    });

    /* ---- Setting off ----------------------------------------------------- */

    readInk();
    resize();
    jump();
    render();
    naming();

    canvas.dataset.ready = 'true';
    pinBoard?.setAttribute('data-ready', 'true');
    document.body.dataset.plate = 'page';

    if (instrument) {
      instrument.hidden = false;
      const hint = document.getElementById('instrument-hint');
      if (hint) hint.textContent = fine ? 'Drag the plate to turn it' : 'Examine to turn it by hand';
    }

    addEventListener('scroll', nudge, { passive: true });

    addEventListener('pointermove', (event) => {
      if (still) return;
      pointer.x = (event.clientX / innerWidth) * 2 - 1;
      pointer.y = (event.clientY / innerHeight) * 2 - 1;
      pointer.sx = event.clientX;
      pointer.sy = event.clientY;
      if (dividers && dividers.dataset.ready !== 'true') {
        eased.cx = pointer.sx;
        eased.cy = pointer.sy;
        dividers.dataset.ready = 'true';
      }
      nudge();
    }, { passive: true });

    addEventListener('resize', () => { resize(); jump(); render(); }, { passive: true });

    new MutationObserver(() => { readInk(); render(); })
      .observe(document.documentElement, { attributeFilter: ['data-theme'] });
  }).catch((error) => {
    console.error('[portfolio] the plate could not be cut:', error);
  });
}
