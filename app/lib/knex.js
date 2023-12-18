import dotenv from "dotenv";
dotenv.config();

import knex from 'knex'

const DIRECT_URL = process.env.DIRECT_URL;

const createKnex = () => {
  const client = knex({
    client: "pg",
    connection: DIRECT_URL,
    searchPath: ["public", "auth"],
  });

  return client;
};

if (!global.knex) {
  global.knex = createKnex();
}

/**
 * @type {import('knex').Knex}
 */
const knexClient = global.knex || createKnex();

export { knexClient };

export default knexClient;
