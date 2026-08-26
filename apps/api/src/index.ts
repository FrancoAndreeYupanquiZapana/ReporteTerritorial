import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { sociosRouter } from './routes/socios';
import { generarReporteRouter } from './routes/generarReporte';

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api', sociosRouter);
app.use('/api', generarReporteRouter);

app.listen(PORT, () => {
  console.log(`[API] Servidor corriendo en http://localhost:${PORT}`);
});
