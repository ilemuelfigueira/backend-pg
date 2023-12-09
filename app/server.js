import fastify from "fastify";

import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3333;

const app = fastify({
  logger: true,
});

app.register(import("./routes/base.js"), {
  prefix: "/api",
});

app
  .listen({
    host: "0.0.0.0",
    port: PORT,
  })
  .then(() => {
    console.info("SERVER RUNNING", PORT);
  });

export default app;
