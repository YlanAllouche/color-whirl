import type { GrazingMode, WallpaperConfig, WallpaperType } from './types.js';
import { DEFAULT_CONFIG_BY_TYPE } from './defaults.js';

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  // Wallpaper configs are plain JSON-like data.
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepMerge(base: any, patch: any): any {
  if (Array.isArray(base)) {
    return Array.isArray(patch) ? patch.slice() : base.slice();
  }

  if (isPlainObject(base)) {
    const out: Record<string, any> = {};
    const patchObj = isPlainObject(patch) ? patch : {};
    const keys = new Set([...Object.keys(base), ...Object.keys(patchObj)]);
    for (const key of keys) {
      out[key] = deepMerge(base[key], patchObj[key]);
    }
    return out;
  }

  return patch == null ? base : patch;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function normalizeWallpaperConfig(input: any): WallpaperConfig {
  const rawType = typeof input?.type === 'string' ? String(input.type) : 'popsicle';
  const type = (rawType in DEFAULT_CONFIG_BY_TYPE ? rawType : 'popsicle') as WallpaperType;

  const base = cloneJson(DEFAULT_CONFIG_BY_TYPE[type]);
  const merged = deepMerge(base, input ?? {});
  merged.type = type;

  // Back-compat: migrate historical `edges` -> `facades`.
  const legacyEdges = (merged as any).edges;
  if (legacyEdges && typeof legacyEdges === 'object') {
    const e: any = legacyEdges;
    const cur: any = (merged as any).facades ?? cloneJson((base as any).facades);

    const tintEnabled = !!e?.tint?.enabled;
    const matEnabled = !!e?.material?.enabled;
    const wearEnabled = !!e?.wear?.enabled;
    const rimEnabled = !!e?.rimLight?.enabled;

    const sideEnabled = tintEnabled || matEnabled;
    const grazingEnabled = wearEnabled || rimEnabled;

    const grazingMode: GrazingMode = rimEnabled && !wearEnabled ? 'add' : wearEnabled && !rimEnabled ? 'mix' : 'add';

    (merged as any).facades = {
      ...cur,
      side: {
        ...cur.side,
        enabled: sideEnabled,
        tintColor: typeof e?.tint?.color === 'string' ? e.tint.color : cur.side.tintColor,
        tintAmount: tintEnabled ? Number(e?.tint?.amount ?? cur.side.tintAmount) : 0,
        materialAmount: matEnabled ? 1.0 : 0.0,
        roughness: Number(e?.material?.roughness ?? cur.side.roughness),
        metalness: Number(e?.material?.metalness ?? cur.side.metalness),
        clearcoat: Number(e?.material?.clearcoat ?? cur.side.clearcoat),
        envIntensityMult: Number(e?.material?.envIntensityMult ?? cur.side.envIntensityMult)
      },
      grazing: {
        ...cur.grazing,
        enabled: grazingEnabled,
        mode: grazingMode,
        color:
          typeof e?.rimLight?.color === 'string'
            ? e.rimLight.color
            : typeof e?.wear?.colorShift === 'string'
              ? e.wear.colorShift
              : cur.grazing.color,
        strength: rimEnabled ? Number(e?.rimLight?.intensity ?? cur.grazing.strength) : Number(e?.wear?.intensity ?? cur.grazing.strength),
        power: rimEnabled ? Number(e?.rimLight?.power ?? cur.grazing.power) : 2.0,
        width: Number(e?.wear?.width ?? cur.grazing.width),
        noise: Number(e?.wear?.noise ?? cur.grazing.noise)
      },
      outline: {
        ...cur.outline,
        enabled: !!e?.outline?.enabled,
        color: typeof e?.outline?.color === 'string' ? e.outline.color : cur.outline.color,
        thickness: Number(e?.outline?.thickness ?? cur.outline.thickness),
        opacity: Number(e?.outline?.opacity ?? cur.outline.opacity)
      }
    };

    delete (merged as any).edges;
  }

  // Light validation for new fields (keep back-compat with missing/invalid values).
  const cm = merged.collisions?.mode;
  if (cm !== 'none' && cm !== 'carve') merged.collisions.mode = 'none';

  const dir = merged.collisions?.carve?.direction;
  if (dir !== 'oneWay' && dir !== 'twoWay') merged.collisions.carve.direction = 'oneWay';

  const edge = merged.collisions?.carve?.edge;
  if (edge !== 'hard' && edge !== 'soft') merged.collisions.carve.edge = 'hard';

  if (!Number.isFinite(Number(merged.collisions?.carve?.marginPx))) merged.collisions.carve.marginPx = 0;
  if (!Number.isFinite(Number(merged.collisions?.carve?.featherPx))) merged.collisions.carve.featherPx = 0;

  // Edge config validation.
  if (typeof (merged as any).edge?.hollow !== 'boolean') {
    (merged as any).edge = { ...(merged as any).edge, hollow: !!(merged as any).edge?.hollow };
  }

  // Bubbles config validation.
  const baseBubbles: any = (base as any).bubbles;
  const gAny: any = (merged as any).bubbles;
  if (!gAny || typeof gAny !== 'object') {
    (merged as any).bubbles = cloneJson(baseBubbles);
  } else {
    gAny.enabled = typeof gAny.enabled === 'boolean' ? gAny.enabled : !!gAny.enabled;

    gAny.mode = gAny.mode === 'cap' ? 'cap' : 'through';

    if (!gAny.interior || typeof gAny.interior !== 'object') gAny.interior = cloneJson(baseBubbles.interior);
    gAny.interior.enabled = typeof gAny.interior.enabled === 'boolean' ? gAny.interior.enabled : !!gAny.interior.enabled;

    const freq = Number(gAny.frequency);
    gAny.frequency = Number.isFinite(freq) ? clamp(freq, 0, 20) : Number(baseBubbles.frequency) || 0;
    const variance = Number(gAny.frequencyVariance);
    gAny.frequencyVariance = Number.isFinite(variance)
      ? clamp(variance, 0, 1)
      : clamp(Number(baseBubbles.frequencyVariance) || 0, 0, 1);
    const cnt = Number(gAny.count);
    gAny.count = Number.isFinite(cnt) ? Math.max(0, Math.min(16, Math.round(cnt))) : Math.round(Number(baseBubbles.count) || 0);
    const rMin = Number(gAny.radiusMin);
    const rMax = Number(gAny.radiusMax);
    gAny.radiusMin = Number.isFinite(rMin) ? Math.max(0, rMin) : Math.max(0, Number(baseBubbles.radiusMin) || 0);
    gAny.radiusMax = Number.isFinite(rMax) ? Math.max(gAny.radiusMin, rMax) : Math.max(gAny.radiusMin, Number(baseBubbles.radiusMax) || gAny.radiusMin);
    const soft = Number(gAny.softness);
    gAny.softness = Number.isFinite(soft) ? clamp(soft, 0, 2) : Math.max(0, Number(baseBubbles.softness) || 0);
    const wall = Number(gAny.wallThickness);
    gAny.wallThickness = Number.isFinite(wall)
      ? clamp(wall, 0, 1)
      : Math.max(0, Number(baseBubbles.wallThickness) || 0);
    const so = Number(gAny.seedOffset);
    gAny.seedOffset = Number.isFinite(so) ? so : Number(baseBubbles.seedOffset) || 0;
  }

  // Voronoi config validation.
  const baseVor: any = (base as any).voronoi;
  const vAny: any = (merged as any).voronoi;
  if (!vAny || typeof vAny !== 'object') {
    (merged as any).voronoi = cloneJson(baseVor);
  } else {
    vAny.enabled = typeof vAny.enabled === 'boolean' ? vAny.enabled : !!vAny.enabled;
    vAny.space = vAny.space === 'object' ? 'object' : 'world';
    vAny.kind = vAny.kind === 'cells' ? 'cells' : 'edges';
    const sc = Number(vAny.scale);
    vAny.scale = Number.isFinite(sc) ? clamp(sc, 0, 80) : clamp(Number(baseVor?.scale) || 0, 0, 80);
    const so = Number(vAny.seedOffset);
    vAny.seedOffset = Number.isFinite(so) ? so : Number(baseVor?.seedOffset) || 0;
    const amt = Number(vAny.amount);
    vAny.amount = Number.isFinite(amt) ? clamp(amt, 0, 1) : clamp(Number(baseVor?.amount) || 0, 0, 1);
    const ew = Number(vAny.edgeWidth);
    vAny.edgeWidth = Number.isFinite(ew) ? clamp(ew, 0, 1) : clamp(Number(baseVor?.edgeWidth) || 0, 0, 1);
    const sf = Number(vAny.softness);
    vAny.softness = Number.isFinite(sf) ? clamp(sf, 0, 1) : clamp(Number(baseVor?.softness) || 0, 0, 1);
    const cs = Number(vAny.colorStrength);
    vAny.colorStrength = Number.isFinite(cs) ? clamp(cs, 0, 1) : clamp(Number(baseVor?.colorStrength) || 0, 0, 1);
    const cm0 = String(vAny.colorMode ?? baseVor?.colorMode ?? 'darken');
    vAny.colorMode = cm0 === 'lighten' ? 'lighten' : cm0 === 'tint' ? 'tint' : 'darken';
    if (typeof vAny.tintColor !== 'string') vAny.tintColor = String(vAny.tintColor ?? baseVor?.tintColor ?? '#ffffff');
    const mm = String(vAny.materialMode ?? baseVor?.materialMode ?? 'both');
    vAny.materialMode = mm === 'none' ? 'none' : mm === 'roughness' ? 'roughness' : mm === 'normal' ? 'normal' : 'both';

    const mk = String(vAny.materialKind ?? baseVor?.materialKind ?? 'match');
    vAny.materialKind = mk === 'cells' ? 'cells' : mk === 'edges' ? 'edges' : 'match';
    const rs = Number(vAny.roughnessStrength);
    vAny.roughnessStrength = Number.isFinite(rs) ? clamp(rs, 0, 1) : clamp(Number(baseVor?.roughnessStrength) || 0, 0, 1);
    const ns = Number(vAny.normalStrength);
    vAny.normalStrength = Number.isFinite(ns) ? clamp(ns, 0, 1) : clamp(Number(baseVor?.normalStrength) || 0, 0, 1);
    const nsc = Number(vAny.normalScale);
    vAny.normalScale = Number.isFinite(nsc) ? clamp(nsc, 0, 1) : clamp(Number(baseVor?.normalScale) || 0, 0, 1);

    const ca = Number(vAny.crackleAmount);
    vAny.crackleAmount = Number.isFinite(ca) ? clamp(ca, 0, 1) : clamp(Number(baseVor?.crackleAmount) || 0, 0, 1);
    const csc = Number(vAny.crackleScale);
    vAny.crackleScale = Number.isFinite(csc) ? clamp(csc, 0, 200) : clamp(Number(baseVor?.crackleScale) || 0, 0, 200);

    const baseNucleus: any = baseVor?.nucleus;
    if (!vAny.nucleus || typeof vAny.nucleus !== 'object') {
      vAny.nucleus = cloneJson(baseNucleus);
    } else {
      vAny.nucleus.enabled = typeof vAny.nucleus.enabled === 'boolean' ? vAny.nucleus.enabled : !!vAny.nucleus.enabled;
      const ns0 = Number(vAny.nucleus.size);
      vAny.nucleus.size = Number.isFinite(ns0) ? clamp(ns0, 0, 1) : clamp(Number(baseNucleus?.size) || 0, 0, 1);
      const nsoft = Number(vAny.nucleus.softness);
      vAny.nucleus.softness = Number.isFinite(nsoft) ? clamp(nsoft, 0, 1) : clamp(Number(baseNucleus?.softness) || 0, 0, 1);
      const nstr = Number(vAny.nucleus.strength);
      vAny.nucleus.strength = Number.isFinite(nstr) ? clamp(nstr, 0, 1) : clamp(Number(baseNucleus?.strength) || 0, 0, 1);
      if (typeof vAny.nucleus.color !== 'string') vAny.nucleus.color = String(vAny.nucleus.color ?? baseNucleus?.color ?? '#ffffff');
    }
  }

  const edgeObj: any = (merged as any).edge;
  if (!edgeObj || typeof edgeObj !== 'object') {
    (merged as any).edge = cloneJson((base as any).edge);
  } else {
    if (!edgeObj.seam || typeof edgeObj.seam !== 'object') edgeObj.seam = cloneJson((base as any).edge.seam);
    if (!edgeObj.band || typeof edgeObj.band !== 'object') edgeObj.band = cloneJson((base as any).edge.band);
  }

  // Palette overrides validation.
  const pAny: any = (merged as any).palette;
  if (!pAny || typeof pAny !== 'object') {
    (merged as any).palette = { overrides: [] };
  } else {
    if (!Array.isArray(pAny.overrides)) pAny.overrides = [];
    pAny.overrides = pAny.overrides
      .map((v: any) => {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
        const enabled = typeof v.enabled === 'boolean' ? v.enabled : !!v.enabled;
        const freqRaw = Number(v.frequency);
        const frequency = Number.isFinite(freqRaw) ? clamp(freqRaw, 0, 1) : undefined;
        return { ...v, enabled, frequency };
      })
      .filter((v: any) => v === null || (v && typeof v === 'object'));
  }

  // Back-compat: triangles3d prisms.wallBulge -> wallBulgeX/wallBulgeY.
  if ((merged as any).type === 'triangles3d') {
    const prisms: any = (merged as any).prisms;
    if (prisms && typeof prisms === 'object') {
      const legacy = prisms.wallBulge;
      const hasLegacy = typeof legacy === 'number' && Number.isFinite(legacy);
      const hasX = typeof prisms.wallBulgeX === 'number' && Number.isFinite(prisms.wallBulgeX);
      const hasY = typeof prisms.wallBulgeY === 'number' && Number.isFinite(prisms.wallBulgeY);

      if (hasLegacy && (!hasX || !hasY)) {
        prisms.wallBulgeX = hasX ? prisms.wallBulgeX : legacy;
        prisms.wallBulgeY = hasY ? prisms.wallBulgeY : legacy;
      }
      if ('wallBulge' in prisms) delete prisms.wallBulge;

      // Light validation for new triangles3d fields.
      if (prisms.base !== 'prism' && prisms.base !== 'pyramidTri' && prisms.base !== 'pyramidSquare') prisms.base = 'prism';
      const t = Number(prisms.taper);
      prisms.taper = Number.isFinite(t) ? clamp(t, 0, 1) : 1;
      const bx = Number(prisms.wallBulgeX);
      const by = Number(prisms.wallBulgeY);
      prisms.wallBulgeX = Number.isFinite(bx) ? clamp(bx, -1, 1) : 0;
      prisms.wallBulgeY = Number.isFinite(by) ? clamp(by, -1, 1) : 0;
    }
  }

  // Basic svg config validation.
  if ((merged as any).type === 'svg2d' || (merged as any).type === 'svg3d') {
    const baseSvg: any = (base as any).svg;
    const sAny: any = (merged as any).svg;

    if (!sAny || typeof sAny !== 'object') {
      (merged as any).svg = cloneJson(baseSvg);
    } else {
      if (typeof sAny.source !== 'string') sAny.source = String(sAny.source ?? baseSvg?.source ?? '');

      const rmRaw = String(sAny.renderMode ?? baseSvg?.renderMode ?? 'auto');
      sAny.renderMode = rmRaw === 'fill' || rmRaw === 'stroke' || rmRaw === 'fill+stroke' ? rmRaw : 'auto';

      const cmRaw = String(sAny.colorMode ?? baseSvg?.colorMode ?? 'palette');
      sAny.colorMode = cmRaw === 'svg-to-palette' ? 'svg-to-palette' : 'palette';

      const mt = Number(sAny.maxTones);
      sAny.maxTones = Number.isFinite(mt) ? Math.max(1, Math.min(64, Math.round(mt))) : Math.max(1, Math.min(64, Math.round(Number(baseSvg?.maxTones) || 8)));

      const cnt = Number(sAny.count);
      sAny.count = Number.isFinite(cnt)
        ? Math.max(1, Math.round(cnt))
        : Math.max(1, Math.round(Number(baseSvg?.count) || 0));
      if ((merged as any).type === 'svg2d') {
        const rMin = Number(sAny.rMinPx);
        const rMax = Number(sAny.rMaxPx);
        sAny.rMinPx = Number.isFinite(rMin) ? Math.max(0, rMin) : Math.max(0, Number(baseSvg?.rMinPx) || 0);
        sAny.rMaxPx = Number.isFinite(rMax) ? Math.max(sAny.rMinPx, rMax) : Math.max(sAny.rMinPx, Number(baseSvg?.rMaxPx) || sAny.rMinPx);
        sAny.jitter = Number.isFinite(Number(sAny.jitter)) ? clamp(Number(sAny.jitter), 0, 1) : clamp(Number(baseSvg?.jitter) || 0, 0, 1);
        sAny.rotateJitterDeg = Number.isFinite(Number(sAny.rotateJitterDeg)) ? Number(sAny.rotateJitterDeg) : Number(baseSvg?.rotateJitterDeg) || 0;
        sAny.fillOpacity = Number.isFinite(Number(sAny.fillOpacity)) ? clamp(Number(sAny.fillOpacity), 0, 1) : clamp(Number(baseSvg?.fillOpacity) || 0, 0, 1);
        if (!sAny.stroke || typeof sAny.stroke !== 'object') sAny.stroke = cloneJson(baseSvg?.stroke);
        sAny.stroke.enabled = typeof sAny.stroke.enabled === 'boolean' ? sAny.stroke.enabled : !!sAny.stroke.enabled;
        const sw = Number(sAny.stroke.widthPx);
        sAny.stroke.widthPx = Number.isFinite(sw) ? Math.max(0, sw) : Math.max(0, Number(baseSvg?.stroke?.widthPx) || 0);
        if (typeof sAny.stroke.color !== 'string') sAny.stroke.color = String(sAny.stroke.color ?? baseSvg?.stroke?.color ?? '#000000');
        const so = Number(sAny.stroke.opacity);
        sAny.stroke.opacity = Number.isFinite(so) ? clamp(so, 0, 1) : clamp(Number(baseSvg?.stroke?.opacity) || 0, 0, 1);
        sAny.paletteMode = sAny.paletteMode === 'cycle' ? 'cycle' : 'weighted';
        if (!Array.isArray(sAny.colorWeights)) sAny.colorWeights = Array.isArray(baseSvg?.colorWeights) ? baseSvg.colorWeights.slice() : [];
      } else {
        const spread = Number(sAny.spread);
        const depth = Number(sAny.depth);
        sAny.spread = Number.isFinite(spread) ? Math.max(0, spread) : Math.max(0, Number(baseSvg?.spread) || 0);
        sAny.depth = Number.isFinite(depth) ? Math.max(0, depth) : Math.max(0, Number(baseSvg?.depth) || 0);

        const tilt = Number(sAny.tiltDeg);
        sAny.tiltDeg = Number.isFinite(tilt)
          ? clamp(tilt, 0, 80)
          : clamp(Number(baseSvg?.tiltDeg) || 0, 0, 80);

        const rot = Number(sAny.rotateDeg);
        sAny.rotateDeg = Number.isFinite(rot) ? rot : Number(baseSvg?.rotateDeg) || 0;
        const rj = Number(sAny.rotateJitterDeg);
        sAny.rotateJitterDeg = Number.isFinite(rj) ? clamp(rj, 0, 3600) : clamp(Number(baseSvg?.rotateJitterDeg) || 0, 0, 3600);

        const sMin = Number(sAny.sizeMin);
        const sMax = Number(sAny.sizeMax);
        sAny.sizeMin = Number.isFinite(sMin) ? Math.max(0.0001, sMin) : Math.max(0.0001, Number(baseSvg?.sizeMin) || 0.0001);
        sAny.sizeMax = Number.isFinite(sMax) ? Math.max(sAny.sizeMin, sMax) : Math.max(sAny.sizeMin, Number(baseSvg?.sizeMax) || sAny.sizeMin);
        const ed = Number(sAny.extrudeDepth);
        sAny.extrudeDepth = Number.isFinite(ed) ? Math.max(0.000001, ed) : Math.max(0.000001, Number(baseSvg?.extrudeDepth) || 0.000001);

        if (!sAny.stroke || typeof sAny.stroke !== 'object') sAny.stroke = cloneJson(baseSvg?.stroke);
        sAny.stroke.enabled = typeof sAny.stroke.enabled === 'boolean' ? sAny.stroke.enabled : !!sAny.stroke.enabled;
        const sr = Number(sAny.stroke.radius);
        sAny.stroke.radius = Number.isFinite(sr) ? Math.max(0.000001, sr) : Math.max(0.000001, Number(baseSvg?.stroke?.radius) || 0.000001);
        const sseg = Number(sAny.stroke.segments);
        sAny.stroke.segments = Number.isFinite(sseg) ? Math.max(1, Math.min(12, Math.round(sseg))) : Math.max(1, Math.min(12, Math.round(Number(baseSvg?.stroke?.segments) || 6)));
        const sop = Number(sAny.stroke.opacity);
        sAny.stroke.opacity = Number.isFinite(sop) ? clamp(sop, 0, 1) : clamp(Number(baseSvg?.stroke?.opacity) || 1, 0, 1);

        if (!sAny.bevel || typeof sAny.bevel !== 'object') sAny.bevel = cloneJson(baseSvg?.bevel);
        sAny.bevel.enabled = typeof sAny.bevel.enabled === 'boolean' ? sAny.bevel.enabled : !!sAny.bevel.enabled;
        const bs = Number(sAny.bevel.size);
        sAny.bevel.size = Number.isFinite(bs) ? clamp(bs, 0, 0.2) : clamp(Number(baseSvg?.bevel?.size) || 0, 0, 0.2);
        const seg = Number(sAny.bevel.segments);
        sAny.bevel.segments = Number.isFinite(seg) ? Math.max(0, Math.min(8, Math.round(seg))) : Math.max(0, Math.min(8, Math.round(Number(baseSvg?.bevel?.segments) || 0)));
        sAny.paletteMode = sAny.paletteMode === 'cycle' ? 'cycle' : 'weighted';
        if (!Array.isArray(sAny.colorWeights)) sAny.colorWeights = Array.isArray(baseSvg?.colorWeights) ? baseSvg.colorWeights.slice() : [];
        const op = Number(sAny.opacity);
        sAny.opacity = Number.isFinite(op) ? clamp(op, 0, 1) : clamp(Number(baseSvg?.opacity) || 1, 0, 1);
      }
    }
  }

  // Basic bands2d config validation.
  if ((merged as any).type === 'bands2d') {
    const baseBands: any = (base as any).bands;
    const bAny: any = (merged as any).bands;
    if (!bAny || typeof bAny !== 'object') {
      (merged as any).bands = cloneJson(baseBands);
    } else {
      const modeRaw = String(bAny.mode ?? baseBands?.mode ?? 'straight');
      bAny.mode = modeRaw === 'waves' || modeRaw === 'chevron' ? modeRaw : 'straight';
      const so = Number(bAny.seedOffset);
      bAny.seedOffset = Number.isFinite(so) ? Math.round(so) : Math.round(Number(baseBands?.seedOffset) || 0);
      const ang = Number(bAny.angleDeg);
      bAny.angleDeg = Number.isFinite(ang) ? ang : Number(baseBands?.angleDeg) || 0;
      const bw = Number(bAny.bandWidthPx);
      bAny.bandWidthPx = Number.isFinite(bw) ? Math.max(0.1, bw) : Math.max(0.1, Number(baseBands?.bandWidthPx) || 1);
      const gp = Number(bAny.gapPx);
      bAny.gapPx = Number.isFinite(gp) ? Math.max(0, gp) : Math.max(0, Number(baseBands?.gapPx) || 0);
      const off = Number(bAny.offsetPx);
      bAny.offsetPx = Number.isFinite(off) ? off : Number(baseBands?.offsetPx) || 0;
      const jit = Number(bAny.jitterPx);
      bAny.jitterPx = Number.isFinite(jit) ? Math.max(0, jit) : Math.max(0, Number(baseBands?.jitterPx) || 0);

      if (!bAny.panel || typeof bAny.panel !== 'object') bAny.panel = cloneJson(baseBands?.panel);
      bAny.panel.enabled = typeof bAny.panel.enabled === 'boolean' ? bAny.panel.enabled : !!(baseBands?.panel?.enabled);
      if (!bAny.panel.rectFrac || typeof bAny.panel.rectFrac !== 'object') bAny.panel.rectFrac = cloneJson(baseBands?.panel?.rectFrac);
      const pxRaw = Number(bAny.panel.rectFrac?.x);
      const pyRaw = Number(bAny.panel.rectFrac?.y);
      const pwRaw = Number(bAny.panel.rectFrac?.w);
      const phRaw = Number(bAny.panel.rectFrac?.h);
      const pw = Number.isFinite(pwRaw) ? clamp(pwRaw, 0.02, 1) : clamp(Number(baseBands?.panel?.rectFrac?.w) || 0.34, 0.02, 1);
      const ph = Number.isFinite(phRaw) ? clamp(phRaw, 0.02, 1) : clamp(Number(baseBands?.panel?.rectFrac?.h) || 0.34, 0.02, 1);
      const px = Number.isFinite(pxRaw) ? clamp(pxRaw, 0, 1 - pw) : clamp(Number(baseBands?.panel?.rectFrac?.x) || 0.33, 0, 1 - pw);
      const py = Number.isFinite(pyRaw) ? clamp(pyRaw, 0, 1 - ph) : clamp(Number(baseBands?.panel?.rectFrac?.y) || 0.33, 0, 1 - ph);
      bAny.panel.rectFrac = { x: px, y: py, w: pw, h: ph };
      const pr = Number(bAny.panel.radiusPx);
      bAny.panel.radiusPx = Number.isFinite(pr) ? Math.max(0, pr) : Math.max(0, Number(baseBands?.panel?.radiusPx) || 0);
      if (!bAny.panel.fill || typeof bAny.panel.fill !== 'object') bAny.panel.fill = cloneJson(baseBands?.panel?.fill);
      bAny.panel.fill.enabled = typeof bAny.panel.fill.enabled === 'boolean' ? bAny.panel.fill.enabled : !!(baseBands?.panel?.fill?.enabled);
      if (typeof bAny.panel.fill.color !== 'string') bAny.panel.fill.color = String(bAny.panel.fill.color ?? baseBands?.panel?.fill?.color ?? '#000000');
      const pfo = Number(bAny.panel.fill.opacity);
      bAny.panel.fill.opacity = Number.isFinite(pfo) ? clamp(pfo, 0, 1) : clamp(Number(baseBands?.panel?.fill?.opacity) || 0, 0, 1);

      if (!bAny.fill || typeof bAny.fill !== 'object') bAny.fill = cloneJson(baseBands?.fill);
      bAny.fill.enabled = typeof bAny.fill.enabled === 'boolean' ? bAny.fill.enabled : !!bAny.fill.enabled;
      const fo = Number(bAny.fill.opacity);
      bAny.fill.opacity = Number.isFinite(fo) ? clamp(fo, 0, 1) : clamp(Number(baseBands?.fill?.opacity) || 0, 0, 1);

      if (!bAny.stroke || typeof bAny.stroke !== 'object') bAny.stroke = cloneJson(baseBands?.stroke);
      bAny.stroke.enabled = typeof bAny.stroke.enabled === 'boolean' ? bAny.stroke.enabled : !!bAny.stroke.enabled;
      const sw = Number(bAny.stroke.widthPx);
      bAny.stroke.widthPx = Number.isFinite(sw) ? Math.max(0, sw) : Math.max(0, Number(baseBands?.stroke?.widthPx) || 0);
      if (typeof bAny.stroke.color !== 'string') bAny.stroke.color = String(bAny.stroke.color ?? baseBands?.stroke?.color ?? '#000000');
      const sop = Number(bAny.stroke.opacity);
      bAny.stroke.opacity = Number.isFinite(sop) ? clamp(sop, 0, 1) : clamp(Number(baseBands?.stroke?.opacity) || 0, 0, 1);

      if (!bAny.waves || typeof bAny.waves !== 'object') bAny.waves = cloneJson(baseBands?.waves);
      const wa = Number(bAny.waves.amplitudePx);
      bAny.waves.amplitudePx = Number.isFinite(wa) ? Math.max(0, wa) : Math.max(0, Number(baseBands?.waves?.amplitudePx) || 0);
      const wl = Number(bAny.waves.wavelengthPx);
      bAny.waves.wavelengthPx = Number.isFinite(wl) ? Math.max(1, wl) : Math.max(1, Number(baseBands?.waves?.wavelengthPx) || 1);
      const na = Number(bAny.waves.noiseAmount);
      bAny.waves.noiseAmount = Number.isFinite(na) ? clamp(na, 0, 1) : clamp(Number(baseBands?.waves?.noiseAmount) || 0, 0, 1);
      const ns = Number(bAny.waves.noiseScale);
      bAny.waves.noiseScale = Number.isFinite(ns) ? Math.max(0.000001, ns) : Math.max(0.000001, Number(baseBands?.waves?.noiseScale) || 1);

      if (!bAny.chevron || typeof bAny.chevron !== 'object') bAny.chevron = cloneJson(baseBands?.chevron);
      const ca = Number(bAny.chevron.amplitudePx);
      bAny.chevron.amplitudePx = Number.isFinite(ca) ? Math.max(0, ca) : Math.max(0, Number(baseBands?.chevron?.amplitudePx) || 0);
      const cl = Number(bAny.chevron.wavelengthPx);
      bAny.chevron.wavelengthPx = Number.isFinite(cl) ? Math.max(1, cl) : Math.max(1, Number(baseBands?.chevron?.wavelengthPx) || 1);
      const cs = Number(bAny.chevron.sharpness);
      bAny.chevron.sharpness = Number.isFinite(cs) ? clamp(cs, 0.1, 8) : clamp(Number(baseBands?.chevron?.sharpness) || 1, 0.1, 8);
      bAny.chevron.sharedPhase = typeof bAny.chevron.sharedPhase === 'boolean' ? bAny.chevron.sharedPhase : !!(baseBands?.chevron?.sharedPhase);

      bAny.paletteMode = bAny.paletteMode === 'cycle' ? 'cycle' : 'weighted';
      if (!Array.isArray(bAny.colorWeights)) bAny.colorWeights = Array.isArray(baseBands?.colorWeights) ? baseBands.colorWeights.slice() : [];
    }
  }

  // Basic flowlines2d config validation.
  if ((merged as any).type === 'flowlines2d') {
    const baseFlow: any = (base as any).flowlines;
    const fAny: any = (merged as any).flowlines;
    if (!fAny || typeof fAny !== 'object') {
      (merged as any).flowlines = cloneJson(baseFlow);
    } else {
      const so = Number(fAny.seedOffset);
      fAny.seedOffset = Number.isFinite(so) ? Math.round(so) : Math.round(Number(baseFlow?.seedOffset) || 0);
      const fr = Number(fAny.frequency);
      fAny.frequency = Number.isFinite(fr) ? Math.max(0.000001, fr) : Math.max(0.000001, Number(baseFlow?.frequency) || 1);
      const oc = Number(fAny.octaves);
      fAny.octaves = Number.isFinite(oc) ? Math.max(1, Math.min(16, Math.round(oc))) : Math.max(1, Math.min(16, Math.round(Number(baseFlow?.octaves) || 1)));
      const wa = Number(fAny.warpAmount);
      fAny.warpAmount = Number.isFinite(wa) ? Math.max(0, wa) : Math.max(0, Number(baseFlow?.warpAmount) || 0);
      const wf = Number(fAny.warpFrequency);
      fAny.warpFrequency = Number.isFinite(wf) ? Math.max(0.000001, wf) : Math.max(0.000001, Number(baseFlow?.warpFrequency) || 1);
      const st = Number(fAny.strength);
      fAny.strength = Number.isFinite(st) ? Math.max(0, st) : Math.max(0, Number(baseFlow?.strength) || 0);
      const eps = Number(fAny.epsilonPx);
      fAny.epsilonPx = Number.isFinite(eps) ? Math.max(0.1, eps) : Math.max(0.1, Number(baseFlow?.epsilonPx) || 1);
      fAny.spawn = fAny.spawn === 'random' ? 'random' : 'grid';
      const den = Number(fAny.density);
      fAny.density = Number.isFinite(den) ? clamp(den, 0, 1) : clamp(Number(baseFlow?.density) || 0, 0, 1);
      const sp = Number(fAny.spacingPx);
      fAny.spacingPx = Number.isFinite(sp) ? Math.max(2, sp) : Math.max(2, Number(baseFlow?.spacingPx) || 2);
      const mar = Number(fAny.marginPx);
      fAny.marginPx = Number.isFinite(mar) ? Math.max(0, mar) : Math.max(0, Number(baseFlow?.marginPx) || 0);
      const step = Number(fAny.stepPx);
      fAny.stepPx = Number.isFinite(step) ? Math.max(0.05, step) : Math.max(0.05, Number(baseFlow?.stepPx) || 0.05);
      const ms = Number(fAny.maxSteps);
      fAny.maxSteps = Number.isFinite(ms) ? Math.max(1, Math.round(ms)) : Math.max(1, Math.round(Number(baseFlow?.maxSteps) || 1));
      const ml = Number(fAny.maxLines);
      fAny.maxLines = Number.isFinite(ml) ? Math.max(0, Math.round(ml)) : Math.max(0, Math.round(Number(baseFlow?.maxLines) || 0));
      const minL = Number(fAny.minLengthPx);
      fAny.minLengthPx = Number.isFinite(minL) ? Math.max(0, minL) : Math.max(0, Number(baseFlow?.minLengthPx) || 0);
      const jit = Number(fAny.jitter);
      fAny.jitter = Number.isFinite(jit) ? clamp(jit, 0, 1) : clamp(Number(baseFlow?.jitter) || 0, 0, 1);

      if (!fAny.stroke || typeof fAny.stroke !== 'object') fAny.stroke = cloneJson(baseFlow?.stroke);
      const lw = Number(fAny.stroke.widthPx);
      fAny.stroke.widthPx = Number.isFinite(lw) ? Math.max(0.05, lw) : Math.max(0.05, Number(baseFlow?.stroke?.widthPx) || 0.05);
      const lo = Number(fAny.stroke.opacity);
      fAny.stroke.opacity = Number.isFinite(lo) ? clamp(lo, 0, 1) : clamp(Number(baseFlow?.stroke?.opacity) || 0, 0, 1);
      const tp = Number(fAny.stroke.taper);
      fAny.stroke.taper = Number.isFinite(tp) ? clamp(tp, 0, 1) : clamp(Number(baseFlow?.stroke?.taper) || 0, 0, 1);

      fAny.paletteMode = fAny.paletteMode === 'cycle' ? 'cycle' : 'weighted';
      if (!Array.isArray(fAny.colorWeights)) fAny.colorWeights = Array.isArray(baseFlow?.colorWeights) ? baseFlow.colorWeights.slice() : [];
      const cj = Number(fAny.colorJitter);
      fAny.colorJitter = Number.isFinite(cj) ? clamp(cj, 0, 1) : clamp(Number(baseFlow?.colorJitter) || 0, 0, 1);
    }
  }

  // Basic diamondgrid2d config validation.
  if ((merged as any).type === 'diamondgrid2d') {
    const baseDg: any = (base as any).diamondgrid;
    const dAny: any = (merged as any).diamondgrid;
    if (!dAny || typeof dAny !== 'object') {
      (merged as any).diamondgrid = cloneJson(baseDg);
    } else {
      const tw = Number(dAny.tileWidthPx);
      dAny.tileWidthPx = Number.isFinite(tw) ? Math.max(2, tw) : Math.max(2, Number(baseDg?.tileWidthPx) || 2);
      const th = Number(dAny.tileHeightPx);
      dAny.tileHeightPx = Number.isFinite(th) ? Math.max(2, th) : Math.max(2, Number(baseDg?.tileHeightPx) || 2);
      const m = Number(dAny.marginPx);
      dAny.marginPx = Number.isFinite(m) ? Math.max(0, m) : Math.max(0, Number(baseDg?.marginPx) || 0);
      if (!dAny.originPx || typeof dAny.originPx !== 'object') dAny.originPx = cloneJson(baseDg?.originPx);
      const ox = Number(dAny.originPx.x);
      const oy = Number(dAny.originPx.y);
      dAny.originPx.x = Number.isFinite(ox) ? ox : Number(baseDg?.originPx?.x) || 0;
      dAny.originPx.y = Number.isFinite(oy) ? oy : Number(baseDg?.originPx?.y) || 0;
      const os = Number(dAny.overscanPx);
      dAny.overscanPx = Number.isFinite(os) ? Math.max(0, os) : Math.max(0, Number(baseDg?.overscanPx) || 0);
      const fo = Number(dAny.fillOpacity);
      dAny.fillOpacity = Number.isFinite(fo) ? clamp(fo, 0, 1) : clamp(Number(baseDg?.fillOpacity) || 0, 0, 1);

      if (!dAny.stroke || typeof dAny.stroke !== 'object') dAny.stroke = cloneJson(baseDg?.stroke);
      dAny.stroke.enabled = typeof dAny.stroke.enabled === 'boolean' ? dAny.stroke.enabled : !!dAny.stroke.enabled;
      const sw = Number(dAny.stroke.widthPx);
      dAny.stroke.widthPx = Number.isFinite(sw) ? Math.max(0, sw) : Math.max(0, Number(baseDg?.stroke?.widthPx) || 0);
      if (typeof dAny.stroke.color !== 'string') dAny.stroke.color = String(dAny.stroke.color ?? baseDg?.stroke?.color ?? '#000000');
      const so = Number(dAny.stroke.opacity);
      dAny.stroke.opacity = Number.isFinite(so) ? clamp(so, 0, 1) : clamp(Number(baseDg?.stroke?.opacity) || 0, 0, 1);
      dAny.stroke.join = dAny.stroke.join === 'miter' ? 'miter' : dAny.stroke.join === 'bevel' ? 'bevel' : 'round';

      if (!dAny.coloring || typeof dAny.coloring !== 'object') dAny.coloring = cloneJson(baseDg?.coloring);
      dAny.coloring.paletteMode = dAny.coloring.paletteMode === 'cycle' ? 'cycle' : 'weighted';
      if (!Array.isArray(dAny.coloring.colorWeights)) dAny.coloring.colorWeights = Array.isArray(baseDg?.coloring?.colorWeights) ? baseDg.coloring.colorWeights.slice() : [];

      if (!dAny.bevel || typeof dAny.bevel !== 'object') dAny.bevel = cloneJson(baseDg?.bevel);
      dAny.bevel.enabled = typeof dAny.bevel.enabled === 'boolean' ? dAny.bevel.enabled : !!dAny.bevel.enabled;
      const ba = Number(dAny.bevel.amount);
      dAny.bevel.amount = Number.isFinite(ba) ? clamp(ba, 0, 1) : clamp(Number(baseDg?.bevel?.amount) || 0, 0, 1);
      const ld = Number(dAny.bevel.lightDeg);
      dAny.bevel.lightDeg = Number.isFinite(ld) ? ld : Number(baseDg?.bevel?.lightDeg) || 0;
      const bv = Number(dAny.bevel.variation);
      dAny.bevel.variation = Number.isFinite(bv) ? clamp(bv, 0, 1) : clamp(Number(baseDg?.bevel?.variation) || 0, 0, 1);

      if (!dAny.sparkles || typeof dAny.sparkles !== 'object') dAny.sparkles = cloneJson(baseDg?.sparkles);
      dAny.sparkles.enabled = typeof dAny.sparkles.enabled === 'boolean' ? dAny.sparkles.enabled : !!dAny.sparkles.enabled;
      const sd = Number(dAny.sparkles.density);
      dAny.sparkles.density = Number.isFinite(sd) ? clamp(sd, 0, 1) : clamp(Number(baseDg?.sparkles?.density) || 0, 0, 1);
      const cm1 = Number(dAny.sparkles.countMax);
      dAny.sparkles.countMax = Number.isFinite(cm1) ? Math.max(1, Math.min(32, Math.round(cm1))) : Math.max(1, Math.min(32, Math.round(Number(baseDg?.sparkles?.countMax) || 1)));
      const smin = Number(dAny.sparkles.sizeMinPx);
      const smax = Number(dAny.sparkles.sizeMaxPx);
      dAny.sparkles.sizeMinPx = Number.isFinite(smin) ? Math.max(0.1, smin) : Math.max(0.1, Number(baseDg?.sparkles?.sizeMinPx) || 0.1);
      dAny.sparkles.sizeMaxPx = Number.isFinite(smax) ? Math.max(dAny.sparkles.sizeMinPx, smax) : Math.max(dAny.sparkles.sizeMinPx, Number(baseDg?.sparkles?.sizeMaxPx) || dAny.sparkles.sizeMinPx);
      const sop = Number(dAny.sparkles.opacity);
      dAny.sparkles.opacity = Number.isFinite(sop) ? clamp(sop, 0, 1) : clamp(Number(baseDg?.sparkles?.opacity) || 0, 0, 1);
      if (typeof dAny.sparkles.color !== 'string') dAny.sparkles.color = String(dAny.sparkles.color ?? baseDg?.sparkles?.color ?? '#ffffff');
    }
  }

  return merged as WallpaperConfig;
}
