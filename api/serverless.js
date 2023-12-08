import fastify from "fastify";

const app = fastify({
  logger: true,
});

app.register(import("../app/app.js"));

export default async (req, res) => {
  await app.ready();
  app.server.emit("request", req, res);
};
