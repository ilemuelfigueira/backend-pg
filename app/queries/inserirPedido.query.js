export function inserirPedidoQuery({
  cdcarrinho,
  cdendereco,
  preferenceId,
  value,
  userId,
  items
}) {
  const query = `
    INSERT INTO public.pedido
      (user_id, preference_id, created_at, status, value, cdcarrinho, cdendereco, payment_url, items)
    VALUES(
      '${userId}'::uuid, 
      '${preferenceId}', 
      now(), 
      'PENDING'::pedido_status_enum, 
      ${value}, 
      '${cdcarrinho}'::uuid,
      '${cdendereco}'::uuid,
      :payment_url,
      '${JSON.stringify(items)}'
      )
    ON CONFLICT (cdcarrinho) DO UPDATE SET
      updated_at = EXCLUDED.created_at,
      cdendereco = EXCLUDED.cdendereco,
      items = EXCLUDED.items,
      payment_url = EXCLUDED.payment_url
    ;
  `;

  return query;
}
