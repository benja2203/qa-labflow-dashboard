import 'dotenv/config';

function requireEnv(name, { optional = false } = {}) {
  const value = process.env[name];
  if (!value && !optional) {
    throw new Error(
      `Falta ${name} en automation/.env. Copiá automation/.env.example a automation/.env y completalo.`
    );
  }
  return value;
}

export const config = {
  smartkiApiBaseUrl: requireEnv('SMARTKI_API_BASE_URL'),
  smartkiActivityBaseUrl: requireEnv('SMARTKI_ACTIVITY_BASE_URL'),
  smartkiDashBaseUrl: requireEnv('SMARTKI_DASH_BASE_URL'),
  cooperDashBaseUrl: requireEnv('COOPER_DASH_BASE_URL'),
  // Credenciales todavía no usadas por ningún check (ver README): quedan
  // acá para cuando se confirme el flujo de auth de la API 2.0.
  smartkiApiUser: requireEnv('SMARTKI_API_USER', { optional: true }),
  smartkiApiPassword: requireEnv('SMARTKI_API_PASSWORD', { optional: true }),
};
