import Link from 'next/link';

// ── Layout compartido para páginas legales/institucionales (Privacidad, Términos, etc.) ──
// Misma identidad visual que el resto del sitio, pero con foco en lectura de texto largo.
export default function PaginaLegal({ titulo, actualizado, children }) {
  return (
    <div className="legal-pagina">
      <div className="legal-header">
        <div className="legal-header-inner">
          <Link href="/menu" className="legal-volver">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M15 18l-6-6 6-6"/></svg>
            Volver al menú
          </Link>
        </div>
      </div>

      <main className="legal-main">
        <h1 className="legal-titulo">{titulo}</h1>
        {actualizado && <p className="legal-actualizado">Última actualización: {actualizado}</p>}
        <div className="legal-cuerpo">
          {children}
        </div>
      </main>

      <footer className="legal-footer">
        © {new Date().getFullYear()} Don Adriano's. Todos los derechos reservados.
      </footer>

      <style jsx global>{`
        .legal-pagina {
          min-height: 100vh; display: flex; flex-direction: column;
          background-color: #fffbf5; color: #22201c; font-family: 'Work Sans', system-ui, sans-serif;
        }
        .legal-header { border-bottom: 1px solid #ece6dc; background: rgba(255,251,245,0.96); position: sticky; top: 0; z-index: 5; }
        .legal-header-inner { max-width: 720px; margin: 0 auto; padding: 14px 20px; }
        .legal-volver { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; color: #55504a; text-decoration: none; }
        .legal-volver:hover { color: #F0623E; }
        .legal-main { flex: 1; max-width: 720px; margin: 0 auto; padding: 40px 20px 64px; width: 100%; }
        .legal-titulo { font-family: 'Fraunces', serif; font-size: 28px; font-weight: 700; color: #22201c; margin: 0 0 6px; letter-spacing: -0.01em; }
        .legal-actualizado { font-size: 12.5px; color: #8a8378; margin: 0 0 32px; }
        .legal-cuerpo { font-size: 15px; line-height: 1.7; color: #3a362f; display: flex; flex-direction: column; gap: 18px; }
        .legal-cuerpo h2 { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 700; color: #22201c; margin: 14px 0 -4px; }
        .legal-cuerpo p { margin: 0; }
        .legal-cuerpo ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
        .legal-cuerpo a { color: #F0623E; font-weight: 600; }
        .legal-aviso {
          background: #FDEEE7; border: 1px solid #f6d3c3; border-radius: 12px;
          padding: 14px 16px; font-size: 13.5px; color: #8a4a34; line-height: 1.6;
        }
        .legal-footer { border-top: 1px solid #ece6dc; text-align: center; font-size: 11.5px; color: #8a8378; padding: 18px; }
      `}</style>
    </div>
  );
}
