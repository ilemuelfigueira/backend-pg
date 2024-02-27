export function buscarUsuarioQuery({
  cdusuario = ''
}) {

  const query = `
  select 
    coalesce(u.raw_user_meta_data ->> 'nome'::varchar, u.email) as name,
    u.email as email,
    case
      when u.raw_user_meta_data ->> 'cpf'::varchar <> '' 
      then replace(replace(u.raw_user_meta_data ->> 'cpf', '.', ''), '-', '')
      else null
    end	as cpf,
    case
      when u.raw_user_meta_data ->> 'telefone'::varchar <> '' 
      then substring(u.raw_user_meta_data ->> 'telefone', 2, 2)
      else null
    end	as phone_code,
    case
      when u.raw_user_meta_data ->> 'telefone'::varchar <> '' 
      then REPLACE(substring(u.raw_user_meta_data ->> 'telefone', 5, 11), '-', '')
      else null
    end	as phone_number,
    *
  from auth.users u
  where 1=1
  ${cdusuario ? `and u.id = '${cdusuario}'::uuid` : ''}
  ;
  `

  return query
}