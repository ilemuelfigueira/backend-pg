import client from "../lib/prisma.js";
import { buscarCarrinhoQuery } from "../queries/buscarCarrinho.query.js";

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

      const user = session.user;

      const result = await client.carrinho.findFirstOrThrow({
        include: {
          carrinho_situacao: true,
        },
        where: {
          cdusuario: user.id,
          sgcarrinhosituacao: "PEN",
        },
      });

      return reply.send(result);
    }
  );

  fastify.get(
    "/:cdcarrinho/pacotes",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const paramsMap = new Map(Object.entries(request.params));
      const { session } = request.headers;

      if (!session) return reply.status(401).send({ message: "Unauthorized" });
      if (!paramsMap.has("cdcarrinho"))
        return reply.status(400).send({ message: "Bad Request" });

      const cdcarrinho = paramsMap.get("cdcarrinho");

      const carrinho = await client.carrinho.findFirstOrThrow({
        where: {
          cdcarrinho,
          cdusuario: session.user.id,
        },
      });

      if (!carrinho)
        return NextResponse.json("Carrinho não encontrado", { status: 404 });

      const pacotes = await buscarPacotesCarrinhoByCdCarrinho(cdcarrinho);

      return reply.send(pacotes);
    }
  );
}

export async function buscarPacotesCarrinhoByCdCarrinho(cdcarrinho) {
  const query = buscarCarrinhoQuery({cdcarrinho})

  return await client.$queryRaw`
  ${query}
  ;
`;
}
