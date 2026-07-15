'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const sinAcceso    = searchParams.get('error') === 'sin-acceso';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPass, setMostrarPass] = useState(false);
  const [error, setError]       = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (authError) { setError('Usuario o contraseña incorrectos.'); return; }
    router.push('/admin');
  }

  return (
    <div className="pagina">
      <div className="fondo-deco" aria-hidden="true" />

      <form className="tarjeta" onSubmit={handleSubmit}>

        {/* Logo / marca */}
        <div className="marca">
          <div className="marca-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c1320a" strokeWidth="1.6">
              <path d="M3 11l19-9-9 19-2-8-8-2z"/>
            </svg>
          </div>
          <div>
            <h1>Don Adriano's</h1>
            <span className="marca-sub">Panel de administración</span>
          </div>
        </div>

        {sinAcceso && (
          <div className="aviso aviso-error" role="alert">
            Ese usuario no tiene acceso al panel. Consultá con el dueño.
          </div>
        )}

        {error && (
          <div className="aviso aviso-error" role="alert">{error}</div>
        )}

        <label className="campo">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
          />
        </label>

        <label className="campo">
          <span>Contraseña</span>
          <div className="campo-pass">
            <input
              type={mostrarPass ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <button type="button" className="btn-ojo" onClick={() => setMostrarPass(v => !v)} tabIndex={-1}>
              {mostrarPass
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
        </label>

        <button type="submit" className="btn-entrar" disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="nota">La sesión queda guardada en este dispositivo.</p>
      </form>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&display=swap');

        .pagina {
          min-height: 100vh;
          background: #f7f5f2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'Work Sans', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
        }

        .fondo-deco {
          position: absolute;
          top: -40%;
          right: -20%;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(193,50,10,0.06) 0%, transparent 65%);
          pointer-events: none;
        }

        .tarjeta {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 380px;
          background: #fff;
          border: 1px solid #ede8e0;
          border-radius: 20px;
          padding: 36px 32px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
          animation: aparecer 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes aparecer {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .marca {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 4px;
        }

        .marca-logo {
          width: 48px;
          height: 48px;
          background: rgba(193,50,10,0.07);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .marca h1 {
          font-family: 'Fraunces', serif;
          font-size: 18px;
          font-weight: 700;
          color: #1a1510;
          margin: 0 0 2px;
          line-height: 1.1;
        }

        .marca-sub {
          font-size: 12px;
          color: #9a8f82;
        }

        .aviso {
          font-size: 13px;
          padding: 10px 12px;
          border-radius: 10px;
          margin: 0;
        }

        .aviso-error {
          background: rgba(193,50,10,0.06);
          border: 1px solid rgba(193,50,10,0.2);
          color: #c1320a;
        }

        .campo {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          color: #6b6259;
          font-weight: 500;
        }

        .campo input {
          background: #f7f5f2;
          border: 1.5px solid #e4ddd3;
          border-radius: 10px;
          padding: 11px 13px;
          font-size: 15px;
          color: #1a1510;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
          width: 100%;
        }

        .campo input:focus {
          border-color: #c1320a;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(193,50,10,0.08);
        }

        .campo-pass {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .campo-pass input { flex: 1; }

        .btn-ojo {
          background: #f7f5f2;
          border: 1.5px solid #e4ddd3;
          border-radius: 10px;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #9a8f82;
          flex-shrink: 0;
          transition: border-color 0.15s, color 0.15s;
        }

        .btn-ojo:hover {
          border-color: #c1320a;
          color: #c1320a;
        }

        .btn-entrar {
          background: #c1320a;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 13px;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          margin-top: 4px;
          transition: filter 0.15s, transform 0.1s;
        }

        .btn-entrar:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .btn-entrar:active {
          transform: translateY(0);
        }

        .btn-entrar:disabled {
          opacity: 0.6;
          cursor: default;
        }

        .nota {
          text-align: center;
          font-size: 12px;
          color: #b0a898;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#f7f5f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid #e4ddd3', borderTopColor: '#c1320a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}