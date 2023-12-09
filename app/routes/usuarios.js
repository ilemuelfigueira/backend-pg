import client from "../lib/prisma.js";

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
export default async function (fastify, options) {
  fastify.get("/existe-cpf", async (request, reply) => {
    const { cpf } = request.query;

    const usuario = await client.users.findUnique({
      where: {
        raw_user_meta_data: {
          path: ["cpf"],
          equals: cpf,
        },
      },
    });

    if (usuario) {
      reply.status(500).send({ message: "Usuário já existe" });
    }

    reply.status(200).send({ message: "Usuário não existe" });
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
