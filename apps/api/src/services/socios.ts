import fs from 'fs';
import path from 'path';
import type { Socio } from '@ronap/types';

let cacheSocios: Socio[] | null = null;

// The SOCIOS.xlsx file has inline strings (no sharedStrings.xml),
// so we parse the raw XML from the zip directly.

export async function leerSocios(): Promise<Socio[]> {
  if (cacheSocios) return cacheSocios;

  const filePath = path.join(process.cwd(), 'public', 'socios.xlsx');
  if (!fs.existsSync(filePath)) {
    throw new Error('No se encontró el archivo socios.xlsx en public/');
  }

  const JSZip = (await import('jszip')).default;
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  const sheetXml = await zip.file('xl/worksheets/sheet.xml')?.async('string');
  if (!sheetXml) throw new Error('No se encontró sheet.xml en socios.xlsx');

  const socios: Socio[] = [];

  // Regex to match each row
  const rowRegex = /<x:row r="(\d+)">(.*?)<\/x:row>/gs;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowNum = parseInt(rowMatch[1]);
    if (rowNum === 1) continue; // Skip header

    const rowContent = rowMatch[2];
    const cells = new Map<string, string>();

    // Extract cell values
    const cellRegex = /<x:c r="([A-Z]+)\d+"[^>]*><x:v>([^<]*)<\/x:v><\/x:c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      cells.set(cellMatch[1], cellMatch[2]);
    }

    const nombre = cells.get('D')?.trim();
    if (!nombre) continue;

    socios.push({
      nombre,
      codigoConcesion: cells.get('C') || '',
      contratoTH: cells.get('E') || '',
      sector: cells.get('J') || '',
      provincia: '',  // No hay columna de provincia en el Excel
      departamento: '', // No hay columna de departamento en el Excel
    });
  }

  cacheSocios = socios;
  return socios;
}

export async function leerSocioPorNombre(nombre: string): Promise<Socio | null> {
  const socios = await leerSocios();
  const nombreLower = nombre.toLowerCase().trim();
  return socios.find(s => s.nombre.toLowerCase().trim() === nombreLower) || null;
}
