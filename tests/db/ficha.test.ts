import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { OBRA, baseDePrueba, como } from "./ayuda";

// 20261023120000_ficha_obra.sql: medidas de la obra e Instagram del artista.

describe("ficha de la obra: medidas e Instagram", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await baseDePrueba();
  });

  it("la vista pública muestra las medidas y el Instagram", async () => {
    await db.query(
      "update public.obras set alto_cm = 80, ancho_cm = 30.5, profundidad_cm = 40, medidas_aproximadas = true where id = $1",
      [OBRA(1)],
    );
    await db.query(
      "update public.artistas set instagram = 'alejandrogomeztolosa' where id = (select artista_id from public.obras where id = $1)",
      [OBRA(1)],
    );
    const { rows } = await como(db, { rol: "anon" }, (tx) =>
      tx.query<{ alto_cm: string; ancho_cm: string; profundidad_cm: string; medidas_aproximadas: boolean; artista_instagram: string }>(
        "select alto_cm, ancho_cm, profundidad_cm, medidas_aproximadas, artista_instagram from public.v_obras_publicas where numero = 1",
      ),
    );
    expect(rows[0]).toMatchObject({ medidas_aproximadas: true, artista_instagram: "alejandrogomeztolosa" });
    expect(Number(rows[0].alto_cm)).toBe(80);
    expect(Number(rows[0].ancho_cm)).toBe(30.5);
    expect(Number(rows[0].profundidad_cm)).toBe(40);
  });

  it("alto y ancho van juntos; la profundidad puede faltar", async () => {
    await db.query("update public.obras set alto_cm = 50, ancho_cm = 40, profundidad_cm = null where id = $1", [OBRA(2)]);
    await expect(
      db.query("update public.obras set alto_cm = 50, ancho_cm = null, profundidad_cm = null where id = $1", [OBRA(2)]),
    ).rejects.toThrow(/obras_medidas_completas/);
    await expect(
      db.query("update public.obras set alto_cm = null, ancho_cm = null, profundidad_cm = 10 where id = $1", [OBRA(2)]),
    ).rejects.toThrow(/obras_medidas_completas/);
    await expect(db.query("update public.obras set alto_cm = 0 where id = $1", [OBRA(2)])).rejects.toThrow(
      /obras_alto_cm_rango/,
    );
  });

  it("el Instagram guarda solo el usuario", async () => {
    for (const malo of ["@usuario", "https://www.instagram.com/usuario", "con espacio"]) {
      await expect(db.query("update public.artistas set instagram = $1 where nombre is not null", [malo])).rejects.toThrow(
        /artistas_instagram_usuario/,
      );
    }
  });
});
