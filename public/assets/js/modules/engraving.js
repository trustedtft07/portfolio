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
 * lines a burin would actually cut survive. The pointer leans the stage; the
 * scroll turns it. Under `prefers-reduced-motion` nothing moves at all.
 */

const BUST = '/assets/models/bust.glb';
const COASTLINE = '/assets/models/coastline.json';

const CREASE = Math.cos((16 * Math.PI) / 180); /* keep an edge sharper than this */
const RAD = Math.PI / 180;

/* Where the two acts hand over, as a fraction of the whole scroll. */
const ACT = { close: 0.24, open: 0.40 };

/* The places the globe is turned to, and drawn for. */
const PLACES = [
  { id: 'jambi', lat: -1.6101, lon: 103.6131 },
  { id: 'palembang', lat: -2.9761, lon: 104.7754 },
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
  const pinBoard = document.getElementById('engraving-pins');
  const dividers = document.getElementById('dividers');

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
    };

    gl.useProgram(program);
    gl.enableVertexAttribArray(0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const draw = (part, mvp, alpha, ink) => {
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
        gl.uniform4f(uColor, ink[0], ink[1], ink[2], ink[3] * alpha);
      }
      gl.drawArrays(part.mode, 0, part.count);
    };

    /* The ink is a stylesheet decision, so both editions can set their own. */
    const ink = new Float32Array([0, 0, 0, 0.75]);
    const readInk = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--engraving-ink').trim();
      const parts = value.split(/[\s,/]+/).map(Number).filter(Number.isFinite);
      if (parts.length >= 3) {
        ink[0] = parts[0] / 255;
        ink[1] = parts[1] / 255;
        ink[2] = parts[2] / 255;
        if (parts.length >= 4) ink[3] = parts[3];
      }
    };

    let width = 1;
    let height = 1;
    let roomy = true;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      width = Math.max(Math.round(innerWidth * dpr), 1);
      height = Math.max(Math.round(innerHeight * dpr), 1);
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      roomy = innerWidth >= 1024;
    };

    const pointer = { x: 0, y: 0, sx: -400, sy: -400 };
    const eased = { turn: 0, x: 0, y: 0, cx: -400, cy: -400 };
    const pins = PLACES.map((place) => ({
      ...place,
      node: pinBoard?.querySelector(`[data-pin="${place.id}"]`) ?? null,
      point: onSphere(place.lat, place.lon, 1.01),
    }));

    const progress = () => {
      const travel = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      return clamp01(scrollY / travel);
    };

    const pose = () => ({
      turn: progress(),
      x: pointer.x,
      y: pointer.y,
      cx: pointer.sx,
      cy: pointer.sy,
    });

    const render = () => {
      const p = eased.turn;
      const projection = perspective(0.6, width / height, 0.1, 60);

      /* The two acts cross over once, and only once. */
      const bustAlpha = 1 - ease(clamp01((p - ACT.close * 0.5) / (ACT.open - ACT.close * 0.5)));
      const globeAlpha = ease(clamp01((p - ACT.close) / (ACT.open - ACT.close)));

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      if (bustAlpha > 0.002) {
        const yaw = -0.5 + (p / ACT.open) * 1.5 + eased.x * 0.34;
        const model = mul(
          mul(translate(roomy ? 1.32 : 0, 0, roomy ? -4.4 : -6.2), rotY(yaw)),
          rotX(eased.y * 0.22),
        );
        const mvp = mul(projection, model);
        draw(parts.bustFill, mvp, bustAlpha, ink);
        draw(parts.bustLines, mvp, bustAlpha, ink);
      }

      let globeMvp = null;
      let spun = null;

      if (globeAlpha > 0.002) {
        /* Turned so Sumatra faces the reader as the education section lands,
           then kept slowly drifting for the rest of the page. */
        const yaw = -102.2 * RAD + (p - 0.55) * 1.5 + eased.x * 0.30;
        const pitch = 0.30 + eased.y * 0.16;
        spun = mul(rotX(pitch), rotY(yaw));
        const model = mul(
          translate(roomy ? 1.45 : 0.15, 0, roomy ? -4.0 : -6.4),
          mul(spun, scale(1)),
        );
        globeMvp = mul(projection, model);

        draw(parts.globeFill, globeMvp, globeAlpha, ink);
        draw(parts.grid, globeMvp, globeAlpha * 0.42, ink);
        draw(parts.coast, globeMvp, globeAlpha, ink);
        draw(parts.rings, globeMvp, globeAlpha * 0.8, ink);
      }

      /* The labels are ordinary HTML, moved to wherever their point landed. */
      for (const pin of pins) {
        if (!pin.node) continue;
        if (!globeMvp || globeAlpha <= 0.02) { pin.node.style.opacity = '0'; continue; }

        const [x, y, z] = pin.point;
        const facing = spun[2] * x + spun[6] * y + spun[10] * z;
        const clip = apply(globeMvp, x, y, z);
        if (clip[3] <= 0 || facing <= 0.12) { pin.node.style.opacity = '0'; continue; }

        const sx = ((clip[0] / clip[3]) * 0.5 + 0.5) * innerWidth;
        const sy = (0.5 - (clip[1] / clip[3]) * 0.5) * innerHeight;
        pin.node.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
        pin.node.style.opacity = (globeAlpha * clamp01((facing - 0.12) / 0.25)).toFixed(3);
      }

      if (dividers) {
        dividers.style.transform =
          `translate3d(${eased.cx.toFixed(1)}px, ${eased.cy.toFixed(1)}px, 0)`;
      }
    };

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
      render();

      const rest = Math.abs(want.turn - eased.turn) * 40
        + Math.abs(want.x - eased.x)
        + Math.abs(want.y - eased.y)
        + (Math.abs(want.cx - eased.cx) + Math.abs(want.cy - eased.cy)) * 0.01;

      if (rest > 0.002) requestAnimationFrame(settle);
      else running = false;
    };

    const nudge = () => {
      if (still || running) return;
      running = true;
      requestAnimationFrame(settle);
    };

    const jump = () => Object.assign(eased, pose());

    readInk();
    resize();
    jump();
    render();
    canvas.dataset.ready = 'true';
    pinBoard?.setAttribute('data-ready', 'true');

    if (!still) {
      addEventListener('scroll', nudge, { passive: true });
      addEventListener('pointermove', (event) => {
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
    }

    addEventListener('resize', () => { resize(); jump(); render(); }, { passive: true });

    new MutationObserver(() => { readInk(); render(); })
      .observe(document.documentElement, { attributeFilter: ['data-theme'] });
  }).catch((error) => {
    console.error('[portfolio] the plate could not be cut:', error);
  });
}
