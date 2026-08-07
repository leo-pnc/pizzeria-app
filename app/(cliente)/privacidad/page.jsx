import PaginaLegal from '../../../components/cliente/PaginaLegal';

export const metadata = {
  title: "Política de Privacidad — Don Adriano's",
};

export default function PrivacidadPage() {
  return (
    <PaginaLegal titulo="Política de Privacidad">
      <div className="legal-aviso">
        Este texto es un borrador de referencia y todavía no fue revisado legalmente.
        Reemplazar por el contenido definitivo antes de publicar el sitio.
      </div>

      <p>
        En Don Adriano's respetamos tu privacidad. Esta página explica qué información
        recopilamos cuando hacés un pedido y cómo la usamos.
      </p>

      <h2>Qué información recopilamos</h2>
      <ul>
        <li>Nombre y datos de contacto que nos das al hacer un pedido.</li>
        <li>Dirección de entrega, cuando el pedido es con envío a domicilio.</li>
        <li>Mensajes enviados por WhatsApp para coordinar el pedido.</li>
      </ul>

      <h2>Para qué la usamos</h2>
      <p>
        Usamos esta información únicamente para procesar y entregar tu pedido, y para
        comunicarnos con vos si hace falta confirmar algún detalle. No vendemos ni
        compartimos tus datos con terceros con fines comerciales.
      </p>

      <h2>Contacto</h2>
      <p>
        Si tenés dudas sobre el uso de tus datos, podés escribirnos por WhatsApp desde
        el botón de contacto del sitio.
      </p>
    </PaginaLegal>
  );
}
