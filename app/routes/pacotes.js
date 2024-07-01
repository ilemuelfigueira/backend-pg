import client from "../lib/prisma.js";
import * as yup from "yup";

import knexClient from "../lib/knex.js";

const postSchema = yup.object().shape({
  cdusuario: yup.string().uuid().required("campo 'cdusuario' é obrigatório"),
  nmpacote: yup.string().required("campo 'nmpacote' é obrigatório"),
});

const itemsPostSchema = yup.object().shape({
  items: yup.array().of(
    yup.object().shape({
      cdproduto: yup.string().uuid().required(),
      cdsubproduto: yup.string().uuid().nullable(),
    })
  ),
});

const empacotarPostSchema = yup.object().shape({
  cdproduto: yup.string().uuid().required(),
  subprodutos: yup.array().of(yup.string().uuid()).optional(),
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
      const body = request.body;

      const isValid = await postSchema.isValid(body);

      if (!isValid) {
        const errors = await postSchema
          .validate(body)
          .catch((err) => err.errors);

        return reply.status(400).send({ message: errors });
      }

      const result = await client.$transaction(async (prisma) => {
        const pacote = await client.pacote.create({
          data: {
            nmpacote: body.nmproduto,
            cdusuario: user.id,
          },
        });

        return { pacote };
      });

      return reply.send(result);
    }
  );

  fastify.post(
    "/:cdpacote/items",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { cdpacote } = request.params;

      const { session } = request.headers;

      if (!session) return reply.status(401).send({ message: "Unauthorized" });

      /**
       * @type {{items: {cdproduto: string, cdsubproduto: string}[]}}
       */
      const body = await req.json();

      const validate = await itemsPostSchema.isValid(body);

      if (!validate) {
        const errors = await itemsPostSchema
          .validate(body)
          .catch((err) => err.errors);

        return reply.status(400).send({ message: errors });
      }

      const result = await client
        .$transaction(async (prisma) => {
          const pacote = await prisma.pacote.findFirstOrThrow({
            where: {
              cdpacote: cdpacote,
            },
          });

          const itensDentroDoPacote = await prisma.pacote_item.findMany({
            where: {
              cdpacote: cdpacote,
            },
          });

          const possuiProdutoDiferente = itensDentroDoPacote.some((item) =>
            body.items.some((itemBody) => itemBody.cdproduto !== item.cdproduto)
          );

          if (possuiProdutoDiferente) {
            throw new Error("O pacote não pode ter produtos diferentes");
          }

          const cdproduto = body.items[0].cdproduto;

          const subprodutos = await prisma.sub_produto.findMany({
            where: {
              cdproduto: cdproduto,
              cdsubproduto: {
                in: body.items.map((item) => item.cdsubproduto),
              },
            },
          });

          const produtoTemSubProdutos = subprodutos.length > 0;

          if (produtoTemSubProdutos) {
            const pacoteitem = await prisma.pacote_item.createMany({
              data: subprodutos.map((subproduto) => ({
                cdpacote: pacote.cdpacote,
                cdproduto: subproduto.cdproduto,
                cdsubproduto: subproduto.cdsubproduto,
                cdsubprodutotipo: subproduto.cdsubprodutotipo,
              })),
            });

            return { pacote, pacoteitem };
          }

          const produto = await prisma.produto.findFirstOrThrow({
            where: {
              cdproduto: cdproduto,
            },
          });

          const pacoteitem = await prisma.pacote_item.create({
            data: {
              cdpacote: pacote.cdpacote,
              cdproduto: produto.cdproduto,
              cdsubproduto: null,
              cdsubprodutotipo: null,
            },
          });

          return { pacote, pacoteitem };
        })
        .catch((err) => {
          return reply.status(500).send({ message: err.message });
        });

      return reply.send(result);
    }
  );

  fastify.get(
    "/:cdpacote/items",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { cdpacote } = request.params;

      const { session } = request.headers;

      if (!session) return reply.status(401).send({ message: "Unauthorized" });

      const result = await client.pacote_item.findMany({
        where: {
          cdpacote: cdpacote,
        },
      });

      return reply.send(result);
    }
  );

  fastify.post(
    "/empacotar",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { session } = request.headers;
      const user = session.user;
      const body = request.body;
      const validate = await empacotarPostSchema.isValid(body);

      if (!validate) {
        const errors = await empacotarPostSchema
          .validate(body)
          .catch((err) => err.errors);

        return reply.status(400).send({ message: errors });
      }

      try {
        const result = await knexClient.transaction(async (trx) => {
          const { cdproduto, subprodutos = [] } = body;

          let cdcarrinho = "";

          const carrinho = await trx
            .raw(
              `
              select c.cdcarrinho from public.carrinho c
              where 1=1
              and c.sgcarrinhosituacao = 'PEN'
              and c.cdusuario = '${user.id}'::uuid
            `
            )
            .then((res) => res.rows[0]);

          if (!carrinho) {
            cdcarrinho = await trx
              .raw(
                `
                insert into public.carrinho (cdusuario)
                select '${user.id}'::uuid
                returning cdcarrinho
              `
              )
              .then((res) => res.rows[0].cdcarrinho);
          } else {
            cdcarrinho = carrinho.cdcarrinho;
          }

          const { cdpacote } = await trx
            .raw(
              `
              insert into public.pacote (cdproduto, cdcarrinho)
              select '${cdproduto}'::uuid, '${cdcarrinho}'::uuid
              returning cdpacote
            `
            )
            .then((res) => res.rows[0]);

          for await (const subproduto of subprodutos) {
            await trx.raw(
              `
                insert into public.pacote_item (cdpacote, cdsubproduto)
                select '${cdpacote}'::uuid, '${subproduto}'::uuid
              `
            );
          }

          return {
            cdpacote,
            cdcarrinho,
          };
        });

        return reply.status(200).send(result);
      } catch (error) {
        console.error(`Erro ao empacotar produto e subprodutos.`);
        console.error(error.message);
        return reply.status(500).send({
          message: error.message,
        });
      }
    }
  );

  fastify.patch(
    "/:cdpacote/quantidade/:quantidade",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { session } = request.headers;
      const user = session.user;

      const { cdpacote, quantidade } = request.params;

      const quantidadeSchema = yup.number().positive().required();
      const cdpacoteSchema = yup.string().uuid().required();

      const validateSchema = yup.object().shape({
        cdpacote: cdpacoteSchema,
        quantidade: quantidadeSchema,
      });

      const validate = validateSchema.isValid({ cdpacote, quantidade });

      if (!validate) {
        const errors = validateSchema
          .validate({ cdpacote, quantidade })
          .catch((err) => err.errors);

        return reply.status(400).send({ message: errors });
      }
      try {
        await knexClient.transaction(async (trx) => {
          const pertenceUsuario = await trx
            .raw(
              `
              select c.cdcarrinho from public.carrinho c
              where c.cdusuario = '${user.id}'::uuid
            `
            )
            .then((res) => res.rows[0]);

          if (!pertenceUsuario)
            throw new Error(`Pacote com id '${cdpacote}' é inválido.`);

          await trx.raw(
            `
              update public.pacote
              set quantidade = ${quantidade}
              where 1=1
                and cdpacote = '${cdpacote}'::uuid
            `
          );
        });

        return reply.status(200).send()
      } catch (error) {
        console.error(
          `Erro atualizando quantidade do pacote com id '${cdpacote}'.`
        );
        console.error(error.message);
        return reply.status(500).send({ message: error.message });
      }
    }
  );
}
