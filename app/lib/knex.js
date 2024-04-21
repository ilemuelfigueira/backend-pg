import dotenv from "dotenv";
dotenv.config();

import knex from "knex";

const DATABASE_URL = process.env.DATABASE_URL;

/**
 * @type {import('knex').Knex}
 */
const knexClient = knex({
  client: "pg",
  connection: DATABASE_URL,
  searchPath: ["public", "auth"],
  pool: { min: 0, max: 15 }
}).on("connect", (e) => console.log("connected to db"));

export { knexClient };

export default knexClient;
