import dotenv from "dotenv";
dotenv.config();

import knex from "knex";

const DATABASE_URL = process.env.DATABASE_URL;

const createKnex = knex({
  client: "pg",
  connection: DATABASE_URL,
  searchPath: ["public", "auth"],
});

if (!global.knex) {
  global.knex = createKnex;
}

/**
 * @type {import('knex').Knex}
 */
const knexClient = global.knex || createKnex;

export { knexClient };

export default knexClient;
