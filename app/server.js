import fastify from "fastify";

const app = fastify({
  logger: true,
});;

app.register(import("./routes/base.js"), {
  prefix: "/api",
});

app
  .listen({
    host: "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 3333,
  })
  .then(() => {
    console.info("SERVER RUNNING", process.env.PORT);
  });

export default app;
