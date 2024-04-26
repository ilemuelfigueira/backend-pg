import knexClient from "../lib/knex.js";

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
export default async function (fastify, options) {
  fastify.get("/", async (_, reply) => {
    try {
      const parceiros = await knexClient
        .raw(
          `
          select p.* from public.parceiro p;
        `
        )
        .then((res) => res.rows);

      reply.send(parceiros);
    } catch (error) {
      reply.status(500).send({
        message: error.message,
      });
    }
  });
}
