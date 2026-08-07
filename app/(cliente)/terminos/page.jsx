import PaginaLegal from '../../../components/cliente/PaginaLegal';

export const metadata = {
  title: "Términos y Condiciones — Don Adriano's",
};

export default function TerminosPage() {
  return (
    <PaginaLegal titulo="Términos y Condiciones">
      <div className="legal-aviso">
        Este texto es un borrador de referencia y todavía no fue revisado legalmente.
        Reemplazar por el contenido definitivo antes de publicar el sitio.
      </div>

      <p>
        Al realizar un pedido a través de este sitio, aceptás las condiciones descritas
        a continuación.
      </p>

      <h2>Pedidos</h2>
      <p>
        Los pedidos armados en el menú se confirman finalmente por WhatsApp. Los precios,
        productos y promociones mostrados pueden cambiar sin previo aviso y están sujetos
        a disponibilidad.
      </p>

      <h2>Horarios y disponibilidad</h2>
      <p>
        Solo se procesan pedidos dentro del horario de atención publicado en el sitio.
        Fuera de ese horario, podés armar tu pedido igual y confirmarlo cuando reabramos.
      </p>

      <h2>Medios de pago</h2>
      <p>
        Los medios de pago disponibles se muestran al momento de confirmar el pedido y
        pueden variar según el local.
      </p>

      <h2>Modificaciones</h2>
      <p>
        Estos términos pueden actualizarse en cualquier momento. Te recomendamos
        revisarlos periódicamente.
      </p>
    </PaginaLegal>
  );
}
