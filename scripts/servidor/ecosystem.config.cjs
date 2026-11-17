// pm2 en el servidor propio. Se copia a /srv/subasta/ecosystem.config.cjs (fuera de las
// versiones). Puerto 3008: el que estaba libre en el servidor (ss -ltnp); si se cambia, también
// PUERTO en compartido/.env (lo usa avisos.sh) y proxy_pass en nginx.
module.exports = {
  apps: [
    {
      name: "subasta",
      cwd: "/srv/subasta/actual",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3008 -H 127.0.0.1",
      // Un solo proceso: las sesiones, el límite de intentos y las ofertas viven en la base,
      // pero un proceso único evita sorpresas con la caché de Next entre procesos.
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production" },
      max_memory_restart: "900M",
      kill_timeout: 10000,
      error_file: "/srv/subasta/registros/error.log",
      out_file: "/srv/subasta/registros/salida.log",
      time: true,
    },
  ],
};
