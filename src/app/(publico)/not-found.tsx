import { AvisoNoEncontrada } from "@/components/AvisoNoEncontrada";

// notFound() dentro del sitio público (por ejemplo, una obra que no existe): el layout del
// sitio ya pone el encabezado y el pie.
export default function NoEncontradaEnElSitio() {
  return <AvisoNoEncontrada />;
}
