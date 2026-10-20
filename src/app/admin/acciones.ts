"use server";

import { redirect } from "next/navigation";
import { cerrarSesion } from "@/lib/auth";

export async function salirDelPanel() {
  await cerrarSesion();
  redirect("/admin/ingresar");
}
