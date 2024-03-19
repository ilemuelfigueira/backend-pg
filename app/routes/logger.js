import knexClient from "../lib/knex.js";

import * as yup from "yup";

const insertBodySchema = yup.object().shape({
  action: yup.string().required(),
  content: yup.string().required(),
  request_ip: yup.string().required(),
  raw_payment_meta_data: yup.object().nullable(),
});

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
export default async function (fastify, options) {
  fastify.post("/generic", async (request, reply) => {
    const isValid = await insertBodySchema.isValid({
      ...request.body,
      request_ip: request.ip,
    });

    if (!isValid) {
      const errors = await postSchema.validate(body).catch((err) => err.errors);

      return reply.status(400).send({ message: errors });
    }

    const body = insertBodySchema.cast({
      ...request.body,
      request_ip: request.ip,
    });

    const result = await knexClient.raw(`
        INSERT INTO public.action_logger
        ("action", "content", request_ip, raw_payment_meta_data)
        VALUES('${body.action}', '${body.content}', '${body.request_ip}', '${body.raw_payment_meta_data}')
        RETURNING "id";
      `).then(res => res.rows[0]);

    return reply.send(result);
  });
}
