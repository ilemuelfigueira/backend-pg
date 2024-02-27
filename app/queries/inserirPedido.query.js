export function inserirPedidoQuery({
  cdcarrinho,
  cdendereco,
  preferenceId,
  value,
  userId
}) {
  const query = `
    INSERT INTO public.pedido
      (user_id, preference_id, created_at, status, value, cdcarrinho, cdendereco)
    VALUES(
      '${userId}'::uuid, 
      '${preferenceId}', 
      now(), 
      'PENDING'::pedido_status_enum, 
      ${value}, 
      '${cdcarrinho}'::uuid,
      '${cdendereco}'::uuid
      )
    ON CONFLICT (cdcarrinho) DO UPDATE SET
      updated_at = EXCLUDED.created_at,
      status = EXCLUDED.status,
      cdendereco = EXCLUDED.cdendereco
    ;
  `;

  return query;
}
