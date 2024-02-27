import dotenv from "dotenv";
dotenv.config();

import { MercadoPagoConfig, Preference } from "mercadopago";

const ACCESS_TOKEN = process.env.MPG_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.MPG_PUBLIC_KEY;

/**
 * @type {import('mercadopago').MercadoPagoConfig}
 */
export const mpgClient = new MercadoPagoConfig({
  accessToken: ACCESS_TOKEN,
  options: {
    timeout: 5000,
  },
});

export const mpgPreference = new Preference(mpgClient)
