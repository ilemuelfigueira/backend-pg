import { UserRolesEnum } from "../enums/users.enum.js";

export const buscarPedidosUsuario = ({
  cdusuario = undefined,
  role = "cliente",
}) => {
  if (!cdusuario) throw new Error("cdusuario required");

  const userOnly = role === UserRolesEnum.CLIENTE ? `and p.user_id = '${cdusuario}'` : ``;

  const query = `
    select * from public.pedido p
    where 1=1
      ${userOnly}
    order by 
      p.status,
      p.tracking_status,
      p.production_status
    ;
  `;

  return query;
};
