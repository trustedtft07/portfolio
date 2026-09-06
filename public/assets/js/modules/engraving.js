/**
 * The engraved bust.
 *
 * A hidden-line drawing of a real 3D model, rendered with hand-written WebGL —
 * no library, no build step, in keeping with the rest of the page. The model is
 * a low-poly bust by Eric Wilson, used under CC BY, stripped to positions and
 * triangle indices; everything else the plate needs is derived here.
 *
 * The drawing turns with the scroll and leans toward the pointer. The solid is
 * painted into the depth buffer alone, so only the lines a reader would see on
 * a real engraving survive.
 */

const MODEL = '/assets/models/bust.glb';
const CREASE = Math.cos((16 * Math.PI) / 180); /* keep an edge sharper than this */

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

/* ---- Reading the model -------------------------------------------------- */

const TYPED = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

async function loadModel(url) {
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
 * actually cut: the silhouette, and the creases where two facets meet at an
 * angle. A full wireframe reads as mesh, not as a drawing.
 */
function engrave(positions, triangles) {
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
  const faces = new Uint32Array(triangles.length);
  for (let i = 0; i < triangles.length; i++) faces[i] = to[triangles[i]];

  const edges = new Map();

  for (let t = 0; t < faces.length; t += 3) {
    const a = faces[t];
    const b = faces[t + 1];
    const c = faces[t + 2];

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

  const lines = [];
  for (const { p, q, first, second } of edges.values()) {
    const sharp = !second
      || first[0] * second[0] + first[1] * second[1] + first[2] * second[2] < CREASE;
    if (sharp) lines.push(p, q);
  }

  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    minX = Math.min(minX, points[i]); maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]); maxY = Math.max(maxY, points[i + 1]);
    minZ = Math.min(minZ, points[i + 2]); maxZ = Math.max(maxZ, points[i + 2]);
  }

  return {
    points,
    faces,
    lines: new Uint32Array(lines),
    centre: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    radius: Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 || 1,
  };
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

  loadModel(MODEL).then((raw) => {
    const plate = engrave(raw.positions, raw.triangles);
    const program = compile(gl);
    const uMvp = gl.getUniformLocation(program, 'uMvp');
    const uColor = gl.getUniformLocation(program, 'uColor');

    const points = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, points);
    gl.bufferData(gl.ARRAY_BUFFER, plate.points, gl.STATIC_DRAW);

    /* WebGL 1 needs an extension before it will read 32-bit indices. */
    const wide = typeof WebGL2RenderingContext !== 'undefined'
      && gl instanceof WebGL2RenderingContext
      || gl.getExtension('OES_element_index_uint');
    const narrow = (source) => (wide ? source : Uint16Array.from(source));
    const faces = narrow(plate.faces);
    const lines = narrow(plate.lines);
    const indexType = faces.BYTES_PER_ELEMENT === 4 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

    const faceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faceBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faces, gl.STATIC_DRAW);

    const lineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lines, gl.STATIC_DRAW);

    gl.useProgram(program);
    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, points);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    /* The ink is a stylesheet decision, so both editions can set their own. */
    const ink = new Float32Array([0, 0, 0, 0.9]);
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
    let offsetX = 0;
    let distance = 3.2;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      width = Math.max(Math.round(innerWidth * dpr), 1);
      height = Math.max(Math.round(innerHeight * dpr), 1);
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);

      /* A narrow column gets a smaller plate, set behind the measure rather
         than beside it, so it never competes with the text. */
      const roomy = innerWidth >= 1024;
      offsetX = roomy ? 1.15 : 0;
      distance = roomy ? 4.3 : 6.2;
    };

    const pointer = { x: 0, y: 0 };
    const eased = { turn: 0, x: 0, y: 0 };

    const pose = () => {
      const travel = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      const through = Math.min(Math.max(scrollY / travel, 0), 1);
      return {
        turn: -0.35 + through * Math.PI * 2.1,
        x: pointer.x * 0.34,
        y: pointer.y * 0.22,
      };
    };

    const draw = () => {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const placed = mul(translate(offsetX, 0, -distance), rotY(eased.turn + eased.x));
      const turned = mul(placed, rotX(eased.y));
      const centred = mul(
        scale(1 / plate.radius),
        translate(-plate.centre[0], -plate.centre[1], -plate.centre[2]),
      );
      const mvp = mul(perspective(0.6, width / height, 0.1, 40), mul(turned, centred));

      gl.uniformMatrix4fv(uMvp, false, mvp);

      /* The solid goes into the depth buffer only: it hides the lines behind
         the surface without laying down any ink of its own. */
      gl.colorMask(false, false, false, false);
      gl.depthFunc(gl.LESS);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faceBuffer);
      gl.drawElements(gl.TRIANGLES, faces.length, indexType, 0);

      gl.colorMask(true, true, true, true);
      gl.depthFunc(gl.LEQUAL);
      gl.uniform4fv(uColor, ink);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuffer);
      gl.drawElements(gl.LINES, lines.length, indexType, 0);
    };

    let running = false;

    const settle = () => {
      const want = pose();
      eased.turn += (want.turn - eased.turn) * 0.09;
      eased.x += (want.x - eased.x) * 0.06;
      eased.y += (want.y - eased.y) * 0.06;
      draw();

      const rest = Math.abs(want.turn - eased.turn)
        + Math.abs(want.x - eased.x)
        + Math.abs(want.y - eased.y);

      if (rest > 0.0004) requestAnimationFrame(settle);
      else running = false;
    };

    const nudge = () => {
      if (still || running) return;
      running = true;
      requestAnimationFrame(settle);
    };

    const settleNow = () => {
      const want = pose();
      eased.turn = want.turn;
      eased.x = want.x;
      eased.y = want.y;
    };

    readInk();
    resize();
    settleNow();
    draw();
    canvas.dataset.ready = 'true';

    if (!still) {
      addEventListener('scroll', nudge, { passive: true });
      addEventListener('pointermove', (event) => {
        pointer.x = (event.clientX / innerWidth) * 2 - 1;
        pointer.y = (event.clientY / innerHeight) * 2 - 1;
        nudge();
      }, { passive: true });
    }

    addEventListener('resize', () => {
      resize();
      settleNow();
      draw();
    }, { passive: true });

    new MutationObserver(() => {
      readInk();
      draw();
    }).observe(document.documentElement, { attributeFilter: ['data-theme'] });
  }).catch((error) => {
    console.error('[portfolio] the engraving could not be cut:', error);
  });
}
