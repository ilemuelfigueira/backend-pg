import * as knex from "knex";
import knexClient from "../lib/knex.js";
import { mpgPreference } from "../lib/mercadopago.js";
import { buscarCarrinhoQuery } from "../queries/buscarCarrinho.query.js";
import { buscarUsuarioQuery } from "../queries/buscarUsuario.query.js";
import { buscarPedidoPorCdCarrinhoQuery } from "../queries/buscarPedidoPorCdCarrinho.query.js";
import { inserirPedidoQuery } from "../queries/inserirPedido.query.js";

import * as yup from "yup";
import { buscarPedidoPorPreferenceIdQuery } from "../queries/buscarPedidoPorPreferenceId.query.js";
import { buscarPedidosUsuario } from "../queries/buscarPedido.query.js";
import { UserRolesEnum } from "../enums/users.enum.js";
import {
  ProductionStatusEnum,
  TrackingStatusEnum,
} from "../enums/pedidos.enum.js";

const Knex = knex.Knex;

const BACKEND_URL =
  process.env.BACKEND_URL || "https://dev-api.pgcustomstore.com.br/api";
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://dev.pgcustomstore.com.br";

const trackingSchema = yup.object().shape({
  tracking_status: yup
    .string()
    .oneOf(Object.values(TrackingStatusEnum))
    .required(),
  tracking_code: yup.string().when("tracking_status", {
    is: (value) => value === TrackingStatusEnum.POSTADO,
    then: (schema) => schema.required("Campo tracking_code é obrigatório"),
    otherwise: (schema) => schema.nullable(),
  }),
});

const productionSchema = yup.object().shape({
  production_status: yup
    .string()
    .oneOf(Object.values(ProductionStatusEnum))
    .required(),
});

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

      const result = await knexClient
        .transaction(async (trx) => {
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

          const queryCarrinho = buscarCarrinhoQuery({
            cdcarrinho: body.cdcarrinho,
            ignoreStatusCarrinho: true,
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

          await trx.raw(
            inserirPedidoQuery({
              cdcarrinho: body.cdcarrinho,
              cdendereco: body.cdendereco,
              userId: user.id,
              preferenceId: preference.id,
              value: total_value,
              items: items,
            }),
            {
              payment_url: preference.init_point,
            }
          );

          const pedido = await trx
            .raw(
              buscarPedidoPorCdCarrinhoQuery({ cdcarrinho: body.cdcarrinho })
            )
            .then((res) => res.rows[0]);

          console.debug(`Pedido cadastrado com sucesso ${pedido.cdpedido}`);

          return {
            pedido,
            preference,
          };
        })
        .catch((err) => {
          return reply.status(500).send({
            message: err.message,
          });
        });

      return reply.send(result);
    }
  );

  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { session } = request.headers;
      const {
        order = "asc",
        orderBy = "",
        search = "",
        page = 0,
        limit = 5,
      } = request.query;

      console.debug(JSON.stringify(request.query));

      if (!session) return reply.status(401).send({ message: "Unauthorized" });

      const user = session.user;

      const userRole = user?.user_metadata?.role || "cliente";

      const pedidos = await knexClient.raw(
        buscarPedidosUsuario({
          cdusuario: user.id,
          role: userRole,
          order,
          orderBy,
          search,
          page,
          limit,
        })
      );

      reply.send(pedidos.rows);
    }
  );

  fastify.put(
    "/:cdpedido/tracking-status",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { session } = request.headers;

      const { cdpedido } = request.params;

      const { tracking_status, tracking_code } = request.body;

      // Verifica se o corpo da requisição é válido de acordo com o esquema
      const isValid = await trackingSchema.isValid({
        tracking_status,
        tracking_code,
      });

      if (!isValid) {
        // Valida o corpo da requisição e captura os erros
        const validationError = await trackingSchema
          .validate({ tracking_status, tracking_code })
          .catch((err) => err.errors);

        return reply.status(400).send({ message: validationError.join(", ") });
      }

      if (!session) return reply.status(401).send({ message: "Unauthorized" });

      const user = session.user;

      const userRole = user?.user_metadata?.role
        ? user?.user_metadata?.role
        : "cliente";

      if (![UserRolesEnum.ADMIN].some((role) => userRole === role))
        return reply.status(403).send({
          message: "Forbidden",
        });

      await knexClient.transaction(async (trx) => {
        const _tracking_code =
          tracking_status === TrackingStatusEnum.PENDENTE ? "" : tracking_code;
        await trx.raw(
          `
              update public.pedido set
                tracking_status = '${tracking_status}',
                tracking_code = '${_tracking_code}'
              where 1=1
                and cdpedido = '${cdpedido}'
            `
        );

        if (
          [
            TrackingStatusEnum.ENTREGUE,
            TrackingStatusEnum.POSTADO,
            TrackingStatusEnum["PROBLEMA NA ENTREGA"],
          ].some((status) => status === tracking_status)
        )
          await trx.raw(
            `
              update public.pedido set
                production_status = '${ProductionStatusEnum.FINALIZADO}'
              where 1=1
                and cdpedido = '${cdpedido}'
            `
          );
      });

      const result = await knexClient
        .raw(
          `
          select 
            p.cdpedido,
            p.tracking_status,
            p.tracking_code
          from public.pedido p
          where 1=1
            and p.cdpedido = '${cdpedido}'
        `
        )
        .then((res) => res.rows[0]);

      reply.status(200).send(result);
    }
  );

  fastify.put(
    "/:cdpedido/production-status",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { session } = request.headers;

      const { cdpedido } = request.params;

      const { production_status } = request.body;

      // Verifica se o corpo da requisição é válido de acordo com o esquema
      const isValid = await productionSchema.isValid({
        production_status,
      });

      if (!isValid) {
        // Valida o corpo da requisição e captura os erros
        const validationError = await productionSchema
          .validate({ production_status })
          .catch((err) => err.errors);

        return reply.status(400).send({ message: validationError.join(", ") });
      }

      if (!session) return reply.status(401).send({ message: "Unauthorized" });

      const user = session.user;

      const userRole = user?.user_metadata?.role
        ? user?.user_metadata?.role
        : "cliente";

      if (![UserRolesEnum.ADMIN].some((role) => userRole === role))
        return reply.status(403).send({
          message: "Forbidden",
        });

      await knexClient.transaction(async (trx) => {
        const isPendente = production_status === ProductionStatusEnum.PENDENTE;
        await trx.raw(
          `
              update public.pedido set
                production_status = '${production_status}'
                ${
                  isPendente
                    ? `,tracking_status = '${TrackingStatusEnum.PENDENTE}', tracking_code = ''`
                    : ""
                }
              where 1=1
                and cdpedido = '${cdpedido}'
            `
        );
      });

      const result = await knexClient
        .raw(
          `
          select 
            p.cdpedido,
            p.tracking_status,
            p.tracking_code
          from public.pedido p
          where 1=1
            and p.cdpedido = '${cdpedido}'
        `
        )
        .then((res) => res.rows[0]);

      reply.status(200).send(result);
    }
  );

  fastify.get("/feedback/:status", async (request, reply) => {
    const statusList = ["success", "failure", "pending"];

    const { status } = request.params;

    if (!statusList.some((item) => status == item))
      return reply.status(400).send({ message: "Status inválido" });

    const validateQuery = await feedbackQueryObject.isValid(request.query);

    if (!validateQuery)
      await feedbackQueryObject
        .validate(request.query)
        .catch((err) => err.errors);

    const parsedQuery = feedbackQueryObject.cast(request.query);

    const getStatus = (status) => {
      switch (status) {
        case "success":
          return "PAID";
        case "failed":
          return "PENDING";
        case "pending":
          return "PENDING";
        default:
          return "PENDING";
      }
    };

    const updatePedidoMetaQuery = `
      update public.pedido set
        raw_payment_meta_data = '${JSON.stringify(parsedQuery)}',
        status = '${getStatus(status)}'
      where preference_id = '${parsedQuery.preference_id}';`;

    const result = await knexClient.transaction(async (trx) => {
      await trx.raw(updatePedidoMetaQuery);

      const pedido = await trx
        .raw(
          buscarPedidoPorPreferenceIdQuery({
            preferenceId: parsedQuery.preference_id,
          })
        )
        .then((res) => res.rows[0]);

      return pedido;
    });

    delete result.items;

    result.raw_payment_meta_data = new URLSearchParams(
      result.raw_payment_meta_data
    ).toString();

    const queryStringResponse = new URLSearchParams(result).toString();

    reply.redirect(
      `${FRONTEND_URL}/pedidos/feedback/${status}?${queryStringResponse}`
    );
  });
}

const feedbackQueryObject = yup.object().shape({
  collection_status: yup.string(),
  external_reference: yup.string(),
  merchant_account_id: yup.string(),
  merchant_order_id: yup.string(),
  payment_id: yup.string(),
  payment_type: yup.string(),
  preference_id: yup.string(),
  processing_mode: yup.string(),
  site_id: yup.string(),
  status: yup.string(),
  "success?collection_id": yup.string(),
});

/**
 *
 * @param {Knex.Transaction} trx
 * @returns {Promise<import("mercadopago/dist/clients/preference/commonTypes.js").PreferenceResponse>}
 */
async function createPreference(items, cdcarrinho, payer) {
  const back_urls = {
    success: `${BACKEND_URL}/pedidos/feedback/success`,
    failure: `${BACKEND_URL}/pedidos/feedback/failure`,
    pending: `${BACKEND_URL}/pedidos/feedback/pending`,
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
      external_reference: cdcarrinho,
      items,
      back_urls,
      auto_return: "approved",
    },
  });
}
