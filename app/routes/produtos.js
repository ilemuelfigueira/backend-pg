import client from "../lib/prisma.js";
import { mapToObject } from "../lib/util.js";

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
async function produtosRoutes(fastify, options) {
  fastify.get("/", async (request, reply) => {
    const query = new Map(Object.entries(request.query));

    const storagePublic = process.env.STORAGE_PUBLIC;
    const take = Number(query.has("size") ? query.get("size") : 10);
    const page = query.has("page") ? Number(query.get("page")) : 1;
    const skip = (page - 1) * take;

    const whereMap = new Map();

    if (query.has("nmproduto")) {
      whereMap.set("nmproduto", {
        contains: query.get("nmproduto"),
        mode: "insensitive",
      });
    }

    if (query.has("nmprodutotipo")) {
      whereMap.set("nmprodutotipo", {
        contains: query.get("nmprodutotipo"),
        mode: "insensitive",
      });
    }

    /**
     * @type {import(".prisma/client").Prisma.produtoFindManyArgs}
     */
    const args = {
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
          include: {
            produto_foto_tipo: true,
          },
        },
        produto_preco: {
          select: {
            cdprodutopreco: true,
            vlproduto: true,
            flativo: true,
          },
        },
        estoque: true,
      },
      skip,
      take,
    };

    if (query.has("orderBy")) {
      const orderBy = query.get("orderBy");

      const orderDirection = query.has("orderDirection")
        ? query.get("orderDirection")
        : "asc";

      args.orderBy = {
        [orderBy]: orderDirection,
      };
    }

    if (!args.orderBy) {
      args.orderBy = [
        {
          nmproduto: "asc",
        },
        { dtcriado: "desc" },
      ];
    }

    if (whereMap.size > 0) {
      args.where = mapToObject(whereMap);
    }

    let produtos = await client.produto.findMany({
      ...args,
    });

    produtos = produtos.map((produto) =>
      Object.assign(produto, {
        produto_foto: produto.produto_foto.map((foto) =>
          Object.assign(foto, {
            nmpath: `${storagePublic}${foto.nmpath}`,
          })
        ),
      })
    );

    const totalPages = Math.ceil(
      (await client.produto.count({ where: args.where })) / take
    );

    const hasNextPage = page < totalPages;
    const hasBeforePage = page > 1;

    let next = hasNextPage ? page + 1 : null;
    let last = hasBeforePage ? page - 1 : null;

    reply.send({
      next,
      last,
      total: totalPages,
      items: produtos,
    });
  });

  fastify.get("/:cdproduto", async (request, reply) => {
    const paramsMap = new Map(Object.entries(request.params));

    if (!paramsMap.has("cdproduto")) {
      reply.status(400).send({ message: "Bad Request" });
    }

    const cdproduto = paramsMap.get("cdproduto");

    const produto = await client.produto.findUnique({
      include: {
        produto_foto: true,
        produto_preco: true,
      },
      where: {
        produto_preco: {
          every: {
            flativo: "S",
          },
        },
        cdproduto: cdproduto,
      },
    });

    reply.send(produto);
  });

  fastify.get("/:cdproduto/fotos", async (request, reply) => {
    const paramsMap = new Map(Object.entries(request.params));

    if (!paramsMap.has("cdproduto")) {
      reply.status(400).send({ message: "Bad Request" });
    }

    const cdproduto = paramsMap.get("cdproduto");

    let produtoFotos = await client.produto_foto.findMany({
      where: {
        cdproduto: cdproduto,
      },
    });

    produtoFotos = produtoFotos.map((produtoFoto) =>
      Object.assign(produtoFoto, {
        nmpath: `${process.env.STORAGE_PUBLIC}${produtoFoto.nmpath}`,
      })
    );

    reply.send(produtoFotos);
  });

  fastify.get("/:cdproduto/precos", async (request, reply) => {
    const paramsMap = new Map(Object.entries(request.params));

    if (!paramsMap.has("cdproduto")) {
      reply.status(400).send({ message: "Bad Request" });
    }

    const cdproduto = paramsMap.get("cdproduto");

    let produtoPreco = await client.produto_preco.findFirst({
      where: {
        cdproduto: cdproduto,
        flativo: "S",
      },
    });

    reply.send(produtoPreco);
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

  fastify.get("/:cdproduto/sub-produtos", async (request, reply) => {
    const paramsMap = new Map(Object.entries(request.params));

    if (!paramsMap.has("cdproduto")) {
      reply.status(400).send({ message: "Bad Request" });
    }

    const cdproduto = paramsMap.get("cdproduto");

    const subProdutos = await client.sub_produto.findMany({
      include: {
        sub_produto_foto: true,
        sub_produto_preco: true,
      },
      where: {
        cdproduto: cdproduto,
        sub_produto_preco: {
          every: {
            flativo: "S",
          },
        },
      },
    });

    reply.send(subProdutos);
  });

  fastify.get("/:cdproduto/sub-produtos/fotos", async (request, reply) => {
    const paramsMap = new Map(Object.entries(request.params));

    if (!paramsMap.has("cdproduto")) {
      reply.status(400).send({ message: "Bad Request" });
    }

    const cdproduto = paramsMap.get("cdproduto");

    let subProdutosFotos = await client.sub_produto_foto.findMany({
      where: {
        sub_produto: {
          cdproduto: cdproduto,
        },
      },
    });

    subProdutosFotos = subProdutosFotos.map((subprodutoFoto) =>
      Object.assign(subprodutoFoto, {
        nmpath: `${process.env.STORAGE_PUBLIC}${subprodutoFoto.nmpath}`,
      })
    );

    reply.send(subProdutosFotos);
  });

  fastify.get("/:cdproduto/sub-produtos/precos", async (request, reply) => {
    const paramsMap = new Map(Object.entries(request.params));

    if (!paramsMap.has("cdproduto")) {
      reply.status(400).send({ message: "Bad Request" });
    }

    const cdproduto = paramsMap.get("cdproduto");

    const subProdutos = await client.sub_produto_preco.findMany({
      where: {
        sub_produto: {
          cdproduto: cdproduto,
        },
        flativo: "S",
      },
    });

    reply.send(subProdutos);
  });
}

export default produtosRoutes;
