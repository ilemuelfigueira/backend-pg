"use strict";

// Read the .env file.
import dotenv from "dotenv";
dotenv.config();

// Require the framework
import Fastify from "fastify";

// Instantiate Fastify with some config
const app = Fastify({
  logger: true,
});

// Register your application as a normal plugin.
app.register(import("../app/routes/base.js"), {
  prefix: "/api"
});

export default async (req, res) => {
    await app.ready();
    app.server.emit('request', req, res);
}