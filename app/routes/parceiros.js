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

  fastify.get("/:cdparceiro", async (request, reply) => {
    const { cdparceiro } = request.params;

    if (!cdparceiro)
      reply.status(400).send({
        message: "parâmetro :cdparceiro obrigatório!",
      });
    try {
      const parceiro = await knexClient
        .raw(
          `
          select p.* from public.parceiro p
          where 1=1
            and p.cdparceiro = :cdparceiro
        `,
          {
            cdparceiro,
          }
        )
        .then((res) => res.rows[0]);

      if (!parceiro)
        reply.status(404).send({
          message: "Parceiro não encontrado!",
        });

      try {
        const produtos = await knexClient.raw(
          `
              select 
                p.* 
              from public.produto p
              where 1=1
                and p.cdproduto in (${parceiro.lista_produtos?.map(id => `'${id}'::uuid`)?.join(",")})
            `
        ).then(res => res.rows.map(produto => ({
          ...produto,
          banners: produto.banners.map(banner => `${process.env.STORAGE_PUBLIC}${banner}`)
        })))

        parceiro.produtos = produtos
      } catch (error) {
        console.error(error.message);
      }

      reply.send(parceiro);
    } catch (error) {
      reply.status(500).send({
        message: error.message,
      });
    }
  });
}
