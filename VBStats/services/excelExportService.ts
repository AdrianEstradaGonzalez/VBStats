/**
 * Excel Export Service — Genera archivos .xlsx profesionales
 * con múltiples hojas, estilos de la app, tablas y gráficas ASCII
 *
 * Match Export: Resumen, Desglose, Por Sets, Jugadores (cada uno), Detalle
 * Tracking Export: Resumen, Evolución, Categorías, Jugadores
 */

import XLSX from 'xlsx';
import RNFS from 'react-native-fs';
import { Platform, PermissionsAndroid } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────

export interface CategoryPerformance {
  gp: number;
  total: number;
  doblePositivo: number;
  positivo: number;
  neutro: number;
  error: number;
  rating: number;
}

export interface StatItem {
  statType: string;
  count: number;
  color: string;
}

export interface PlayerStat {
  id: number;
  name: string;
  number: number;
  total: number;
  position?: string;
}

export interface RawStat {
  set_number: number;
  player_id: number;
  player_name: string;
  player_number: number;
  stat_category: string;
  stat_type: string;
}

export interface MatchExportData {
  matchInfo: string;
  dateStr: string;
  scoreHome: number | null;
  scoreAway: number | null;
  location: string;
  totalSets: number;
  totalPerformance: { gp: number; total: number; rating: number };
  categoryPerformance: Record<string, CategoryPerformance>;
  statsByCategory: Record<string, StatItem[]>;
  orderedCategoryKeys: string[];
  playerStats: PlayerStat[];
  rawStats: RawStat[];
  selectedSet?: string | number;
  selectedPlayerName?: string;
}

export interface TrackingExportData {
  teamName: string;
  playerName?: string | null;
  matchCount: number;
  wins: number;
  losses: number;
  totalGP: number;
  avgGP: number;
  totalActions: number;
  categoryAverages: Record<string, { avgGP: number; avgPercentage: number }>;
  matchPerformances: {
    date: string;
    opponent: string;
    result: string;
    gp: number;
    totalActions: number;
    scoreHome: number;
    scoreAway: number;
    categories: Record<string, { gp: number; percentage: number; total?: number }>;
  }[];
  statCategories: string[];
  matchRawStats?: {
    matchId: number;
    opponent: string;
    date: string;
    stats: RawStat[];
  }[];
  players?: { id: number; name: string; number: number }[];
}

// ─── Theme Colors ───────────────────────────────────────────────────────

const C = {
  primary:       'E21D66',
  primaryDark:   'B31551',
  primaryLight:  'FF4D8F',
  surface:       '241F2B',
  surfaceLight:  '2F2836',
  accent:        'F59E0B',
  success:       '10B981',
  error:         'EF4444',
  info:          '0EA5E9',
  white:         'FFFFFF',
  black:         '1A1A1A',
  lightBg:       'FFF5F8',
  altRow:        'F9F0F4',
  gray:          '888888',
  lightGray:     'F5F5F5',
  medGray:       'DCDCDC',
  greenPositive: '22C55E',
  yellowNeutral: 'F59E0B',
};

// ─── Helpers ────────────────────────────────────────────────────────────

const sanitize = (v: string) => v.replace(/[^a-zA-Z0-9._-]+/g, '_');

const datestamp = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

const ensurePerm = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 29) return true;
  const r = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: 'Permiso de almacenamiento',
      message: 'Necesitamos permiso para guardar el archivo en Descargas.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Cancelar',
    },
  );
  return r === PermissionsAndroid.RESULTS.GRANTED;
};

/** Score from stat type name */
const scoreOf = (t: string) => {
  const n = t.toLowerCase().trim();
  if (n.includes('doble positiv') || n.includes('punto directo') || n.includes('ace') || n === '++') return 1;
  if (n.includes('positiv') || n === '+') return 1;
  if (n.includes('neutr') || n === '-' || n === '=') return 0;
  if (n.includes('error')) return -1;
  return 0;
};

/** Classify stat type into a bucket */
const bucketOf = (t: string): 'dblPos' | 'pos' | 'neutral' | 'err' => {
  const n = t.toLowerCase().trim();
  if (n.includes('doble positiv') || n.includes('punto directo') || n.includes('ace') || n === '++') return 'dblPos';
  if (n.includes('positiv') || n === '+') return 'pos';
  if (n.includes('neutr') || n === '-' || n === '=') return 'neutral';
  return 'err';
};

/** Hex color for stat type bucket */
const colorOf = (t: string): string => {
  const b = bucketOf(t);
  if (b === 'dblPos') return C.info;
  if (b === 'pos') return C.greenPositive;
  if (b === 'neutral') return C.yellowNeutral;
  return C.error;
};

// Category order for consistent sorting
const CAT_ORDER = ['ataque', 'recepcion', 'saque', 'bloqueo', 'defensa', 'colocacion'];
const sortCats = (cats: string[]) =>
  cats.slice().sort((a, b) => {
    const norm = (x: string) =>
      x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const ai = CAT_ORDER.indexOf(norm(a));
    const bi = CAT_ORDER.indexOf(norm(b));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

// ─── Cell Style Factories ───────────────────────────────────────────────

const sty = {
  title: () => ({
    font: { bold: true, color: { rgb: C.white }, sz: 16, name: 'Calibri' },
    fill: { fgColor: { rgb: C.primary } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  }),
  subtitle: () => ({
    font: { bold: true, color: { rgb: C.white }, sz: 12, name: 'Calibri' },
    fill: { fgColor: { rgb: C.primaryDark } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  }),
  section: (bg = C.surface) => ({
    font: { bold: true, color: { rgb: C.white }, sz: 12, name: 'Calibri' },
    fill: { fgColor: { rgb: bg } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    border: { bottom: { style: 'medium' as const, color: { rgb: C.primary } } },
  }),
  hdr: (bg = C.primary) => ({
    font: { bold: true, color: { rgb: C.white }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: bg } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
    border: {
      top: { style: 'thin' as const, color: { rgb: bg } },
      bottom: { style: 'thin' as const, color: { rgb: bg } },
      left: { style: 'thin' as const, color: { rgb: bg } },
      right: { style: 'thin' as const, color: { rgb: bg } },
    },
  }),
  lbl: () => ({
    font: { color: { rgb: C.gray }, sz: 11, name: 'Calibri' },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
  }),
  val: () => ({
    font: { bold: true, color: { rgb: C.black }, sz: 11, name: 'Calibri' },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
  }),
  cell: (alt = false) => ({
    font: { color: { rgb: C.black }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: alt ? C.altRow : C.white } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    border: { bottom: { style: 'thin' as const, color: { rgb: C.medGray } } },
  }),
  cellL: (alt = false) => ({
    font: { color: { rgb: C.black }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: alt ? C.altRow : C.white } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    border: { bottom: { style: 'thin' as const, color: { rgb: C.medGray } } },
  }),
  num: (alt = false) => ({
    font: { bold: true, color: { rgb: C.black }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: alt ? C.altRow : C.white } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    border: { bottom: { style: 'thin' as const, color: { rgb: C.medGray } } },
  }),
  gp: (v: number, alt = false) => ({
    font: {
      bold: true,
      color: { rgb: v > 0 ? C.success : v < 0 ? C.error : C.gray },
      sz: 11,
      name: 'Calibri',
    },
    fill: { fgColor: { rgb: alt ? C.altRow : C.white } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    border: { bottom: { style: 'thin' as const, color: { rgb: C.medGray } } },
  }),
  pct: (v: number, alt = false) => {
    let clr = C.gray;
    if (v >= 60) clr = C.success;
    else if (v >= 40) clr = C.accent;
    else if (v > 0) clr = C.error;
    return {
      font: { bold: true, color: { rgb: clr }, sz: 11, name: 'Calibri' },
      fill: { fgColor: { rgb: alt ? C.altRow : C.white } },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const },
      border: { bottom: { style: 'thin' as const, color: { rgb: C.medGray } } },
    };
  },
  rating: (r: number) => ({
    font: {
      bold: true,
      color: { rgb: r >= 7 ? C.success : r >= 4 ? C.accent : C.error },
      sz: 13,
      name: 'Calibri',
    },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  }),
  stat: (t: string, alt = false) => ({
    font: { bold: true, color: { rgb: colorOf(t) }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: alt ? C.altRow : C.white } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    border: { bottom: { style: 'thin' as const, color: { rgb: C.medGray } } },
  }),
  totalRow: () => ({
    font: { bold: true, color: { rgb: C.white }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: C.primary } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  }),
  totalRowL: () => ({
    font: { bold: true, color: { rgb: C.white }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: C.primary } },
    alignment: { horizontal: 'right' as const, vertical: 'center' as const },
  }),
  brand: () => ({
    font: { bold: true, color: { rgb: C.primary }, sz: 10, name: 'Calibri', italic: true },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  }),
  result: (r: string, alt = false) => {
    const clr = r === 'Victoria' ? C.success : r === 'Derrota' ? C.error : C.gray;
    return {
      font: { bold: true, color: { rgb: clr }, sz: 11, name: 'Calibri' },
      fill: { fgColor: { rgb: alt ? C.altRow : C.white } },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const },
      border: { bottom: { style: 'thin' as const, color: { rgb: C.medGray } } },
    };
  },
};

/** ASCII bar chart cell:  ████████░░░░ 65% */
const bar = (pct: number, clr: string) => {
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  return {
    v: `${'█'.repeat(filled)}${'░'.repeat(empty)} ${pct}%`,
    s: {
      font: { color: { rgb: clr }, sz: 9, name: 'Courier New' },
      alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    },
  };
};

/** shortcut to create a styled cell */
const c = (v: any, style: any) => ({ v, s: style });

// ─── Shared sheet building blocks ───────────────────────────────────────

function addMergedTitle(rows: any[][], title: string, sub: string, cols: number) {
  rows.push(
    Array.from({ length: cols }, (_, i) =>
      i === 0 ? c(title, sty.title()) : c('', sty.title()),
    ),
  );
  rows.push(
    Array.from({ length: cols }, (_, i) =>
      i === 0 ? c(sub, sty.subtitle()) : c('', sty.subtitle()),
    ),
  );
  rows.push([]);
}

function addBranding(rows: any[][]) {
  rows.push([]);
  rows.push([c('Generado con VBStats Pro — BlueDeBug.com', sty.brand())]);
}

function buildSheet(
  rows: any[][],
  cols: { wch: number }[],
  mergeCols: number,
): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = cols;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: mergeCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: mergeCols - 1 } },
  ];
  ws['!rows'] = [{ hpt: 34 }, { hpt: 26 }];
  return ws;
}

// ─── Per-player / per-set analysis helpers ──────────────────────────────

interface AnalyzedStats {
  categories: string[];
  byCat: Record<string, { types: Record<string, number>; total: number; gp: number }>;
  total: number;
  gp: number;
}

function analyze(stats: RawStat[]): AnalyzedStats {
  const byCat: Record<
    string,
    { types: Record<string, number>; total: number; gp: number }
  > = {};
  let total = 0;
  let gp = 0;
  stats.forEach(st => {
    if (!byCat[st.stat_category])
      byCat[st.stat_category] = { types: {}, total: 0, gp: 0 };
    const cat = byCat[st.stat_category];
    cat.types[st.stat_type] = (cat.types[st.stat_type] || 0) + 1;
    cat.total++;
    cat.gp += scoreOf(st.stat_type);
    total++;
    gp += scoreOf(st.stat_type);
  });
  return { categories: sortCats(Object.keys(byCat)), byCat, total, gp };
}

function calcRating(stats: RawStat[]): number {
  if (stats.length === 0) return 5;
  let w = 0;
  stats.forEach(st => {
    const b = bucketOf(st.stat_type);
    if (b === 'dblPos') w += 4;
    else if (b === 'pos') w += 2;
    else if (b === 'err') w -= 4;
  });
  const maxP = stats.length * 4;
  const minP = stats.length * -4;
  const norm = (w - minP) / (maxP - minP);
  return Math.max(1, Math.min(10, Math.round(norm * 9 + 1)));
}

/** Sort types by bucket: doble+ → pos → neutral → error */
function sortTypes(entries: [string, number][]): [string, number][] {
  return entries.sort(([a], [b]) => {
    const idx = (x: string) => {
      const bu = bucketOf(x);
      return bu === 'dblPos' ? 0 : bu === 'pos' ? 1 : bu === 'neutral' ? 2 : 3;
    };
    return idx(a) - idx(b);
  });
}

/** Write breakdown table for an analyzed entity */
function writeBreakdown(rows: any[][], a: AnalyzedStats, showBar = true) {
  a.categories.forEach(cat => {
    const cd = a.byCat[cat];
    if (!cd || cd.total === 0) return;
    const posCount = Object.entries(cd.types).reduce(
      (sum, [t, cnt]) => sum + (scoreOf(t) > 0 ? cnt : 0),
      0,
    );
    const posPct = Math.round((posCount / cd.total) * 100);

    rows.push([
      c(
        `${cat}  (${cd.total} acc. | G-P: ${cd.gp >= 0 ? '+' : ''}${cd.gp})`,
        sty.section(),
      ),
      c('', sty.section()),
      c('', sty.section()),
      ...(showBar ? [c('', sty.section())] : []),
    ]);
    rows.push([
      c('Tipo', sty.hdr()),
      c('Cantidad', sty.hdr()),
      c('%', sty.hdr()),
      ...(showBar ? [c('Gráfico', sty.hdr())] : []),
    ]);

    sortTypes(Object.entries(cd.types)).forEach(([type, count], i) => {
      const alt = i % 2 === 1;
      const pct = Math.round((count / cd.total) * 100);
      rows.push([
        c(type, sty.stat(type, alt)),
        c(count, sty.num(alt)),
        c(`${pct}%`, sty.pct(pct, alt)),
        ...(showBar ? [bar(pct, colorOf(type))] : []),
      ]);
    });
    rows.push([]);
  });
}

// ========================================================================
// MATCH EXPORT
// ========================================================================

export async function exportMatchToExcel(
  data: MatchExportData,
): Promise<{ success: boolean; filePath: string; error?: string }> {
  try {
    if (!(await ensurePerm()))
      return { success: false, filePath: '', error: 'Permiso de almacenamiento denegado' };

    const wb = XLSX.utils.book_new();
    const raw = data.rawStats;
    const sets = [...new Set(raw.map(r => r.set_number))].sort((a, b) => a - b);

    // ── SHEET 1: RESUMEN ────────────────────────────────────────
    {
      const R: any[][] = [];
      addMergedTitle(R, 'INFORME DE ESTADÍSTICAS', 'VBStats Pro', 9);

      // Match info
      R.push([
        c('INFORMACIÓN DEL PARTIDO', sty.section()),
        ...Array(8).fill(c('', sty.section())),
      ]);
      R.push([
        c('Fecha', sty.lbl()),
        c(data.dateStr, sty.val()),
        c('', {}),
        c('Localización', sty.lbl()),
        c(data.location === 'home' ? 'Local' : 'Visitante', sty.val()),
      ]);
      R.push([
        c('Partido', sty.lbl()),
        c(data.matchInfo, sty.val()),
        c('', {}),
        c('Total Sets', sty.lbl()),
        c(data.totalSets, sty.val()),
      ]);
      if (data.scoreHome !== null && data.scoreAway !== null) {
        R.push([
          c('Resultado', sty.lbl()),
          c(`${data.scoreHome} - ${data.scoreAway}`, {
            ...sty.val(),
            font: { ...sty.val().font, sz: 14 },
          }),
        ]);
      }
      if (data.selectedSet && data.selectedSet !== 'all')
        R.push([c('Filtro Set', sty.lbl()), c(`Set ${data.selectedSet}`, sty.val())]);
      if (data.selectedPlayerName)
        R.push([c('Filtro Jugador', sty.lbl()), c(data.selectedPlayerName, sty.val())]);
      R.push([]);

      // Summary
      R.push([
        c('RESUMEN GENERAL', sty.section()),
        ...Array(8).fill(c('', sty.section())),
      ]);
      const prefix = data.totalPerformance.gp >= 0 ? '+' : '';
      R.push([
        c('G-P Total', sty.lbl()),
        c(`${prefix}${data.totalPerformance.gp}`, sty.gp(data.totalPerformance.gp)),
        c('', {}),
        c('Rating', sty.lbl()),
        c(
          `${data.totalPerformance.rating}/10`,
          sty.rating(data.totalPerformance.rating),
        ),
      ]);
      R.push([
        c('Total Acciones', sty.lbl()),
        c(data.totalPerformance.total, sty.num()),
      ]);
      R.push([]);

      // Category table
      R.push([
        c('RENDIMIENTO POR CATEGORÍA', sty.section()),
        ...Array(8).fill(c('', sty.section())),
      ]);
      R.push([
        c('Categoría', sty.hdr()),
        c('G-P', sty.hdr()),
        c('Rating', sty.hdr()),
        c('Acciones', sty.hdr()),
        c('Doble+', sty.hdr(C.info)),
        c('Positivo', sty.hdr(C.greenPositive)),
        c('Neutro', sty.hdr(C.yellowNeutral)),
        c('Error', sty.hdr(C.error)),
        c('Efectividad', sty.hdr()),
      ]);
      data.orderedCategoryKeys.forEach((cat, i) => {
        const p = data.categoryPerformance[cat];
        if (!p) return;
        const alt = i % 2 === 1;
        const posPct =
          p.total > 0
            ? Math.round(((p.doblePositivo + p.positivo) / p.total) * 100)
            : 0;
        const barClr =
          posPct >= 60 ? C.success : posPct >= 40 ? C.accent : C.error;
        R.push([
          c(cat, {
            ...sty.cellL(alt),
            font: { ...sty.cellL(alt).font, bold: true },
          }),
          c(p.gp, sty.gp(p.gp, alt)),
          c(`${p.rating}/10`, sty.rating(p.rating)),
          c(p.total, sty.num(alt)),
          c(p.doblePositivo, sty.cell(alt)),
          c(p.positivo, sty.cell(alt)),
          c(p.neutro, sty.cell(alt)),
          c(p.error, sty.cell(alt)),
          bar(posPct, barClr),
        ]);
      });

      addBranding(R);

      const ws = buildSheet(
        R,
        [
          { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 11 },
          { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 28 },
        ],
        9,
      );
      XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
    }

    // ── SHEET 2: DESGLOSE POR CATEGORÍA ─────────────────────────
    {
      const R: any[][] = [];
      addMergedTitle(R, 'DESGLOSE POR CATEGORÍA', data.matchInfo, 4);

      const a = analyze(raw);
      writeBreakdown(R, a);
      addBranding(R);

      const ws = buildSheet(
        R,
        [{ wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 28 }],
        4,
      );
      XLSX.utils.book_append_sheet(wb, ws, 'Desglose');
    }

    // ── SHEET 3: ANÁLISIS POR SET ───────────────────────────────
    if (sets.length > 1) {
      const R: any[][] = [];
      addMergedTitle(R, 'ANÁLISIS POR SET', data.matchInfo, 4);

      // Summary table per set
      R.push([
        c('RESUMEN POR SET', sty.section()),
        c('', sty.section()),
        c('', sty.section()),
        c('', sty.section()),
      ]);
      R.push([
        c('Set', sty.hdr()),
        c('Acciones', sty.hdr()),
        c('G-P', sty.hdr()),
        c('Efectividad', sty.hdr()),
      ]);
      sets.forEach((setNum, i) => {
        const ss = raw.filter(r => r.set_number === setNum);
        const gp = ss.reduce((sum, st) => sum + scoreOf(st.stat_type), 0);
        const positives = ss.filter(st => scoreOf(st.stat_type) > 0).length;
        const pct = ss.length > 0 ? Math.round((positives / ss.length) * 100) : 0;
        const alt = i % 2 === 1;
        R.push([
          c(`Set ${setNum}`, {
            ...sty.cell(alt),
            font: { ...sty.cell(alt).font, bold: true },
          }),
          c(ss.length, sty.num(alt)),
          c(gp, sty.gp(gp, alt)),
          bar(pct, pct >= 60 ? C.success : pct >= 40 ? C.accent : C.error),
        ]);
      });
      R.push([]);

      // Detailed breakdown per set
      sets.forEach(setNum => {
        const ss = raw.filter(r => r.set_number === setNum);
        const a = analyze(ss);
        R.push([
          c(`SET ${setNum}`, sty.section(C.primaryDark)),
          c('', sty.section(C.primaryDark)),
          c('', sty.section(C.primaryDark)),
          c('', sty.section(C.primaryDark)),
        ]);
        writeBreakdown(R, a);
      });

      addBranding(R);
      const ws = buildSheet(
        R,
        [{ wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 28 }],
        4,
      );
      XLSX.utils.book_append_sheet(wb, ws, 'Por Sets');
    }

    // ── SHEET 4: JUGADORES — Ranking + Informe individual ───────
    if (data.playerStats.length > 0) {
      const R: any[][] = [];
      addMergedTitle(R, 'ANÁLISIS DE JUGADORES', data.matchInfo, 6);

      // 4A: Ranking table
      R.push([
        c('RANKING DE PARTICIPACIÓN', sty.section()),
        ...Array(5).fill(c('', sty.section())),
      ]);
      R.push([
        c('#', sty.hdr()),
        c('Dorsal', sty.hdr()),
        c('Nombre', sty.hdr()),
        c('Acciones', sty.hdr()),
        c('% Part.', sty.hdr()),
        c('Rendimiento', sty.hdr()),
      ]);

      const totalAcc = data.playerStats.reduce((sum, p) => sum + p.total, 0);
      data.playerStats.forEach((pl, i) => {
        const alt = i % 2 === 1;
        const part =
          totalAcc > 0 ? Math.round((pl.total / totalAcc) * 100) : 0;
        R.push([
          c(i + 1, sty.cell(alt)),
          c(pl.number, {
            ...sty.cell(alt),
            font: { ...sty.cell(alt).font, bold: true, sz: 13 },
          }),
          c(pl.name, sty.cellL(alt)),
          c(pl.total, sty.num(alt)),
          c(`${part}%`, sty.cell(alt)),
          bar(part, C.primary),
        ]);
      });

      // Total row
      R.push([
        c('', sty.totalRow()),
        c('', sty.totalRow()),
        c('TOTAL', sty.totalRowL()),
        c(totalAcc, sty.totalRow()),
        c('100%', sty.totalRow()),
        c('', sty.totalRow()),
      ]);
      R.push([]);

      // 4B: Matrix jugador × categoría
      R.push([
        c('ACCIONES POR JUGADOR Y CATEGORÍA', sty.section()),
        ...Array(data.orderedCategoryKeys.length + 1).fill(
          c('', sty.section()),
        ),
      ]);
      R.push([
        c('Jugador', sty.hdr()),
        ...data.orderedCategoryKeys.map(cat => c(cat, sty.hdr(C.surface))),
        c('Total', sty.hdr()),
      ]);
      data.playerStats.forEach((pl, i) => {
        const alt = i % 2 === 1;
        const playerRaw = raw.filter(r => r.player_id === pl.id);
        const row: any[] = [c(`#${pl.number} ${pl.name}`, sty.cellL(alt))];
        let pt = 0;
        data.orderedCategoryKeys.forEach(cat => {
          const cnt = playerRaw.filter(r => r.stat_category === cat).length;
          pt += cnt;
          row.push(c(cnt || '', cnt > 0 ? sty.num(alt) : sty.cell(alt)));
        });
        row.push(
          c(pt, { ...sty.num(alt), font: { ...sty.num(alt).font, bold: true } }),
        );
        R.push(row);
      });
      R.push([]);

      // 4C: Individual player reports
      R.push([
        c('INFORME INDIVIDUAL POR JUGADOR', sty.section(C.primaryDark)),
        ...Array(Math.max(data.orderedCategoryKeys.length, 3)).fill(
          c('', sty.section(C.primaryDark)),
        ),
      ]);
      R.push([]);

      data.playerStats.forEach(pl => {
        const playerRaw = raw.filter(r => r.player_id === pl.id);
        if (playerRaw.length === 0) return;

        const rating = calcRating(playerRaw);
        const gpPlayer = playerRaw.reduce(
          (sum, st) => sum + scoreOf(st.stat_type),
          0,
        );
        const positives = playerRaw.filter(st => scoreOf(st.stat_type) > 0).length;
        const effectPct = Math.round((positives / playerRaw.length) * 100);

        // Player header row
        R.push([
          c(`#${pl.number} ${pl.name}`, sty.section(C.primary)),
          c(`${playerRaw.length} acciones`, sty.section(C.primary)),
          c(
            `G-P: ${gpPlayer >= 0 ? '+' : ''}${gpPlayer}`,
            sty.section(C.primary),
          ),
          c(`Rating: ${rating}/10`, sty.section(C.primary)),
        ]);

        // Effectiveness bar
        R.push([
          c('Efectividad', sty.lbl()),
          bar(
            effectPct,
            effectPct >= 60 ? C.success : effectPct >= 40 ? C.accent : C.error,
          ),
        ]);
        R.push([]);

        // Category breakdown for this player
        const a = analyze(playerRaw);
        writeBreakdown(R, a, true);
      });

      addBranding(R);

      const colsArr = [
        { wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 28 }, { wch: 12 }, { wch: 12 },
      ];
      data.orderedCategoryKeys.forEach(() => colsArr.push({ wch: 12 }));
      const ws = buildSheet(R, colsArr, 6);
      XLSX.utils.book_append_sheet(wb, ws, 'Jugadores');
    }

    // ── SHEET 5: DETALLE ────────────────────────────────────────
    {
      const R: any[][] = [];
      addMergedTitle(
        R,
        'ESTADÍSTICAS DETALLADAS',
        `${data.matchInfo} — ${data.dateStr}`,
        5,
      );

      R.push([
        c('Set', sty.hdr()),
        c('Jugador', sty.hdr()),
        c('Dorsal', sty.hdr()),
        c('Categoría', sty.hdr()),
        c('Tipo', sty.hdr()),
      ]);
      raw.forEach((st, i) => {
        const alt = i % 2 === 1;
        R.push([
          c(st.set_number, sty.cell(alt)),
          c(st.player_name || '', sty.cellL(alt)),
          c(st.player_number || '', sty.cell(alt)),
          c(st.stat_category, sty.cellL(alt)),
          c(st.stat_type, sty.stat(st.stat_type, alt)),
        ]);
      });
      R.push([]);
      R.push([
        c(`Total: ${raw.length} acciones registradas`, {
          font: { italic: true, color: { rgb: C.gray }, sz: 10, name: 'Calibri' },
        }),
      ]);
      addBranding(R);

      const ws = buildSheet(
        R,
        [{ wch: 8 }, { wch: 22 }, { wch: 10 }, { wch: 16 }, { wch: 20 }],
        5,
      );
      XLSX.utils.book_append_sheet(wb, ws, 'Detalle');
    }

    // ── WRITE ───────────────────────────────────────────────────
    const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const name = `VBStats_${sanitize(data.matchInfo || 'Partido')}_${sanitize(data.dateStr || datestamp())}.xlsx`;
    const dir =
      Platform.OS === 'android'
        ? RNFS.DownloadDirectoryPath
        : RNFS.DocumentDirectoryPath;
    const path = `${dir}/${name}`;
    await RNFS.writeFile(path, b64, 'base64');
    if (Platform.OS === 'android') await RNFS.scanFile(path);
    return { success: true, filePath: path };
  } catch (err: any) {
    console.error('Error exporting match to Excel:', err);
    return { success: false, filePath: '', error: err.message || 'Error desconocido' };
  }
}

// ========================================================================
// TRACKING EXPORT
// ========================================================================

export async function exportTrackingToExcel(
  data: TrackingExportData,
): Promise<{ success: boolean; filePath: string; error?: string }> {
  try {
    if (!(await ensurePerm()))
      return { success: false, filePath: '', error: 'Permiso de almacenamiento denegado' };

    const wb = XLSX.utils.book_new();

    // ── SHEET 1: RESUMEN GENERAL ────────────────────────────────
    {
      const R: any[][] = [];
      addMergedTitle(R, 'INFORME DE SEGUIMIENTO', 'VBStats Pro', 5);

      R.push([
        c('INFORMACIÓN', sty.section()),
        ...Array(4).fill(c('', sty.section())),
      ]);
      R.push([c('Equipo', sty.lbl()), c(data.teamName, sty.val())]);
      if (data.playerName)
        R.push([c('Jugador', sty.lbl()), c(data.playerName, sty.val())]);
      R.push([c('Partidos', sty.lbl()), c(data.matchCount, sty.val())]);
      R.push([]);

      // Stats block
      R.push([
        c('RESUMEN GENERAL', sty.section()),
        ...Array(4).fill(c('', sty.section())),
      ]);
      const winRate =
        data.matchCount > 0
          ? Math.round((data.wins / data.matchCount) * 100)
          : 0;

      R.push([
        c('Victorias', sty.lbl()),
        c(data.wins, {
          ...sty.num(),
          font: { ...sty.num().font, color: { rgb: C.success } },
        }),
        c('', {}),
        c('Win Rate', sty.lbl()),
        c(`${winRate}%`, {
          font: {
            bold: true,
            color: { rgb: winRate >= 50 ? C.success : C.error },
            sz: 14,
            name: 'Calibri',
          },
          alignment: { horizontal: 'center' as const },
        }),
      ]);
      R.push([
        c('Derrotas', sty.lbl()),
        c(data.losses, {
          ...sty.num(),
          font: { ...sty.num().font, color: { rgb: C.error } },
        }),
        c('', {}),
        c('', {}),
        bar(winRate, winRate >= 50 ? C.success : C.error),
      ]);
      R.push([c('G-P Total', sty.lbl()), c(data.totalGP, sty.gp(data.totalGP))]);
      R.push([
        c('G-P Promedio', sty.lbl()),
        c(data.avgGP.toFixed(1), sty.gp(data.avgGP)),
      ]);
      R.push([c('Acciones totales', sty.lbl()), c(data.totalActions, sty.num())]);
      R.push([]);

      // Category averages
      R.push([
        c('RENDIMIENTO POR CATEGORÍA', sty.section()),
        ...Array(4).fill(c('', sty.section())),
      ]);
      R.push([
        c('Categoría', sty.hdr()),
        c('G-P Prom.', sty.hdr()),
        c('Efectividad', sty.hdr()),
        c('Gráfico', sty.hdr()),
      ]);
      const sortedCatKeys = sortCats(Object.keys(data.categoryAverages));
      sortedCatKeys.forEach((cat, i) => {
        const catData = data.categoryAverages[cat];
        if (!catData) return;
        const alt = i % 2 === 1;
        const clr =
          catData.avgPercentage >= 60
            ? C.success
            : catData.avgPercentage >= 40
              ? C.accent
              : C.error;
        R.push([
          c(cat, {
            ...sty.cellL(alt),
            font: { ...sty.cellL(alt).font, bold: true },
          }),
          c(catData.avgGP.toFixed(1), sty.gp(catData.avgGP, alt)),
          c(`${catData.avgPercentage}%`, sty.pct(catData.avgPercentage, alt)),
          bar(catData.avgPercentage, clr),
        ]);
      });

      addBranding(R);
      const ws = buildSheet(
        R,
        [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 28 }],
        5,
      );
      XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
    }

    // ── SHEET 2: EVOLUCIÓN POR PARTIDO ──────────────────────────
    {
      const R: any[][] = [];
      const catCount = data.statCategories.length;
      const totalCols = 6 + catCount * 2;
      addMergedTitle(
        R,
        'EVOLUCIÓN POR PARTIDO',
        data.teamName,
        Math.min(totalCols, 6),
      );

      // Headers
      const hdrs: any[] = [
        c('Fecha', sty.hdr()),
        c('Rival', sty.hdr()),
        c('Resultado', sty.hdr()),
        c('Score', sty.hdr()),
        c('G-P', sty.hdr()),
        c('Acciones', sty.hdr()),
      ];
      data.statCategories.forEach(cat => {
        hdrs.push(c(`${cat} G-P`, sty.hdr(C.surface)));
        hdrs.push(c(`${cat} %`, sty.hdr(C.surface)));
      });
      R.push(hdrs);

      data.matchPerformances.forEach((mp, i) => {
        const alt = i % 2 === 1;
        const row: any[] = [
          c(mp.date, sty.cell(alt)),
          c(mp.opponent, sty.cellL(alt)),
          c(mp.result, sty.result(mp.result, alt)),
          c(`${mp.scoreHome}-${mp.scoreAway}`, sty.cell(alt)),
          c(mp.gp, sty.gp(mp.gp, alt)),
          c(mp.totalActions, sty.num(alt)),
        ];
        data.statCategories.forEach(cat => {
          const cd = mp.categories[cat];
          row.push(c(cd?.gp || 0, sty.gp(cd?.gp || 0, alt)));
          row.push(
            c(`${cd?.percentage || 0}%`, sty.pct(cd?.percentage || 0, alt)),
          );
        });
        R.push(row);
      });

      // Trend
      if (data.matchPerformances.length > 1) {
        R.push([]);
        const first = data.matchPerformances[0];
        const last =
          data.matchPerformances[data.matchPerformances.length - 1];
        const trend = last.gp - first.gp;
        R.push([
          c('Tendencia G-P', sty.section()),
          c(`${trend >= 0 ? '↑ +' : '↓ '}${trend}`, {
            font: {
              bold: true,
              color: { rgb: trend >= 0 ? C.success : C.error },
              sz: 14,
              name: 'Calibri',
            },
            alignment: { horizontal: 'left' as const },
          }),
        ]);
      }

      addBranding(R);
      const cols = [
        { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 11 },
      ];
      data.statCategories.forEach(() => {
        cols.push({ wch: 12 }, { wch: 10 });
      });
      const ws = buildSheet(R, cols, Math.min(totalCols, 6));
      XLSX.utils.book_append_sheet(wb, ws, 'Evolución');
    }

    // ── SHEET 3: DETALLE POR CATEGORÍA ──────────────────────────
    if (data.matchRawStats && data.matchRawStats.length > 0) {
      const R: any[][] = [];
      addMergedTitle(R, 'DETALLE POR CATEGORÍA', data.teamName, 5);

      const catTypeAgg: Record<
        string,
        Record<string, number>
      > = {};
      data.matchRawStats.forEach(m => {
        m.stats.forEach(st => {
          if (!catTypeAgg[st.stat_category]) catTypeAgg[st.stat_category] = {};
          catTypeAgg[st.stat_category][st.stat_type] =
            (catTypeAgg[st.stat_category][st.stat_type] || 0) + 1;
        });
      });

      const sortedCatKeys2 = sortCats(Object.keys(catTypeAgg));
      sortedCatKeys2.forEach(cat => {
        const types = catTypeAgg[cat];
        const catTotal = Object.values(types).reduce((s, v) => s + v, 0);
        if (catTotal === 0) return;

        R.push([
          c(`${cat}  (${catTotal} acciones totales)`, sty.section()),
          ...Array(4).fill(c('', sty.section())),
        ]);
        R.push([
          c('Tipo', sty.hdr()),
          c('Total', sty.hdr()),
          c('% Total', sty.hdr()),
          c('Prom./Partido', sty.hdr()),
          c('Gráfico', sty.hdr()),
        ]);

        sortTypes(Object.entries(types)).forEach(([type, count], i) => {
          const alt = i % 2 === 1;
          const pct = Math.round((count / catTotal) * 100);
          const avg =
            data.matchCount > 0 ? (count / data.matchCount).toFixed(1) : '0';
          R.push([
            c(type, sty.stat(type, alt)),
            c(count, sty.num(alt)),
            c(`${pct}%`, sty.pct(pct, alt)),
            c(avg, sty.cell(alt)),
            bar(pct, colorOf(type)),
          ]);
        });
        R.push([]);
      });

      addBranding(R);
      const ws = buildSheet(
        R,
        [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 28 }],
        5,
      );
      XLSX.utils.book_append_sheet(wb, ws, 'Categorías');
    }

    // ── SHEET 4: JUGADORES ──────────────────────────────────────
    if (
      data.players &&
      data.players.length > 0 &&
      data.matchRawStats &&
      data.matchRawStats.length > 0
    ) {
      const R: any[][] = [];
      addMergedTitle(R, 'ANÁLISIS POR JUGADOR', data.teamName, 6);

      const allStats = data.matchRawStats.flatMap(m => m.stats);

      // Summary table
      R.push([
        c('RESUMEN POR JUGADOR', sty.section()),
        ...Array(5).fill(c('', sty.section())),
      ]);
      R.push([
        c('Dorsal', sty.hdr()),
        c('Nombre', sty.hdr()),
        c('Acciones', sty.hdr()),
        c('G-P', sty.hdr()),
        c('Efectividad', sty.hdr()),
        c('Gráfico', sty.hdr()),
      ]);

      const playerSums = data.players
        .map(pl => {
          const pStats = allStats.filter(st => st.player_id === pl.id);
          const gpVal = pStats.reduce(
            (sum, st) => sum + scoreOf(st.stat_type),
            0,
          );
          const posC = pStats.filter(st => scoreOf(st.stat_type) > 0).length;
          const pctVal =
            pStats.length > 0 ? Math.round((posC / pStats.length) * 100) : 0;
          return { ...pl, total: pStats.length, gp: gpVal, pct: pctVal };
        })
        .sort((a, b) => b.total - a.total);

      const maxAcc = Math.max(...playerSums.map(p => p.total), 1);

      playerSums.forEach((pl, i) => {
        if (pl.total === 0) return;
        const alt = i % 2 === 1;
        R.push([
          c(pl.number, {
            ...sty.cell(alt),
            font: { ...sty.cell(alt).font, bold: true, sz: 13 },
          }),
          c(pl.name, sty.cellL(alt)),
          c(pl.total, sty.num(alt)),
          c(pl.gp, sty.gp(pl.gp, alt)),
          c(`${pl.pct}%`, sty.pct(pl.pct, alt)),
          bar(Math.round((pl.total / maxAcc) * 100), C.primary),
        ]);
      });
      R.push([]);

      // Per-player detail
      R.push([
        c('DETALLE POR JUGADOR', sty.section(C.primaryDark)),
        ...Array(5).fill(c('', sty.section(C.primaryDark))),
      ]);
      R.push([]);

      playerSums.forEach(pl => {
        if (pl.total === 0) return;
        const pStats = allStats.filter(st => st.player_id === pl.id);
        const rating = calcRating(pStats);

        R.push([
          c(`#${pl.number} ${pl.name}`, sty.section(C.primary)),
          c(`${pl.total} acc.`, sty.section(C.primary)),
          c(
            `G-P: ${pl.gp >= 0 ? '+' : ''}${pl.gp}`,
            sty.section(C.primary),
          ),
          c(`Efect: ${pl.pct}%`, sty.section(C.primary)),
          c(`Rating: ${rating}/10`, sty.section(C.primary)),
          c('', sty.section(C.primary)),
        ]);

        const a = analyze(pStats);
        a.categories.forEach(cat => {
          const cd = a.byCat[cat];
          if (!cd || cd.total === 0) return;
          const posPct = Math.round(
            (Object.entries(cd.types).reduce(
              (sum, [t, cnt]) => sum + (scoreOf(t) > 0 ? cnt : 0),
              0,
            ) /
              cd.total) *
              100,
          );

          R.push([
            c(`  ${cat}`, {
              ...sty.cellL(),
              font: { ...sty.cellL().font, bold: true },
            }),
            c(cd.total, sty.num()),
            c(`G-P: ${cd.gp}`, sty.gp(cd.gp)),
            c(`${posPct}%`, sty.pct(posPct)),
            bar(
              posPct,
              posPct >= 60 ? C.success : posPct >= 40 ? C.accent : C.error,
            ),
          ]);

          sortTypes(Object.entries(cd.types)).forEach(([type, cnt]) => {
            const typePct = Math.round((cnt / cd.total) * 100);
            R.push([
              c(`    ${type}`, sty.stat(type)),
              c(cnt, sty.cell()),
              c(`${typePct}%`, sty.pct(typePct)),
            ]);
          });
        });
        R.push([]);
      });

      addBranding(R);
      const ws = buildSheet(
        R,
        [
          { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 12 },
        ],
        6,
      );
      XLSX.utils.book_append_sheet(wb, ws, 'Jugadores');
    }

    // ── WRITE ───────────────────────────────────────────────────
    const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const name = `VBStats_Seguimiento_${sanitize(data.teamName)}_${datestamp()}.xlsx`;
    const dir =
      Platform.OS === 'android'
        ? RNFS.DownloadDirectoryPath
        : RNFS.DocumentDirectoryPath;
    const path = `${dir}/${name}`;
    await RNFS.writeFile(path, b64, 'base64');
    if (Platform.OS === 'android') await RNFS.scanFile(path);
    return { success: true, filePath: path };
  } catch (err: any) {
    console.error('Error exporting tracking to Excel:', err);
    return { success: false, filePath: '', error: err.message || 'Error desconocido' };
  }
}
