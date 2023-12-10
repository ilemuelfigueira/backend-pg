import client from "../lib/prisma.js";
import * as yup from "yup";

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
}
