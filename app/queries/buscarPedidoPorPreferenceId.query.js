export function buscarPedidoPorPreferenceIdQuery({
  preferenceId
}) {

  const query = `
    select * from pedido p
    where p.preference_id = '${preferenceId}'
  `

  return query
}