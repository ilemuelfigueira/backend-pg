import client from "../lib/prisma.js";
import knexClient from "../lib/knex.js";
import { buscarCarrinhoQuery } from "../queries/buscarCarrinho.query.js";

import * as yup from "yup";
import { validateSchema } from "../lib/util.js";

const pacoteSchema = yup.object().shape({
  cdusuario: yup.string().required(),
  nmpacote: yup.string().required(),
  nmpathname: yup.string().required(),
  avatar: yup.string().nullable(),
});

const pacoteItemSchema = yup.array().of(
  yup.object().shape({
    cdproduto: yup.string().uuid().required(),
    cdsubproduto: yup.string().uuid().required(),
    avatar: yup.string().required(),
    nmtipo: yup.string().required(),
  })
);

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

      const result = await client.carrinho.findFirst({
        include: {
          carrinho_situacao: true,
        },
        where: {
          cdusuario: user.id,
          sgcarrinhosituacao: "PEN",
        },
      });

      if (!result)
        return reply
          .status(404)
          .send({ message: "Nenhum carrinho encontrado " });

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

  fastify.post(
    "/cadastrar",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const bodyMap = new Map(Object.entries(request.body));
      const { session } = request.headers;

      if (!session) return reply.status(401).send({ message: "Unauthorized" });
      if (!bodyMap.has("cdproduto"))
        return reply.status(400).send({ message: "Bad Request" });

      try {
        const cdproduto = bodyMap.get("cdproduto");

        const validatePacote = await validateSchema(
          pacoteSchema,
          bodyMap.get("pacote")
        );
        const validatePacoteItem = await validateSchema(
          pacoteItemSchema,
          bodyMap.get("items")
        );

        if (!validatePacote.valid)
          return reply.status(400).send({ message: validatePacote.errors });
        if (!validatePacoteItem.valid)
          return reply.status(400).send({ message: validatePacoteItem.errors });

        const pacote = pacoteSchema.cast(bodyMap.get("pacote"));
        const items = pacoteItemSchema.cast(bodyMap.get("items"));

        console.debug({pacote})
        console.debug({items})

        await knexClient.transaction(async (trx) => {
          const _pacote = await trx
            .raw(
              `
            insert into public.pacote (
              cdusuario, nmpacote, nmpathname, avatar
            )
            select 
              '${pacote.cdusuario}'::uuid,
              '${pacote.nmpacote}',
              '${pacote.nmpathname}',
              '${pacote.avatar}'
            returning cdpacote;
          `
            )
            .then((res) => res.rows[0]);

          console.debug({ _pacote });

          if (items.length > 0)
            for await (const pacote_item of items) {
              await trx.raw(`
                insert into public.pacote_item (
                  cdpacote, cdproduto, cdsubproduto, avatar, nmtipo
                )
                select
                  '${_pacote.cdpacote}'::uuid,
                  '${cdproduto}'::uuid,
                  '${pacote_item.cdsubproduto}'::uuid,
                  '${pacote_item.avatar}',
                  '${pacote_item.nmtipo}'
              `);
            }
          else
            await trx.raw(`
              insert into public.pacote_item (
                cdpacote, cdproduto, cdsubproduto, avatar, nmtipo
              )
              select 
                '${_pacote.cdpacote}'::uuid,
                '${cdproduto}'::uuid,
                null,
                ${pacote.avatar},
                null
            `);

          let carrinho = await trx
            .raw(
              `
                select c.* from public.carrinho c
                where 1=1
                  and c.cdusuario = '${session.user.id}'::uuid
                  and c.sgcarrinhosituacao = 'PEN'
            `
            )
            .then((res) => res["rows"][0]);

          if (!carrinho)
            carrinho = await trx
              .raw(
                `
                insert into public.carrinho (cdusuario)
                select '${session.user.id}'::uuid
                returning cdcarrinho
          `
              )
              .then((res) => res["rows"][0]);

          await trx.raw(`
                insert into public.carrinho_pacote (cdcarrinho, cdpacote, nuqtdpacote)
                select 
                  '${carrinho.cdcarrinho}'::uuid,
                  '${_pacote.cdpacote}'::uuid,
                  1
          `);
        });
      } catch (error) {
        console.error(
          `Erro cadastrando produto no carrinho com o id ${bodyMap.has(
            "cdproduto"
          )} \n${error.message}`
        );
        return reply.status(500).send({
          message: error.message,
        });
      }
    }
  );
}

export async function buscarPacotesCarrinhoByCdCarrinho(cdcarrinho) {
  const query = buscarCarrinhoQuery({ cdcarrinho });

  return await knexClient.raw(query).then((res) => res.rows);
}
