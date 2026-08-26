import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reporte Territorial - RONAP',
  description: 'Sistema de generación de Fichas de Reporte Territorial para concesiones castañeras',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-ronap-green text-white shadow-lg">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-lg font-bold">
                  R
                </div>
                <div>
                  <h1 className="text-lg font-bold leading-tight">RONAP</h1>
                  <p className="text-xs text-green-200">Reporte Territorial</p>
                </div>
              </div>
              <span className="text-xs text-green-200 hidden sm:block">
                Recolectores Orgánicos de la Nuez Amazónica Peruana
              </span>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="text-center text-xs text-gray-400 py-4">
            © 2026 RONAP - Sistema de Monitoreo Territorial
          </footer>
        </div>
      </body>
    </html>
  );
}
