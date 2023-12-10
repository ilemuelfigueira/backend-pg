import { supabaseCreateClient } from "../lib/supabase.js";

import _fastify from "fastify";

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
async function baseRoutes(fastify, options) {
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof _fastify.errorCodes.FST_ERR_BAD_STATUS_CODE) {
      reply.code(500).send({ message: "Internal Server Error" });
    } else {
      reply.send(error);
    }
  });

  fastify.decorate(
    "authenticate",
    /**
     * @param {import("fastify").FastifyRequest} request
     * @param {import("fastify").FastifyReply} reply
     */
    async (request, reply) => {
      try {
        const headers = request.headers;

        const access_token = headers.access_token;
        const refresh_token = headers.refresh_token;

        const supabase = await supabaseCreateClient(
          access_token,
          refresh_token,
          (error) => reply.status(401).send({ message: error })
        );

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error || !session) {
          throw new Error("Unauthorized");
        }

        request.headers.session = session;
      } catch (error) {
        reply.status(401).send({ message: error });
      }
    }
  );

  fastify.get("/", async (request, reply) => {
    return { message: "Bem vindo a api da pgcustomstore" };
  });

  fastify.get("/health", async (request, reply) => {
    return { status: "ok" };
  });

  await fastify.register(import("./auth.js"), {
    prefix: "/auth",
  });

  await fastify.register(import("./produtos.js"), {
    prefix: "/produtos",
  });

  await fastify.register(import("./usuarios.js"), {
    prefix: "/usuarios",
  });

  await fastify.register(import("./carrinhos.js"), {
    prefix: "/carrinhos",
  });
}

export default baseRoutes;
