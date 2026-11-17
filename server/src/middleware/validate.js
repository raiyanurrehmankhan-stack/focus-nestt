/**
 * validate(schema, 'body' | 'query' | 'params') — parses and replaces the
 * request part with the validated (and trimmed/defaulted) value.
 */
export const validate = (schema, part = 'body') => (req, _res, next) => {
  const source = part === 'query' ? coerceQuery(req.query) : req[part];
  const result = schema.safeParse(source ?? {});
  if (!result.success) return next(result.error);
  if (part === 'query') req.validQuery = result.data;
  else req[part] = result.data;
  next();
};

function coerceQuery(q) {
  const out = {};
  for (const [k, v] of Object.entries(q || {})) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}
