import * as knex from "knex";
import knexClient from "../lib/knex.js";
import { mpgPreference } from "../lib/mercadopago.js";
import { buscarCarrinhoQuery } from "../queries/buscarCarrinho.query.js";
import { buscarUsuarioQuery } from "../queries/buscarUsuario.query.js";
import { buscarPedidoPorCdCarrinhoQuery } from "../queries/buscarPedidoPorCdCarrinho.query.js";
import { inserirPedidoQuery } from "../queries/inserirPedido.query.js";

const Knex = knex.Knex;

const BACKEND_URL =
  process.env.BACKEND_URL || "https://backend-pg-lemuelfigueira.vercel.app/api";

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
export default async function (fastify, options) {
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { session } = request.headers;
      const { body } = request;

      if (!body.cdcarrinho)
        return reply.status(400).send({
          message: "parâmetro cdcarrinho não encontrado",
        });

      if (!body.cdendereco)
        return reply.status(400).send({
          message: "parâmetro cdendereco não encontrado",
        });

      if (!session) return reply.status(401).send({ message: "Unauthorized" });

      const user = session.user;

      const result = await knexClient.transaction(async (trx) => {
        const carrinho = await trx
          .raw(
            `
          select * from public.carrinho
          where 1=1
          and cdcarrinho = '${body.cdcarrinho}'
          and cdusuario = '${user.id}';
        `
          )
          .then((res) => res.rows[0]);

        if (!carrinho)
          throw new Error("carrinho não existe ou não pertence ao usuário ");

        // if (carrinho.sgcarrinhosituacao != "PEN")
        //   throw new Error(
        //     `carrinho não pode ser alterado status -> ${carrinho.sgcarrinhosituacao}`
        //   );

        const queryCarrinho = buscarCarrinhoQuery({
          cdcarrinho: body.cdcarrinho,
        });
        const items_carrinho = await trx
          .raw(`${queryCarrinho}`)
          .then((res) => res.rows);

        await trx.raw(`
        update public.carrinho set
          sgcarrinhosituacao = 'CNC'
        where 1=1
          and cdcarrinho = '${body.cdcarrinho}'::uuid
          and cdusuario = '${user.id}'::uuid;
        `);

        const items = items_carrinho.map((item) => ({
          id: item.cdpacote,
          quantity: Number(item.nuqtdpacote),
          title: item.concat_nmproduto + item.concat_nmsubproduto,
          unit_price: Number(item.vlpacoteunidade),
          picture_url: item.nmpath,
          category_id: item.nmprodutotipo,
          description: item.concat_nmsubproduto,
        }));

        let total_value = 0;
        items.forEach(
          (item) => (total_value += Number(item.quantity * item.unit_price))
        );

        const usuarioForm = await trx
          .raw(buscarUsuarioQuery({ cdusuario: user.id }))
          .then((res) => res.rows[0]);

        // const payer = {
        //   name: usuarioForm.name,
        //   email: usuarioForm.email,
        //   phone: {
        //     area_code: usuarioForm.phone_code,
        //     number: usuarioForm.phone_number,
        //   },
        // };

        console.log(usuarioForm);

        const endereco = await trx.raw(`
          select * from endereco e
          where e.cdusuario = '${user.id}'::uuid
          and e.cdendereco = '${body.cdendereco}'::uuid
        `);

        if (!endereco)
          throw new Error(
            "endereço informado não existe ou não pertence ao usuário informado"
          );

        let preference = await createPreference(items, body.cdcarrinho);

        console.debug(`Pedido não existe, cadastrando informações...`);

        await trx.raw(
          inserirPedidoQuery({
            cdcarrinho: body.cdcarrinho,
            cdendereco: body.cdendereco,
            userId: user.id,
            preferenceId: preference.id,
            value: total_value,
          })
        );

        const pedido = await trx
          .raw(buscarPedidoPorCdCarrinhoQuery({ cdcarrinho: body.cdcarrinho }))
          .then((res) => res.rows[0]);

        console.debug(`Pedido cadastrado com sucesso ${pedido.cdpedido}`);

        return {
          pedido,
          preference,
        };
      });

      return reply.send(result);
    }
  );
}

/**
 *
 * @param {Knex.Transaction} trx
 * @returns {Promise<import("mercadopago/dist/clients/preference/commonTypes.js").PreferenceResponse>}
 */
async function createPreference(items, cdcarrinho, payer) {
  const back_urls = {
    success: `https://pgcustomstore.com.br/pedidos/feedback/success`,
    failure: `https://pgcustomstore.com.br/pedidos/feedback/failure`,
    pending: `https://pgcustomstore.com.br/pedidos/feedback/pending`,
  };

  const before = await mpgPreference
    .search({
      options: {
        external_reference: cdcarrinho,
      },
    })
    .then((res) => res.elements[0]);

  if (before) {
    console.debug(
      `Preferência ${before.id} já existe, atualizando informações e prosseguindo.`
    );
    return await mpgPreference.update({
      id: before.id,
      updatePreferenceRequest: {
        items,
        payer,
        back_urls,
        auto_return: "approved",
      },
    });
  }

  console.debug(`Cadastrando preferência external_reference->${cdcarrinho}`);
  return await mpgPreference.create({
    body: {
      payer: {
        ...payer,
      },
      external_reference: cdcarrinho,
      items,
      back_urls,
      auto_return: "approved",
    },
  });
}
