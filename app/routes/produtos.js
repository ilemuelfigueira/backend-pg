import { Prisma } from "@prisma/client";
import client from "../lib/prisma.js";
import { mapToObject } from "../lib/util.js";
import knexClient from "../lib/knex.js";

const PUBLIC_STORAGE = process.env.STORAGE_PUBLIC;

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
async function produtosRoutes(fastify, options) {
  fastify.get("/", async (request, reply) => {
    const query = new Map(Object.entries(request.query));

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

    args.orderBy = query.has("orderBy")
      ? `order by ${query.get("orderBy")} ${
          query.get("orderDirection") || "asc"
        }`
      : "";

    args.where = `
      ${
        query.has("nmproduto")
          ? `and p.nmproduto ilike '%${query.get("nmproduto")}%'`
          : ""
      }
      ${
        query.has("nmprodutotipo")
          ? `and pt.nmprodutotipo ilike '%${query.get("nmprodutotipo")}%'`
          : ""
      }
      ${
        query.has("cdproduto")
          ? `and p.cdproduto = '${query.get("cdproduto")}'`
          : ""
      }
      ${
        query.has("valorminimo")
          ? `and (coalesce(vmm.soma_min_subproduto, 0) + coalesce(pp.vlproduto, 0)) >= ${query.get(
              "valorminimo"
            )}`
          : ""
      }
      ${
        query.has("valormaximo")
          ? `and (coalesce(vmm.soma_max_subproduto, 0) + coalesce(pp.vlproduto, 0)) <= ${query.get(
              "valormaximo"
            )}`
          : ""
      }
    `;

    let produtos = await knexClient
      .raw(
        `
      select 
        p.*,
        count(*) over() as "totalItems",
        (coalesce(vmm.soma_min_subproduto, 0) + coalesce(pp.vlproduto, 0)) as valorminimo,
        (coalesce(vmm.soma_max_subproduto, 0) + coalesce(pp.vlproduto, 0)) as valormaximo
      from produto p
      inner join produto_tipo pt 
        on pt.cdprodutotipo = p.cdprodutotipo 
      inner join produto_preco pp 
        on pp.cdproduto = p.cdproduto 
        and pp.flativo = 'S'
      left join vw_min_max_subproduto_preco vmm
        on vmm.cdproduto = p.cdproduto
      where 1=1
        ${args.where}
      ${args.orderBy}
      limit ${args.take}
      offset ${args.skip}
      ;
      `
      )
      .then((res) => res.rows);

    let idsProdutos =
      produtos.length > 0
        ? `and p.cdproduto in (${produtos
            .map((produto) => `'${produto.cdproduto}'`)
            .join(", ")})`
        : "";

    let produto_foto = await knexClient
      .raw(
        `
      select
        pf.*,
        CONCAT('${PUBLIC_STORAGE}', pf.nmpath) as nmpath
      from produto_foto pf
      inner join produto p
        on p.cdproduto = pf.cdproduto
      where 1=1
        ${idsProdutos}
      order by pf.nmpath
      ;
    `
      )
      .then((res) => res.rows);

    let produto_preco = await knexClient
      .raw(
        `
      select
        pp.*
      from produto_preco pp
      inner join produto p
        on p.cdproduto = pp.cdproduto
      where 1=1
      ${idsProdutos}
      and pp.flativo = 'S'
    `
      )
      .then((res) => res.rows);

    let produto_tipo = await knexClient
      .raw(
        `
      select distinct
          pt.*
      from produto_tipo pt
      inner join produto p
          on p.cdprodutotipo = pt.cdprodutotipo
      where 1=1
      ${idsProdutos}
    `
      )
      .then((res) => res.rows);

    produtos = produtos.map((produto) => ({
      ...produto,
      produto_foto:
        produto_foto.filter((foto) => foto.cdproduto === produto.cdproduto) ||
        [],
      produto_preco:
        produto_preco.filter(
          (preco) => preco.cdproduto === produto.cdproduto
        ) || [],
      produto_tipo:
        produto_tipo.filter(
          (tipo) => tipo.cdprodutotipo === produto.cdprodutotipo
        ) || [],
    }));

    const totalItems = produtos[0] ? Number(produtos[0].totalItems) : 0;
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
      items: produtos,
    });
  });

  fastify.get("/:cdproduto", async (request, reply) => {
    const paramsMap = new Map(Object.entries(request.params));

    if (!paramsMap.has("cdproduto")) {
      reply.status(400).send({ message: "Bad Request" });
    }

    const cdproduto = paramsMap.get("cdproduto");

    let produto = await knexClient
      .raw(
        `
      select 
        p.*,
        (coalesce(vmm.soma_min_subproduto, 0) + coalesce(pp.vlproduto, 0)) as valorminimo,
        (coalesce(vmm.soma_max_subproduto, 0) + coalesce(pp.vlproduto, 0)) as valormaximo
      from produto p
      inner join produto_preco pp
        on pp.cdproduto = p.cdproduto
        and pp.flativo = 'S'
      left join vw_min_max_subproduto_preco vmm
        on vmm.cdproduto = p.cdproduto
      where 1=1
      and p.cdproduto = '${cdproduto}'
    `
      )
      .then((res) => res.rows[0]);

    const produto_foto = await knexClient
      .raw(
        `
      select
        pf.*,
        CONCAT('${process.env.STORAGE_PUBLIC}', pf.nmpath) as nmpath
      from produto_foto pf
      inner join produto p
        on p.cdproduto = pf.cdproduto
      where 1=1
      and p.cdproduto = '${cdproduto}'
    `
      )
      .then((res) => res.rows);

    const produto_preco = await knexClient
      .raw(
        `
      select
        pp.*
      from produto_preco pp
      inner join produto p
        on p.cdproduto = pp.cdproduto
      where 1=1
      and p.cdproduto = '${cdproduto}'
      and pp.flativo = 'S'
    `
      )
      .then((res) => res.rows);

    produto = Object.assign(produto, {
      produto_foto: produto_foto,
      produto_preco: produto_preco,
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

    let subProdutos = await client.sub_produto.findMany({
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

    subProdutos = await knexClient
      .raw(
        `
      select
        sp.*
      from sub_produto sp
      inner join sub_produto_preco spp
        on spp.cdsubproduto = sp.cdsubproduto
        and spp.flativo = 'S'
      where 1=1
        and sp.cdproduto = '${cdproduto}'
      order by sp.nmsubprodutotipo asc, spp.vlsubproduto asc, sp.nmsubproduto asc
    `
      )
      .then((res) => res.rows);

    const subProdutosFotos = await knexClient
      .raw(
        `
      select
        spf.*,
        CONCAT('${PUBLIC_STORAGE}', spf.nmpath) as nmpath
      from sub_produto_foto spf
      inner join sub_produto sp
        on sp.cdsubproduto = spf.cdsubproduto
      where 1=1
        and sp.cdproduto = '${cdproduto}'
      order by spf.nmpath asc
    `
      )
      .then((res) => res.rows);

    const subProdutosPrecos = await knexClient
      .raw(
        `
      select
        spp.*
      from sub_produto_preco spp
      inner join sub_produto sp
        on sp.cdsubproduto = spp.cdsubproduto
      where 1=1
        and sp.cdproduto = '${cdproduto}'
        and spp.flativo = 'S'
      order by spp.vlsubproduto asc
    `
      )
      .then((res) => res.rows);

    subProdutos = subProdutos.map((subProduto) => ({
      ...subProduto,
      sub_produto_foto:
        subProdutosFotos.filter(
          (foto) => foto.cdsubproduto === subProduto.cdsubproduto
        ) || [],
      sub_produto_preco:
        subProdutosPrecos.filter(
          (preco) => preco.cdsubproduto === subProduto.cdsubproduto
        ) || [],
    }));

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
