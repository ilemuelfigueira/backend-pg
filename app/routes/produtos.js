import { Prisma } from "@prisma/client";
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

    if (query.has("cdproduto")) {
      whereMap.set("cdproduto", {
        equals: query.get("cdproduto"),
      });
    }

    /**
     * @type {import(".prisma/client").Prisma.produtoFindManyArgs}
     */
    const args = {
      skip,
      take,
    };

    if (query.has("orderBy")) {
      const orderBy = `p.${query.get("orderBy") || "nmprodutotipo"}`;

      const orderDirection = `p.${
        query.has("orderDirection") ? query.get("orderDirection") : "asc"
      }`;

      args.orderBy = Prisma.sql`${orderBy}, ${orderDirection}`;
    }

    if (!args.orderBy) {
      args.orderBy = Prisma.sql`p.nmproduto asc, p.dtcriado asc`;
    }

    if (whereMap.size > 0) {
      args.where = mapToObject(whereMap);
    }

    let _produtos = await client.$queryRaw`
      select 
        p.*
      from produto p
      inner join produto_tipo pt 
        on pt.cdprodutotipo = p.cdprodutotipo 
      inner join produto_preco pp 
        on pp.cdproduto = p.cdproduto 
        and pp.flativo = 'S'
      where 1=1
        ${
          query.has("nmproduto")
            ? Prisma.sql`and p.nmproduto ilike ${whereMap.get("nmproduto")}`
            : Prisma.empty
        }
        ${
          query.has("nmprodutotipo")
            ? Prisma.sql`and pt.nmprodutotipo ilike ${whereMap.get(
                "nmprodutotipo"
              )}`
            : Prisma.empty
        }
        ${
          query.has("cdproduto")
            ? Prisma.sql`and p.cdproduto::text = ${whereMap.get("cdproduto")}`
            : Prisma.empty
        }
      order by ${args.orderBy}
      limit ${args.take} 
      offset ${args.skip}
      ;
    `;

    // cast to uuid
    const idsProdutos =
      _produtos.length > 0
        ? Prisma.sql`and p.cdproduto::text in (${Prisma.join(
            _produtos.map((produto) => produto.cdproduto)
          )})`
        : "";

    let produto_foto = await client.$queryRaw`
      select
        pf.*,
        CONCAT(${storagePublic}, pf.nmpath) as nmpath
      from produto_foto pf
      inner join produto p
        on p.cdproduto = pf.cdproduto
      where 1=1
      ${idsProdutos}
      order by pf.nmpath
    `;

    let produto_preco = await client.$queryRaw`
      select
        pp.*
      from produto_preco pp
      inner join produto p
        on p.cdproduto = pp.cdproduto
      where 1=1
      ${idsProdutos}
      and pp.flativo = 'S'
      limit 1
    `;

    _produtos = _produtos.map((produto) => ({
      ...produto,
      produto_foto:
        produto_foto.filter((foto) => foto.cdproduto === produto.cdproduto) ||
        [],
      produto_preco:
        produto_preco.filter(
          (preco) => preco.cdproduto === produto.cdproduto
        ) || [],
    }));

    const totalItems = await client.produto.count({ where: args.where });
    const totalPages = Math.ceil(totalItems / take);

    const hasNextPage = page < totalPages;
    const hasBeforePage = page > 1;

    let next = hasNextPage ? page + 1 : null;
    let last = hasBeforePage ? page - 1 : null;

    reply.send({
      next,
      last,
      totalPages: totalPages,
      totalItems: totalItems,
      items: _produtos,
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
        sub_produto_foto: {
          orderBy: {
            nmpath: "asc",
          },
        },
        sub_produto_preco: {
          orderBy: {
            vlsubproduto: "asc",
          },
        },
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
