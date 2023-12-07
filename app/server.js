import fastify from "fastify";
import { client } from "./lib/prisma.js";
import { supabaseCreateClient } from "./lib/supabase.js";

const app = fastify();

app.setErrorHandler((error, request, reply) => {
  if (error instanceof fastify.errorCodes.FST_ERR_BAD_STATUS_CODE) {
    reply.code(500).send({ message: "Internal Server Error" });
  } else {
    reply.send(error);
  }
});

app.get("/health", async (request, reply) => {
  return { status: "ok" };
});

app.post("/auth", async (request, reply) => {
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

app.get("/carrinho", async (request, reply) => {
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

app
  .listen({
    host: "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 3333,
  })
  .then(() => {
    console.info("SERVER RUNNING", process.env.PORT);
  });
