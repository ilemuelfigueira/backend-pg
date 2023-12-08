import client from "./lib/prisma.js";
import { supabaseCreateClient } from "./lib/supabase.js";

async function routes(fastify, options) {
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof fastify.errorCodes.FST_ERR_BAD_STATUS_CODE) {
      reply.code(500).send({ message: "Internal Server Error" });
    } else {
      reply.send(error);
    }
  });

  fastify.get("/", async (request, reply) => {
    return { message: "Bem vindo a api da pgcustomstore" };
  });

  fastify.get("/health", async (request, reply) => {
    return { status: "ok" };
  });

  fastify.post("/auth", async (request, reply) => {
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

  fastify.get("/carrinho", async (request, reply) => {
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

export default routes;
