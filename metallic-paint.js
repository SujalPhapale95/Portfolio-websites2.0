/**
 * ═══════════════════════════════════════════════════════════════════
 * METALLIC PAINT WEBGL2 ENGINE
 * Ported & Optimized from React Bits for Vanilla HTML5/JS
 * Provides real-time liquid chrome / metallic reflections on custom
 * monochrome silhouettes with Poisson contour beveling & tilt optics.
 * ═══════════════════════════════════════════════════════════════════
 */

(function (global) {
  'use strict';

  const WORKING_SIZE = 384;
  const MAX_SIDE = 1024;
  const MAX_PIXELS = 1920 * 1080 * 2;

  const VERTEX_SHADER_SRC = `#version 300 es
layout(location = 0) in vec2 a_position;
uniform vec2 u_resolution;
uniform float u_imageAspect;
uniform float u_scale;
uniform float u_rotation;
out vec2 v_imageUV;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  vec2 uv = a_position * 0.5;
  float r = u_rotation * 3.14159265358979323846 / 180.0;
  mat2 turn = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 imageBox;
  imageBox.x = min(u_resolution.x / u_imageAspect, u_resolution.y) * u_imageAspect;
  imageBox.y = imageBox.x / u_imageAspect;
  v_imageUV = uv * (u_resolution / imageBox) / u_scale;
  v_imageUV.x *= u_imageAspect;
  v_imageUV = turn * v_imageUV;
  v_imageUV.x /= u_imageAspect;
  v_imageUV += 0.5;
  v_imageUV.y = 1.0 - v_imageUV.y;
}`;

  const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_colorBack;
uniform vec4 u_colorTint;
uniform float u_softness;
uniform float u_repetition;
uniform float u_shiftRed;
uniform float u_shiftBlue;
uniform float u_distortion;
uniform float u_contour;
uniform float u_angle;
uniform vec2 u_tilt;
uniform float u_reveal;
uniform float u_light;

in vec2 v_imageUV;
out vec4 fragColor;

#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float getColorChanges(float c1, float c2, float stripe, vec3 w, float blur, float bump, float tint) {
  float ch = mix(c2, c1, smoothstep(0.0, 2.0 * blur, stripe));
  float border = w[0];
  ch = mix(ch, c2, smoothstep(border, border + 2.0 * blur, stripe));
  bump = smoothstep(0.2, 0.8, bump);
  border = w[0] + 0.4 * (1.0 - bump) * w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2.0 * blur, stripe));
  border = w[0] + 0.5 * (1.0 - bump) * w[1];
  ch = mix(ch, c2, smoothstep(border, border + 2.0 * blur, stripe));
  border = w[0] + w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2.0 * blur, stripe));
  float gradientT = (stripe - w[0] - w[1]) / w[2];
  float gradient = mix(c1, c2, smoothstep(0.0, 1.0, gradientT));
  ch = mix(ch, gradient, smoothstep(border, border + 0.5 * blur, stripe));
  ch = mix(ch, 1.0 - min(1.0, (1.0 - ch) / max(tint, 0.0001)), u_colorTint.a);
  return ch;
}

float getImgFrame(vec2 uv, float th) {
  float frame = 1.0;
  frame *= smoothstep(0.0, th, uv.y);
  frame *= 1.0 - smoothstep(1.0 - th, 1.0, uv.y);
  frame *= smoothstep(0.0, th, uv.x);
  frame *= 1.0 - smoothstep(1.0 - th, 1.0, uv.x);
  return frame;
}

float blurEdge3x3(sampler2D tex, vec2 uv, vec2 dudx, vec2 dudy, float radius, float centerSample) {
  vec2 texel = 1.0 / vec2(textureSize(tex, 0));
  vec2 r = radius * texel;
  float sum = 4.0 * centerSample;
  sum += 2.0 * textureGrad(tex, uv + vec2(0.0, -r.y), dudx, dudy).r;
  sum += 2.0 * textureGrad(tex, uv + vec2(0.0, r.y), dudx, dudy).r;
  sum += 2.0 * textureGrad(tex, uv + vec2(-r.x, 0.0), dudx, dudy).r;
  sum += 2.0 * textureGrad(tex, uv + vec2(r.x, 0.0), dudx, dudy).r;
  sum += textureGrad(tex, uv + vec2(-r.x, -r.y), dudx, dudy).r;
  sum += textureGrad(tex, uv + vec2(r.x, -r.y), dudx, dudy).r;
  sum += textureGrad(tex, uv + vec2(-r.x, r.y), dudx, dudy).r;
  sum += textureGrad(tex, uv + vec2(r.x, r.y), dudx, dudy).r;
  return sum / 16.0;
}

void main() {
  const float firstFrameOffset = 2.8;
  float t = 0.3 * (u_time + firstFrameOffset);

  vec2 uv = v_imageUV;
  vec2 dudx = dFdx(v_imageUV);
  vec2 dudy = dFdy(v_imageUV);
  vec4 img = textureGrad(u_image, uv, dudx, dudy);

  float cycleWidth = u_repetition;

  vec2 rotatedUV = uv - vec2(0.5);
  float angle = (-u_angle + 70.0) * PI / 180.0;
  float cosA = cos(angle);
  float sinA = sin(angle);
  rotatedUV = vec2(rotatedUV.x * cosA - rotatedUV.y * sinA, rotatedUV.x * sinA + rotatedUV.y * cosA) + vec2(0.5);

  float edge = blurEdge3x3(u_image, uv, dudx, dudy, 6.0, img.r);
  edge = pow(edge, 1.6);
  edge *= smoothstep(0.0, 0.4, u_contour);

  float opacity = img.g * getImgFrame(v_imageUV, 0.0);
  float depth = img.r;

  float diagBLtoTR = rotatedUV.x - rotatedUV.y;
  float diagTLtoBR = rotatedUV.x + rotatedUV.y;

  vec3 color1 = mix(vec3(0.98, 0.98, 1.0), vec3(0.9, 0.9, 0.93), u_light);
  vec3 color2 = vec3(0.1, 0.1, 0.1 + 0.1 * smoothstep(0.7, 1.3, diagTLtoBR));

  vec2 gradUV = uv - 0.5 - u_tilt * vec2(0.18, -0.12);
  float dist = length(gradUV + vec2(0.0, 0.2 * diagBLtoTR));
  gradUV = rotate(gradUV, (0.25 - 0.2 * diagBLtoTR) * PI);
  float direction = gradUV.x;

  float bump = pow(1.8 * dist, 1.2);
  bump = 1.0 - bump;
  bump *= pow(uv.y, 0.3);

  float thinStrip1 = 0.12 / cycleWidth * (1.0 - 0.4 * bump);
  float thinStrip2 = 0.07 / cycleWidth * (1.0 + 0.4 * bump);
  float wideStrip = 1.0 - thinStrip1 - thinStrip2;

  float noise = snoise(uv - t);
  edge += (1.0 - edge) * u_distortion * noise;

  direction += diagBLtoTR;
  direction -= 2.0 * noise * diagBLtoTR * (smoothstep(0.0, 1.0, edge) * (1.0 - smoothstep(0.0, 1.0, edge)));
  direction *= mix(1.0, 1.0 - edge, smoothstep(0.5, 1.0, u_contour));
  direction -= 1.7 * edge * smoothstep(0.5, 1.0, u_contour);
  direction += 0.2 * pow(u_contour, 4.0) * (1.0 - smoothstep(0.0, 1.0, edge));

  bump *= clamp(pow(uv.y, 0.1), 0.3, 1.0);
  direction *= 0.1 + (1.1 - edge) * bump;
  direction *= 0.4 + 0.6 * (1.0 - smoothstep(0.5, 1.0, edge));
  direction += 0.18 * (smoothstep(0.1, 0.2, uv.y) * (1.0 - smoothstep(0.2, 0.4, uv.y)));
  direction += 0.03 * (smoothstep(0.1, 0.2, 1.0 - uv.y) * (1.0 - smoothstep(0.2, 0.4, 1.0 - uv.y)));
  direction *= 0.5 + 0.5 * pow(uv.y, 2.0);
  direction *= cycleWidth;
  direction -= t + dot(u_tilt, vec2(0.35, 0.2));

  float colorDispersion = clamp(1.0 - bump, 0.0, 1.0);
  float dispersionRed = colorDispersion;
  dispersionRed += 0.03 * bump * noise;
  dispersionRed += 5.0 * (smoothstep(-0.1, 0.2, uv.y) * (1.0 - smoothstep(0.1, 0.5, uv.y))) * (smoothstep(0.4, 0.6, bump) * (1.0 - smoothstep(0.4, 1.0, bump)));
  dispersionRed -= diagBLtoTR;

  float dispersionBlue = colorDispersion * 1.3;
  dispersionBlue += (smoothstep(0.0, 0.4, uv.y) * (1.0 - smoothstep(0.1, 0.8, uv.y))) * (smoothstep(0.4, 0.6, bump) * (1.0 - smoothstep(0.4, 0.8, bump)));
  dispersionBlue -= 0.2 * edge;

  dispersionRed *= u_shiftRed / 20.0;
  dispersionBlue *= u_shiftBlue / 20.0;

  float softness = 0.05 * u_softness;
  float blur = softness + 0.5 * smoothstep(1.0, 10.0, u_repetition) * smoothstep(0.0, 1.0, edge);
  float smallCanvas = 1.0 - smoothstep(100.0, 500.0, min(u_resolution.x, u_resolution.y));
  blur += smallCanvas * smoothstep(0.0, 1.0, edge);
  float rExtraBlur = softness * (0.05 + 0.1 * (u_shiftRed / 20.0) * bump);
  float gExtraBlur = softness * 0.05 / max(0.001, abs(1.0 - diagBLtoTR));

  vec3 w = vec3(thinStrip1 * cycleWidth, thinStrip2 * cycleWidth, wideStrip);
  w[1] -= 0.02 * smoothstep(0.0, 1.0, edge + bump);
  float stripeR = fract(direction + dispersionRed);
  float r = getColorChanges(color1.r, color2.r, stripeR, w, blur + fwidth(stripeR) + rExtraBlur, bump, u_colorTint.r);
  float stripeG = fract(direction);
  float g = getColorChanges(color1.g, color2.g, stripeG, w, blur + fwidth(stripeG) + gExtraBlur, bump, u_colorTint.g);
  float stripeB = fract(direction - dispersionBlue);
  float b = getColorChanges(color1.b, color2.b, stripeB, w, blur + fwidth(stripeB), bump, u_colorTint.b);

  vec3 sheen = mix(vec3(1.0), u_colorTint.rgb, 0.45 * u_colorTint.a);
  r *= sheen.r;
  g *= sheen.g;
  b *= sheen.b;

  float rim = smoothstep(0.78, 1.0, depth) * u_light;
  r *= 1.0 - rim * 0.62;
  g *= 1.0 - rim * 0.62;
  b *= 1.0 - rim * 0.58;

  float pour = u_reveal * 1.25 - 0.1;
  opacity *= smoothstep(1.0 - pour, 1.15 - pour, depth) * smoothstep(0.0, 0.25, u_reveal);

  vec3 color = vec3(r, g, b) * opacity;
  vec3 back = u_colorBack.rgb * u_colorBack.a;
  color += back * (1.0 - opacity);
  opacity += u_colorBack.a * (1.0 - opacity);
  color += 1.0 / 256.0 * (fract(sin(dot(0.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - 0.5);
  fragColor = vec4(color, opacity);
}`;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const parseColor = (() => {
    let context = null;
    return (value, fallback) => {
      if (typeof document === 'undefined') return fallback;
      if (!context) {
        const c = document.createElement('canvas');
        c.width = 1;
        c.height = 1;
        context = c.getContext('2d', { willReadFrequently: true });
      }
      if (!context) return fallback;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'rgba(0, 0, 0, 0)';
      context.fillStyle = String(value);
      context.fillRect(0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      return [data[0] / 255, data[1] / 255, data[2] / 255, data[3] / 255];
    };
  })();

  const loadImage = src =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('MetallicPaint: failed to load the image'));
      image.src = src;
    });

  const isVector = async src => {
    if (/\.svg($|[?#])/i.test(src) || src.startsWith('data:image/svg+xml')) return true;
    if (!src.startsWith('blob:')) return false;
    try {
      const blob = await (await fetch(src)).blob();
      return blob.type === 'image/svg+xml';
    } catch {
      return false;
    }
  };

  const drawImageSource = async src => {
    const [image, vector] = await Promise.all([loadImage(src), isVector(src)]);
    let width = image.naturalWidth || image.width || MAX_SIDE;
    let height = image.naturalHeight || image.height || MAX_SIDE;
    const longest = Math.max(width, height);
    const fit = vector ? MAX_SIDE / longest : clamp(512 / longest, 1, MAX_SIDE / longest);
    width = Math.max(1, Math.round(width * fit));
    height = Math.max(1, Math.round(height * fit));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height);
    let opaque = true;
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i] < 250) {
        opaque = false;
        break;
      }
    }
    if (opaque) {
      for (let i = 0; i < data.data.length; i += 4) {
        const light = Math.min(data.data[i], data.data[i + 1], data.data[i + 2]);
        data.data[i + 3] = Math.round(clamp((250 - light) / 30, 0, 1) * 255);
      }
      ctx.putImageData(data, 0, 0);
    }
    return canvas;
  };

  const solvePoisson = (mask, width, height) => {
    const interior = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!mask[i]) continue;
        const boundary =
          x === 0 ||
          y === 0 ||
          x === width - 1 ||
          y === height - 1 ||
          !mask[i - 1] ||
          !mask[i + 1] ||
          !mask[i - width] ||
          !mask[i + width] ||
          !mask[i - width - 1] ||
          !mask[i - width + 1] ||
          !mask[i + width - 1] ||
          !mask[i + width + 1];
        if (!boundary) interior.push(i);
      }
    }
    const field = new Float32Array(width * height);
    const red = [];
    const black = [];
    interior.forEach(i => (((i % width) + Math.floor(i / width)) % 2 === 0 ? red.push(i) : black.push(i)));
    const relax = list => {
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        const sum = field[i + 1] + field[i - 1] + field[i - width] + field[i + width];
        field[i] = 1.9 * ((0.01 + sum) / 4) - 0.9 * field[i];
      }
    };
    for (let iteration = 0; iteration < 40; iteration++) {
      relax(red);
      relax(black);
    }
    let peak = 0;
    interior.forEach(i => {
      if (field[i] > peak) peak = field[i];
    });
    return { field, peak: peak || 1 };
  };

  const processShape = source => {
    const width = source.width;
    const height = source.height;
    const fit = WORKING_SIZE / Math.min(width, height);
    const workW = Math.max(2, Math.round(width * fit));
    const workH = Math.max(2, Math.round(height * fit));

    const small = document.createElement('canvas');
    small.width = workW;
    small.height = workH;
    const smallCtx = small.getContext('2d', { willReadFrequently: true });
    smallCtx.drawImage(source, 0, 0, workW, workH);
    const smallData = smallCtx.getImageData(0, 0, workW, workH).data;
    const mask = new Uint8Array(workW * workH);
    for (let i = 0; i < mask.length; i++) mask[i] = smallData[i * 4 + 3] > 0 ? 1 : 0;

    const { field, peak } = solvePoisson(mask, workW, workH);
    const gradient = smallCtx.createImageData(workW, workH);
    for (let i = 0; i < mask.length; i++) {
      const p = i * 4;
      const value = mask[i] ? 255 * (1 - field[i] / peak) : 255;
      gradient.data[p] = value;
      gradient.data[p + 1] = value;
      gradient.data[p + 2] = value;
      gradient.data[p + 3] = mask[i] ? 255 : 0;
    }
    smallCtx.putImageData(gradient, 0, 0);

    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const outCtx = out.getContext('2d', { willReadFrequently: true });
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(small, 0, 0, workW, workH, 0, 0, width, height);
    const result = outCtx.getImageData(0, 0, width, height);
    const original = source.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    for (let i = 0; i < result.data.length; i += 4) {
      const alpha = original[i + 3];
      if (alpha === 0) {
        result.data[i] = 255;
        result.data[i + 1] = 0;
      } else {
        result.data[i] = result.data[i + 3] === 0 ? 0 : result.data[i];
        result.data[i + 1] = alpha;
      }
      result.data[i + 2] = 255;
      result.data[i + 3] = 255;
    }
    return result;
  };

  const compile = (gl, type, source) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.warn('MetallicPaint shader error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  };

  /**
   * Initializes a MetallicPaint WebGL2 canvas inside a container element.
   * @param {HTMLElement|string} target - Container element or selector
   * @param {Object} [userOptions] - Configuration options
   */
  function createMetallicPaint(target, userOptions = {}) {
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) return null;

    let canvas = container.querySelector('canvas.metallic-paint-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'metallic-paint-canvas';
      container.appendChild(canvas);
    }

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: 'high-performance'
    });

    if (!gl) {
      console.warn('MetallicPaint: WebGL2 not supported in this environment.');
      return null;
    }

    const settings = {
      imageSrc: userOptions.imageSrc || 'assets/images/logo-celestial.png',
      tint: parseColor(userOptions.color ?? '#ffffff', [1, 1, 1, 1]),
      back: parseColor(userOptions.backgroundColor ?? 'transparent', [0, 0, 0, 0]),
      density: clamp(userOptions.density ?? 2.2, 0.5, 12),
      softness: clamp(userOptions.softness ?? 0.08, 0, 1),
      dispersion: clamp(userOptions.dispersion ?? 0.35, -1, 1),
      distortion: clamp(userOptions.distortion ?? 0.06, 0, 1),
      edgeBend: clamp(userOptions.edgeBend ?? 0.65, 0, 1),
      angle: userOptions.angle ?? 70,
      speed: userOptions.speed ?? 0.85,
      scale: Math.max(0.05, userOptions.scale ?? 0.78),
      rotation: userOptions.rotation ?? 0,
      mouseTilt: clamp(userOptions.mouseTilt ?? 0.8, 0, 1.5),
      lightMode: Boolean(userOptions.lightMode),
      intro: userOptions.intro === true,
      paused: Boolean(userOptions.paused),
      dpr: userOptions.dpr
    };

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('MetallicPaint: Failed to link WebGL program');
      return null;
    }
    gl.useProgram(program);

    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(uniforms.u_image, 0);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const state = {
      raf: 0,
      last: 0,
      time: 0,
      visible: true,
      pending: false,
      hasImage: false,
      imageAspect: 1024 / 875,
      width: 0,
      height: 0,
      revealStart: -1,
      reveal: 1,
      tiltX: 0,
      tiltY: 0,
      velocityX: 0,
      velocityY: 0,
      targetX: 0,
      targetY: 0,
      alive: true
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const base = settings.dpr ?? Math.min(window.devicePixelRatio || 1, 2);
      let ratio = Math.max(base, 2);
      const pixels = rect.width * rect.height * ratio * ratio;
      if (pixels > MAX_PIXELS) ratio *= Math.sqrt(MAX_PIXELS / pixels);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (width === state.width && height === state.height) return;
      state.width = width;
      state.height = height;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };

    const draw = () => {
      if (state.pending || !state.hasImage) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
      gl.useProgram(program);
      gl.uniform2f(uniforms.u_resolution, state.width, state.height);
      gl.uniform1f(uniforms.u_time, state.time);
      gl.uniform1f(uniforms.u_imageAspect, state.imageAspect);
      gl.uniform1f(uniforms.u_scale, settings.scale);
      gl.uniform1f(uniforms.u_rotation, settings.rotation);
      gl.uniform4f(uniforms.u_colorBack, settings.back[0], settings.back[1], settings.back[2], settings.back[3]);
      gl.uniform4f(uniforms.u_colorTint, settings.tint[0], settings.tint[1], settings.tint[2], settings.tint[3]);
      gl.uniform1f(uniforms.u_softness, settings.softness);
      gl.uniform1f(uniforms.u_repetition, settings.density);
      gl.uniform1f(uniforms.u_shiftRed, settings.dispersion);
      gl.uniform1f(uniforms.u_shiftBlue, settings.dispersion);
      gl.uniform1f(uniforms.u_distortion, settings.distortion);
      gl.uniform1f(uniforms.u_contour, settings.edgeBend);
      gl.uniform1f(uniforms.u_angle, settings.angle);
      gl.uniform2f(uniforms.u_tilt, state.tiltX, state.tiltY);
      gl.uniform1f(uniforms.u_reveal, state.reveal);
      gl.uniform1f(uniforms.u_light, settings.lightMode ? 1 : 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const frame = now => {
      state.raf = 0;
      if (!state.alive) return;
      const dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 1 / 60;
      state.last = now;
      const moving = !settings.paused && !reduceMotion && settings.speed !== 0;
      if (moving) state.time += dt * settings.speed;

      let busy = moving;
      if (state.reveal < 1 && !state.pending) {
        if (state.revealStart < 0) state.revealStart = now;
        const progress = clamp((now - state.revealStart) / 1600, 0, 1);
        state.reveal = 1 - (1 - progress) ** 3;
        if (moving) state.time += dt * 2.4 * (1 - progress) ** 2;
        busy = true;
      }

      const stiffness = 60;
      const damping = 14;
      const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        state.velocityX += (stiffness * (state.targetX * settings.mouseTilt - state.tiltX) - damping * state.velocityX) * h;
        state.velocityY += (stiffness * (state.targetY * settings.mouseTilt - state.tiltY) - damping * state.velocityY) * h;
        state.tiltX += state.velocityX * h;
        state.tiltY += state.velocityY * h;
      }
      if (
        Math.abs(state.targetX * settings.mouseTilt - state.tiltX) > 0.0005 ||
        Math.abs(state.targetY * settings.mouseTilt - state.tiltY) > 0.0005 ||
        Math.abs(state.velocityX) + Math.abs(state.velocityY) > 0.0005
      ) {
        busy = true;
      }

      draw();
      if (busy && state.visible) {
        state.raf = requestAnimationFrame(frame);
      } else {
        state.last = 0;
      }
    };

    const wake = () => {
      if (!state.raf && state.alive && state.visible) {
        state.raf = requestAnimationFrame(frame);
      }
    };

    const onPointerMove = event => {
      const rect = container.getBoundingClientRect();
      state.targetX = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1.2, 1.2);
      state.targetY = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1.2, 1.2);
      wake();
    };

    const onPointerLeave = () => {
      state.targetX = 0;
      state.targetY = 0;
      wake();
    };

    // Listen on container as well as parent brand link for fluid hover reaction
    const brandLink = container.closest('a') || container;
    container.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });
    if (brandLink !== container) {
      brandLink.addEventListener('pointermove', onPointerMove, { passive: true });
      brandLink.addEventListener('pointerleave', onPointerLeave, { passive: true });
    }

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw();
    });
    resizeObserver.observe(container);

    const visibilityObserver = new IntersectionObserver(entries => {
      state.visible = entries.some(entry => entry.isIntersecting);
      if (state.visible) wake();
    });
    visibilityObserver.observe(container);

    const onLost = event => {
      event.preventDefault();
      state.alive = false;
      cancelAnimationFrame(state.raf);
    };
    canvas.addEventListener('webglcontextlost', onLost);

    const setImageData = data => {
      state.pending = false;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        state.imageAspect = data.width / data.height;
        state.hasImage = true;
      } else {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([255, 0, 255, 255])
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        state.imageAspect = 1;
        state.hasImage = false;
      }
      draw();
      wake();
    };

    // Load and process source image
    state.pending = true;
    drawImageSource(settings.imageSrc)
      .then(sourceCanvas => {
        if (!state.alive || !sourceCanvas) return;
        const processed = processShape(sourceCanvas);
        if (state.alive) {
          setImageData(processed);
          // Show container, hide fallback if any
          container.classList.add('ready');
          const fallback = container.parentElement ? container.parentElement.querySelector('.brand-monogram') : null;
          if (fallback) fallback.classList.add('metallic-active');
        }
      })
      .catch(err => {
        console.warn('MetallicPaint: Failed to load/process image', err);
        state.pending = false;
        setImageData(null);
      });

    resize();
    draw();
    wake();

    return {
      destroy: () => {
        state.alive = false;
        cancelAnimationFrame(state.raf);
        resizeObserver.disconnect();
        visibilityObserver.disconnect();
        canvas.removeEventListener('webglcontextlost', onLost);
        container.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('pointerleave', onPointerLeave);
        if (brandLink !== container) {
          brandLink.removeEventListener('pointermove', onPointerMove);
          brandLink.removeEventListener('pointerleave', onPointerLeave);
        }
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteVertexArray(vao);
        gl.deleteProgram(program);
      },
      redraw: () => {
        resize();
        draw();
        wake();
      },
      setPaused: val => {
        settings.paused = Boolean(val);
        wake();
      },
      setColor: hex => {
        settings.tint = parseColor(hex, [1, 1, 1, 1]);
        draw();
      }
    };
  }

  // Auto-initialize any elements with data-metallic-paint attribute on DOM ready
  function autoInit() {
    const elements = document.querySelectorAll('[data-metallic-paint="true"]');
    elements.forEach(el => {
      const src = el.getAttribute('data-image-src') || 'assets/images/logo-celestial.png';
      const color = el.getAttribute('data-color') || '#ffffff';
      const scale = parseFloat(el.getAttribute('data-scale')) || 0.82;
      const speed = parseFloat(el.getAttribute('data-speed')) || 0.85;
      createMetallicPaint(el, { imageSrc: src, color, scale, speed });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // Export to global scope
  global.createMetallicPaint = createMetallicPaint;
})(window);
