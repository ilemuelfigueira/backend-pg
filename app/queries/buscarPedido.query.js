export const buscarPedidosUsuario = ({ cdusuario = undefined }) => {
  if (!cdusuario) throw new Error("cdusuario required");

  const query = `
    select * from public.pedido p
    where 1=1
      and p.user_id = '${cdusuario}';
    ;
  `;

  return query;
};
