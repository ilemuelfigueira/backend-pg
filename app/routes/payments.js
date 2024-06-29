import knexClient from "../lib/knex.js";

import { MercadoPagoConfig, Payment } from "mercadopago";

const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MPG_ACCESS_TOKEN,
  options: { timeout: 5000 },
});

const payment = new Payment(mercadopago);

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
export default async function (fastify, options) {
  fastify.get(
    "/:id/status",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        const { results } = await payment.search({
          options: {
            external_reference: id,
          },
        });

        const paymentApproved = results.some(
          (pay) => pay.status === "approved"
        );

        if (paymentApproved) {
          await knexClient.raw(`
            update public.pedido set
              status = 'PAID'
            where 1=1
              and preference_id = '${id}'
              and status <> 'PAID';
          `);
        }

        reply.status(200).send(results);
      } catch (error) {
        console.error(`Erro ao verificar status pagamento.`);
        console.error(error.message);
        reply.status(500).send({ error: error.message });
      }
    }
  );
}
