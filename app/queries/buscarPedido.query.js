import { UserRolesEnum } from "../enums/users.enum.js";

export const buscarPedidosUsuario = ({
  cdusuario = undefined,
  role = "cliente",
  order = "asc",
  orderBy = "",
  search = "",
  page = 1,
  limit = 5,
}) => {
  if (!cdusuario) throw new Error("cdusuario required");

  const isAdmin = role === UserRolesEnum.ADMIN;

  return query({
    order,
    orderBy,
    search,
    page: page <= 0 ? 1 : page,
    limit,
    cdusuario,
  });
};

const query = ({
  search = "",
  orderBy = "",
  order = "asc",
  limit = 5,
  page = 1,
  cdusuario,
}) => `
    select 
      p.*,
      u.id,
      u.email,
      u.raw_user_meta_data->>'nome' as nome,
      u.raw_user_meta_data->>'telefone' as telefone,
      count(*) over() as total
    from public.pedido p
    inner join auth.users u
      on u.id = p.user_id
    where 1=1
      and (
        cast(p.cdpedido as varchar) ilike '%${search}%'
        or u.email ilike '%${search}%'
        or u.raw_user_meta_data->>'nome' ilike '%${search}%'
      )
      ${cdusuario ? `and u.id = '${cdusuario}' ` : ""}
    order by 
      case 
        when 'producao-asc' = '${orderBy}-${order}' and p.production_status = 'PENDENTE' then 1
        when 'producao-asc' = '${orderBy}-${order}' and p.production_status = 'PRODUCAO' then 2
        when 'producao-asc' = '${orderBy}-${order}' and p.production_status = 'FINALIZADO' then 3
      end,
      case 
        when 'producao-desc' = '${orderBy}-${order}' and p.production_status = 'PENDENTE' then 3
        when 'producao-desc' = '${orderBy}-${order}' and p.production_status = 'PRODUCAO' then 2
        when 'producao-desc' = '${orderBy}-${order}' and p.production_status = 'FINALIZADO' then 1
      end,
      case 
        when 'rastreio-asc' = '${orderBy}-${order}' and p.tracking_status = 'PENDENTE' then 1
        when 'rastreio-asc' = '${orderBy}-${order}' and p.tracking_status = 'POSTADO' then 2
        when 'rastreio-asc' = '${orderBy}-${order}' and p.tracking_status = 'ENTREGUE' then 3
        when 'rastreio-asc' = '${orderBy}-${order}' and p.tracking_status = 'PROBLEMA NA ENTREGA' then 4
      end,
      case 
        when 'rastreio-desc' = '${orderBy}-${order}' and p.tracking_status = 'ENTREGUE' then 4
        when 'rastreio-desc' = '${orderBy}-${order}' and p.tracking_status = 'POSTADO' then 3
        when 'rastreio-desc' = '${orderBy}-${order}' and p.tracking_status = 'PENDENTE' then 2
        when 'rastreio-desc' = '${orderBy}-${order}' and p.tracking_status = 'PROBLEMA NA ENTREGA' then 1
      end,
      case 
        when 'pagamento-asc' = '${orderBy}-${order}' and p.status = 'PENDING' then 1
        when 'pagamento-asc' = '${orderBy}-${order}' and p.status = 'PAID' then 2
        when 'pagamento-asc' = '${orderBy}-${order}' and p.status = 'FAILED' then 3
      end,
      case 
        when 'pagamento-desc' = '${orderBy}-${order}' and p.status = 'PENDING' then 3
        when 'pagamento-desc' = '${orderBy}-${order}' and p.status = 'PAID' then 2
        when 'pagamento-desc' = '${orderBy}-${order}' and p.status = 'FAILED' then 1
      end,
      p.created_at desc
      limit ${limit ?? 5}
      offset ${(page - 1) * limit}
    ;
`;
