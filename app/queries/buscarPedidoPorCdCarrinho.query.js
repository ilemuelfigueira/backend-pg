export function buscarPedidoPorCdCarrinhoQuery({
  cdcarrinho
}) {

  const query = `
    select * from pedido p
    where p.cdcarrinho = '${cdcarrinho}'::uuid
  `

  return query
}