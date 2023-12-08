import { supabaseCreateClient } from "../lib/supabase.js";

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
async function baseRoutes(fastify, options) {
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof fastify.errorCodes.FST_ERR_BAD_STATUS_CODE) {
      reply.code(500).send({ message: "Internal Server Error" });
    } else {
      reply.send(error);
    }
  });

  fastify.get("/", async (request, reply) => {
    return { message: "Bem vindo a api da pgcustomstore" };
  });

  fastify.get("/health", async (request, reply) => {
    return { status: "ok" };
  });

  fastify.register(import("./auth.js"), {
    prefix: "/auth",
  });

  fastify.register(import("./carrinho.js"), {
    prefix: "/carrinho",
  });
}

export default baseRoutes;
