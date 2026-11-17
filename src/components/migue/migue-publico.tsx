"use client";

import { LARGO_MAXIMO_PUBLICO } from "@/lib/migue/limites";
import { ChatMigue } from "./chat-migue";

/**
 * Migue en el sitio de la Subasta: abierto, sin ingresar. Lo monta el layout de
 * src/app/(publico)/, así acompaña en todas las páginas públicas. Contesta sobre lo que
 * publica el sitio (POST /api/migue) y nunca oferta ni dice quién ofertó.
 */

const SUGERENCIAS = ["¿Cómo participo?", "¿Cuándo cierra la subasta?", "¿Cuánto va la obra 1?"] as const;

export function MiguePublico() {
  return (
    <ChatMigue
      endpoint="/api/migue"
      clavePosicion="subasta-cementerio.migue.posicion"
      subtitulo="Asistente de la Subasta solidaria"
      bienvenida={
        <p>
          ¡Hola! Soy <strong className="font-semibold">Migue</strong>, el asistente de la Dirección de Cementerios. Te cuento cómo participar, cuándo cierra y
          cuánto va cada obra. ¿En qué te ayudo?
        </p>
      }
      sugerencias={SUGERENCIAS}
      maximo={LARGO_MAXIMO_PUBLICO}
    />
  );
}
