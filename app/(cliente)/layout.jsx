import { CarritoProvider } from '../../contexts/CarritoContext';

export const metadata = {
  title: "Don Adriano's — Pizzería",
  description: 'Pedí tu pizza favorita directo por WhatsApp.',
};

export default function ClienteLayout({ children }) {
  return (
    <CarritoProvider>
      {children}
    </CarritoProvider>
  );
}