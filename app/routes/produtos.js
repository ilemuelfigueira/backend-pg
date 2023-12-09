import client from "../lib/prisma.js";

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
async function produtosRoutes(fastify, options) {
  fastify.get("/", async (request, reply) => {
    const query = request.query;

    const page = Number(query.page);
    const take = Number(query.size) || 10;

    const skip = page ? (page - 1) * take : 0;

    const produtos = await client.produto.findMany({
      select: {
        cdproduto: true,
        nmproduto: true,
        deproduto: true,
        produto_tipo: {
          select: {
            cdprodutotipo: true,
            nmprodutotipo: true,
            deprodutotipo: true,
          },
        },
        produto_foto: {
          select: {
            nmaspect: true,
            cdprodutofoto: true,
            nmmimetype: true,
            nmpath: true,
          },
        },
        produto_preco: {
          select: {
            cdprodutopreco: true,
            vlproduto: true,
          },
        },
        estoque: true,
      },
      where: {
        nmproduto: {
          contains: query.nmproduto,
          mode: "insensitive",
        },
        nmprodutotipo: {
          contains: query.nmprodutotipo,
          mode: "insensitive",
        },
        AND: [
          {
            nmprodutotipo: {
              not: {
                contains: "CONTROLE_EXCLUSIVO",
              },
            },
          },
          {
            estoque: {
              every: {
                nuestoque: {
                  gt: 0,
                },
              },
            },
          },
          {
            produto_preco: {
              every: {
                dtinicio: {
                  lt: new Date(),
                },
                dtfim: {
                  gt: new Date(),
                },
              },
            },
          },
        ],
      },
      skip: skip || 0,
      take: take || 10,
    });

    reply.send(produtos);
  });

  fastify.get("/:cdproduto", async (request, reply) => {
    const cdproduto = request.params.cdproduto;

    const produto = await client.produto.findUnique({
      include: {
        produto_foto: true,
        produto_preco: true,
      },
      where: {
        cdproduto: Number(cdproduto),
      },
    });

    reply.send(produto);
  });

  fastify.get("/tipos", async (request, reply) => {
    const tipos = await client.produto_tipo.findMany();

    reply.send(tipos);
  });

  fastify.post("/tipos", async (request, reply) => {
    const body = request.body;

    const tipo = await client.produto_tipo.create({
      data: {
        nmprodutotipo: body.nmprodutotipo,
        deprodutotipo: body.deprodutotipo,
      },
    });

    reply.send(tipo);
  });

  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = request.body;

      const tipo = await client.produto_tipo.findUnique({
        where: {
          cdprodutotipo: body.cdprodutotipo,
        },
      });

      if (tipo.nmprodutotipo === "CONTROLE_EXCLUSIVO") {
        reply.status(401).send({ message: "Unauthorized" });
      }

      const produto = await client.produto.create({
        data: {
          nmproduto: body.nmproduto,
          deproduto: body.deproduto,
          cdprodutotipo: body.cdprodutotipo,
        },
      });

      reply.send(produto);
    }
  );
}

export default produtosRoutes;
