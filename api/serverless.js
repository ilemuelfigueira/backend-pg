"use strict";

import * as dotenv from "dotenv";
dotenv.config();

import fastify from "fastify";

const app = fastify({
  logger: true,
});

app.register(import("../app/server.js"));

export default async (req, res) => {
  await app.ready();
  app.server.emit("request", req, res);
};
