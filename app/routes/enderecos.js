import client from "../lib/prisma.js";

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
export default async function (fastify, options) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { session } = request.headers;

      if (!session) return reply.status(401).send({ message: "Unauthorized" });

      const result = await client.endereco.findMany({
        where: {
          cdusuario: session.user.id,
        },
        orderBy: {
          flpadrao: "desc",
        },
      });

      return reply.send(result);
    }
  );
}
