import { Router } from 'express';
import { leerSocios } from '../services/socios';

export const sociosRouter = Router();

sociosRouter.get('/socios', async (_req, res) => {
  try {
    const socios = await leerSocios();
    res.json({ socios });
  } catch (error) {
    console.error('[API] Error leyendo socios:', error);
    res.status(500).json({ error: 'Error al leer el padrón de socios' });
  }
});
