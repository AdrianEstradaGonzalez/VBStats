/**
 * Tests for the Excel export.
 *
 * The point of these is the regression that motivated the rewrite: the service was
 * building a fully styled workbook, but the community `xlsx` build silently drops
 * the `s` (style) property on write, so every export came out as unformatted text.
 * `stylesArePersisted` fails immediately if the dependency is swapped back.
 *
 * They also pin the data enrichment: scoreboard context recorded with each action
 * has to reach the workbook, not be discarded on the way.
 */

import XLSX from 'xlsx-js-style';

// react-native-fs writes to a device path; capture the payload instead.
const writtenFiles: Array<{ path: string; contents: string }> = [];

jest.mock('react-native-fs', () => ({
  DownloadDirectoryPath: '/downloads',
  DocumentDirectoryPath: '/documents',
  writeFile: jest.fn(async (path: string, contents: string) => {
    writtenFiles.push({ path, contents });
  }),
  scanFile: jest.fn(async () => {}),
}));

import { exportMatchToExcel, MatchExportData } from '../../services/excelExportService';

beforeEach(() => {
  writtenFiles.length = 0;
});

const rawStats = [
  {
    set_number: 1, player_id: 1, player_name: 'Ana', player_number: 7,
    player_position: 'Receptor', stat_category: 'Ataque', stat_type: 'Positivo',
    puntos_local: 1, puntos_visitante: 0, sets_local: 0, sets_visitante: 0,
    created_at: '2026-05-01T10:00:00.000Z',
  },
  {
    set_number: 1, player_id: 2, player_name: 'Bea', player_number: 9,
    player_position: 'Central', stat_category: 'Ataque', stat_type: 'Error',
    puntos_local: 1, puntos_visitante: 1, sets_local: 0, sets_visitante: 0,
    created_at: '2026-05-01T10:01:00.000Z',
  },
  {
    set_number: 1, player_id: 1, player_name: 'Ana', player_number: 7,
    player_position: 'Receptor', stat_category: 'Saque', stat_type: 'Punto directo',
    puntos_local: 25, puntos_visitante: 20, sets_local: 1, sets_visitante: 0,
    created_at: '2026-05-01T10:20:00.000Z',
  },
  {
    set_number: 2, player_id: 2, player_name: 'Bea', player_number: 9,
    player_position: 'Central', stat_category: 'Bloqueo', stat_type: 'Positivo',
    puntos_local: 18, puntos_visitante: 25, sets_local: 1, sets_visitante: 1,
    created_at: '2026-05-01T10:45:00.000Z',
  },
];

const DATA: MatchExportData = {
  matchInfo: 'CV Oviedo vs Rivales',
  dateStr: '01/05/2026',
  teamName: 'CV Oviedo',
  opponentName: 'Rivales',
  scoreHome: 1,
  scoreAway: 1,
  location: 'home',
  totalSets: 2,
  totalPerformance: { gp: 2, total: 4, rating: 7 },
  categoryPerformance: {
    Ataque: { gp: 0, total: 2, doblePositivo: 0, positivo: 1, neutro: 0, error: 1, rating: 5 },
    Saque: { gp: 1, total: 1, doblePositivo: 1, positivo: 0, neutro: 0, error: 0, rating: 10 },
    Bloqueo: { gp: 1, total: 1, doblePositivo: 0, positivo: 1, neutro: 0, error: 0, rating: 10 },
  },
  statsByCategory: {},
  orderedCategoryKeys: ['Ataque', 'Saque', 'Bloqueo'],
  playerStats: [
    { id: 1, name: 'Ana', number: 7, total: 2, position: 'Receptor' },
    { id: 2, name: 'Bea', number: 9, total: 2, position: 'Central' },
  ],
  rawStats,
};

/** Parse the workbook the service handed to react-native-fs. */
const readExportedWorkbook = () => {
  expect(writtenFiles).toHaveLength(1);
  return XLSX.read(writtenFiles[0].contents, { type: 'base64', cellStyles: true });
};

describe('exportMatchToExcel', () => {
  test('writes an xlsx file to the downloads directory', async () => {
    const result = await exportMatchToExcel(DATA);
    expect(result.success).toBe(true);
    expect(result.filePath).toContain('.xlsx');
    expect(writtenFiles).toHaveLength(1);
  });

  test('stylesArePersisted: the workbook actually contains formatting', async () => {
    await exportMatchToExcel(DATA);

    // Inspect the raw file rather than the parsed workbook: styles live in
    // xl/styles.xml, and the brand colour only appears there if it was written.
    // (Buffer via globalThis — @types/node isn't in this tsconfig.)
    const NodeBuffer = (globalThis as any).Buffer;
    const binary: string = NodeBuffer.from(writtenFiles[0].contents, 'base64').toString('latin1');
    expect(binary).toContain('styles.xml');
    // C.primary — the header fill used throughout the report.
    expect(binary).toContain('E21D66');
  });

  test('includes every expected sheet', async () => {
    await exportMatchToExcel(DATA);
    const wb = readExportedWorkbook();

    expect(wb.SheetNames).toEqual(
      expect.arrayContaining(['Resumen', 'Marcador', 'Desglose', 'Por Sets', 'Jugadores', 'Detalle']),
    );
  });

  test('reconstructs the per-set score from the action scoreboard', async () => {
    await exportMatchToExcel(DATA);
    const wb = readExportedWorkbook();
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets.Marcador, { header: 1 });

    const set1 = rows.find(r => r[0] === 'Set 1');
    const set2 = rows.find(r => r[0] === 'Set 2');

    // Last action of set 1 was at 25-20, of set 2 at 18-25.
    expect(set1?.[1]).toBe(25);
    expect(set1?.[2]).toBe(20);
    expect(set1?.[4]).toBe('Ganado');

    expect(set2?.[1]).toBe(18);
    expect(set2?.[2]).toBe(25);
    expect(set2?.[4]).toBe('Perdido');
  });

  test('uses the real team names as column headers', async () => {
    await exportMatchToExcel(DATA);
    const wb = readExportedWorkbook();
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets.Marcador, { header: 1 });

    const header = rows.find(r => r[0] === 'Set');
    expect(header?.[1]).toBe('CV Oviedo');
    expect(header?.[2]).toBe('Rivales');
  });

  test('writes counts and percentages as numbers, not text', async () => {
    await exportMatchToExcel(DATA);
    const wb = readExportedWorkbook();
    const sheet = wb.Sheets.Resumen;

    // Find the "Ataque" row in the category table and check its action count cell.
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const ataqueIndex = rows.findIndex(r => r[0] === 'Ataque');
    expect(ataqueIndex).toBeGreaterThan(-1);

    const actionsCell = sheet[XLSX.utils.encode_cell({ r: ataqueIndex, c: 3 })];
    expect(actionsCell.t).toBe('n');
    expect(actionsCell.v).toBe(2);

    // Effectiveness is stored as a real 0-1 percentage with a % format.
    const effCell = sheet[XLSX.utils.encode_cell({ r: ataqueIndex, c: 8 })];
    expect(effCell.t).toBe('n');
    expect(effCell.z).toBe('0%');
    expect(effCell.v).toBeCloseTo(0.5);
  });

  test('detail sheet carries the scoreboard context of each action', async () => {
    await exportMatchToExcel(DATA);
    const wb = readExportedWorkbook();
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets.Detalle, { header: 1 });

    const header = rows.find(r => r[0] === '#');
    expect(header).toEqual(
      expect.arrayContaining(['Set', 'Dorsal', 'Jugador', 'Posición', 'Categoría', 'Tipo', 'Valor', 'Marcador', 'Sets']),
    );

    // One row per recorded action.
    const dataRows = rows.filter(r => typeof r[0] === 'number');
    expect(dataRows).toHaveLength(rawStats.length);

    const first = dataRows[0];
    expect(first).toContain('Ana');
    expect(first).toContain('Receptor');
    expect(first).toContain('1 - 0');
  });

  test('omits the scoreboard sheet when no action carries a score', async () => {
    const noScore: MatchExportData = {
      ...DATA,
      rawStats: rawStats.map(({ puntos_local, puntos_visitante, sets_local, sets_visitante, ...rest }) => rest),
    };

    await exportMatchToExcel(noScore);
    const wb = readExportedWorkbook();

    expect(wb.SheetNames).not.toContain('Marcador');
    expect(wb.SheetNames).toContain('Resumen');
  });
});
