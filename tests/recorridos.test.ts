import { describe, expect, it } from "vitest";
import { recorridoPara } from "@/components/admin/recorridos";

describe("recorridos guiados del panel", () => {
  it("cada pantalla encuentra su recorrido", () => {
    const casos: [string, string][] = [
      ["/admin", "general"],
      ["/admin/", "general"],
      ["/admin/obras", "obras"],
      ["/admin/obras/nueva", "obra-nueva"],
      ["/admin/obras/00000000-0000-4000-b000-000000000001", "obra"],
      ["/admin/obras/00000000-0000-4000-b000-000000000001/ofertas", "obra-ofertas"],
      ["/admin/artistas", "artistas"],
      ["/admin/artistas/nuevo", "artista"],
      ["/admin/ofertas", "ofertas"],
      ["/admin/oferentes", "oferentes"],
      ["/admin/oferentes/abc", "oferente"],
      ["/admin/configuracion", "configuracion"],
      ["/admin/textos", "textos"],
      ["/admin/textos/portada", "texto"],
      ["/admin/exportar", "exportar"],
      ["/admin/qr", "qr"],
      ["/admin/auditoria", "auditoria"],
      ["/admin/algo-nuevo/que/no/existe", "general"],
    ];
    for (const [ruta, clave] of casos) expect(recorridoPara(ruta).clave, ruta).toBe(clave);
  });

  it("los pasos tienen título y texto, sin títulos repetidos", () => {
    const rutas = ["/admin", "/admin/obras", "/admin/obras/nueva", "/admin/obras/x", "/admin/configuracion", "/admin/exportar"];
    for (const ruta of rutas) {
      const { pasos } = recorridoPara(ruta);
      expect(pasos.length).toBeGreaterThan(0);
      for (const p of pasos) expect(p.titulo.length * p.texto.length, p.titulo).toBeGreaterThan(0);
      expect(new Set(pasos.map((p) => p.titulo)).size).toBe(pasos.length);
    }
  });
});
