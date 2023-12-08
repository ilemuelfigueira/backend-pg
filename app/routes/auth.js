import { supabaseCreateClient } from "../lib/supabase.js";

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
async function authRoutes(fastify, options) {
  fastify.post("/", async (request, reply) => {
    const { email, password } = request.body;

    const supabase = await supabaseCreateClient();

    const {
      data: { session },
      error,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !session) {
      reply.code(401).send({ message: "Unauthorized" });
    }

    reply.status(200).send(session);
  });
}

export default authRoutes;
