import { UserRolesEnum } from "../enums/users.enum.js";

export const buscarPedidosUsuario = ({
  cdusuario = undefined,
  role = "cliente",
}) => {
  if (!cdusuario) throw new Error("cdusuario required");

  const isAdmin = role === UserRolesEnum.ADMIN;

  const query = isAdmin
    ? queryAdmin()
    : queryUser({
        cdusuario,
      });

  return query;
};

const queryUser = ({ ...params }) => `
    select 
    p.*
    from public.pedido p
    where 1=1
      and p.user_id = '${params?.cdusuario}'
    order by 
    p.status,
    p.tracking_status,
    p.production_status
    ;
`;

const queryAdmin = () => `
    select 
      p.*,
      u.id,
      u.email,
      u.raw_user_meta_data->'nome' as nome,
      u.raw_user_meta_data->'telefone' as telefone
    from public.pedido p
      inner join auth.users u
      on u.id = p.user_id
    where 1=1
    order by 
      p.created_at desc,
      case 
        when p.status = 'PENDING' then 1
        when p.production_status = 'PENDENTE' then 2
        when p.tracking_status = 'PENDENTE' then 3
      end,
      p.tracking_status,
      p.production_status
    ;
`;
