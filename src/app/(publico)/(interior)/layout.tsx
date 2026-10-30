// Páginas interiores del sitio (catálogo, ficha, formularios y textos): van sobre un velo en blanco cálido
// que deja entrever la sala del fondo. La portada queda afuera de este grupo y maneja sus capas.
export default function LayoutInterior({ children }: LayoutProps<"/">) {
  return <div className="flex-1 bg-papel/[0.93] pb-24 md:pb-32">{children}</div>;
}
