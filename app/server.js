import fastify from "fastify";
import { client } from "./lib/prisma.js";
import { supabaseCreateClient } from "./lib/supabase.js";

const app = fastify();

app.register(import("./routes.js"));

app
  .listen({
    host: "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 3333,
  })
  .then(() => {
    console.info("SERVER RUNNING", process.env.PORT);
  });

export default app;
