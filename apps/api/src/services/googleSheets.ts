import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

const HEADERS = [
  'Fecha Generación',
  'Socio',
  'Contrato TH',
  'Código Concesión',
  'Sector',
  'Provincia',
  'Departamento',
  'Fecha Inicio',
  'Fecha Fin',
  'N° Alertas',
  'Detalle Alertas',
  'Coordenadas Recorrido',
];

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

interface GuardarSheetsParams {
  socio: string;
  contratoTH: string;
  codigoConcesion: string;
  sector: string;
  provincia: string;
  departamento: string;
  fechaInicio: string;
  fechaFin: string;
  totalAlertas: number;
  detalleAlertas: string;
  coordenadas: string;
}

export async function guardarEnSheets(datos: GuardarSheetsParams): Promise<string> {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID no está configurado en .env');
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Verificar si la hoja tiene cabeceras
  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Reportes!A1:L1',
    });

    if (!existing.data.values) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Reportes!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS] },
      });
    }
  } catch {
    // Si la hoja no existe, intentar crearla
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'Reportes' } } }],
      },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Reportes!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }

  // Agregar fila con datos
  const now = new Date().toISOString();
  const row = [
    now,
    datos.socio,
    datos.contratoTH,
    datos.codigoConcesion,
    datos.sector,
    datos.provincia,
    datos.departamento,
    datos.fechaInicio,
    datos.fechaFin,
    datos.totalAlertas.toString(),
    datos.detalleAlertas,
    datos.coordenadas,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Reportes!A:L',
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });

  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
}
