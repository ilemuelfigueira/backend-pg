export const mapToObject = (map) => {
  const obj = Object.create(null);
  for (let [k, v] of map) {
    obj[k] = v;
  }
  return obj;
}

export async function validateSchema(schema, data) {
  try {
      await schema.validate(data, { abortEarly: false });
      return {
          valid: true,
          errors: null
      };
  } catch (err) {
      return {
          valid: false,
          errors: err.errors
      };
  }
}