import client from "../lib/prisma.js";

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
export default async function (fastify, options) {
  fastify.get("/existe", async (request, reply) => {
    const { cpf } = request.query;

    try {
      const usuario = await client.users.findFirst({
        where: {
          raw_user_meta_data: {
            path: ["cpf"],
            equals: cpf,
          },
        },
      });

      if (usuario) {
        return reply.status(200).send({ flExiste: "S" });
      }

      return reply.status(200).send({ flExiste: "N" });
    } catch (error) {
      return reply.status(500).send({ message: error.message });
    }
  });

  fastify.get(
    "/carrinhos",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const session = request.headers?.session;

      if (!session) {
        reply.status(401).send({ message: "Unauthorized" });
      }

      const user = session.user;

      const carrinhos = await client.carrinho.findFirstOrThrow({
        include: {
          carrinho_situacao: true,
        },
        where: {
          cdusuario: user.id,
          sgcarrinhosituacao: "PEN",
        },
      });

      reply.send(carrinhos);
    }
  );
}
