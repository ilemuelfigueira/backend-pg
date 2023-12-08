import client from "../lib/prisma.js";
import { supabaseCreateClient } from "../lib/supabase.js";

async function carrinhoRoutes(fastify, options) {
  fastify.get("/", async (request, reply) => {
    const headers = request.headers;

    const accessToken = headers.access_token;
    const refreshToken = headers.refresh_token;

    const supabase = await supabaseCreateClient(
      accessToken,
      refreshToken,
      (error) => reply.status(401).send({ message: error })
    );

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      reply.code(401).send({ message: "Unauthorized" });
    }

    const user = session.user;

    const carrinhos = await client.carrinho.findFirstOrThrow({
      include: {
        carrinho_situacao: true,
      },
      where: {
        cdusuario: user.id,
        sgcarrinhosituacao: "PEN",
      },
    });

    reply.send(carrinhos);
  });
}

export default carrinhoRoutes;
