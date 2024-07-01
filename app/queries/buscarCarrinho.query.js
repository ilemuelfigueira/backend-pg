const storage_public = process.env.STORAGE_PUBLIC || "url_nao_definida";

export const buscarCarrinhoQuery = ({
  cdcarrinho = "cdcarrinho_nao_definido",
  cdusuario = "cdusuario_nao_definido",
  ignoreStatusCarrinho = false,
}) => {
  const query = `
    select distinct 
      p.cdpacote, 
      p.cdusuario, 
      p.nmpacote,
      p.cdproduto,
      pr.nmproduto,
      pr.deproduto,
      pr.nmprodutotipo,
      p.quantidade as nuqtdpacote,
      p.quantidade,
      p.nmpathname,
      CONCAT(pr.nmprodutotipo, ' - ', pr.nmproduto) as concat_nmproduto,
      string_agg(CONCAT(sp.nmsubprodutotipo, ' - ', sp.nmsubproduto), ', ') as concat_nmsubprodutotipo,
      string_agg(sp.nmsubproduto, ', ') as concat_nmsubproduto,
      CONCAT('${storage_public}', COALESCE(p.avatar, pr.banners->>0)) as nmpath,
      (SUM(COALESCE(sp.vlsubproduto, 0)) + COALESCE(pr.vlproduto, 0)) * p.quantidade as vlpacote,
      (SUM(COALESCE(sp.vlsubproduto, 0)) + COALESCE(pr.vlproduto, 0)) as vlpacoteunidade
    from pacote p
    left join pacote_item pi2 
      on pi2.cdpacote = p.cdpacote 
    inner join carrinho cr
      on cr.cdcarrinho = p.cdcarrinho
      ${ignoreStatusCarrinho ? "" : `and cr.sgcarrinhosituacao = 'PEN'`}
    inner join produto pr
      on pr.cdproduto = p.cdproduto
    left join sub_produto sp
      on sp.cdsubproduto = pi2.cdsubproduto
    where 1=1
      and p.cdcarrinho = '${cdcarrinho}'::uuid
    group by 
      p.cdpacote, 
      p.nmpathname,
      p.quantidade,
      p.cdproduto, 
      pr.banners,
      pr.nmproduto, 
      pr.vlproduto,
      pr.deproduto,
      pr.nmprodutotipo
    order by
      pr.nmprodutotipo
    ;
  `;

  return query;
};
