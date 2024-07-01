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
      CONCAT('${storage_public}', COALESCE(pf2.nmpath, pf.nmpath, p.avatar, pr.banners->>0)) as nmpath,
      (SUM(COALESCE(spp.vlsubproduto, 0)) + COALESCE(pp.vlproduto, 0)) * p.quantidade as vlpacote,
      (SUM(COALESCE(spp.vlsubproduto, 0)) + COALESCE(pp.vlproduto, 0)) as vlpacoteunidade
    from pacote p
    left join pacote_item pi2 
      on pi2.cdpacote = p.cdpacote 
    left join (
      select * from produto_foto pf
      limit 1
    ) as pf
      on pf.cdproduto = p.cdproduto 
    inner join carrinho cr
      on cr.cdcarrinho = p.cdcarrinho
      ${ignoreStatusCarrinho ? "" : `and cr.sgcarrinhosituacao = 'PEN'`}
    left join pacote_foto pf2
      on pf2.cdpacote = p.cdpacote
    inner join produto pr
      on pr.cdproduto = p.cdproduto
    left join sub_produto sp
      on sp.cdsubproduto = pi2.cdsubproduto
    left join produto_preco pp 
      on pp.cdproduto = pr.cdproduto
      and pp.flativo = 'S'
    left join sub_produto_preco spp
      on spp.cdsubproduto = sp.cdsubproduto
      and spp.flativo = 'S'
    where 1=1
      and p.cdcarrinho = '${cdcarrinho}'::uuid
    group by 
      p.cdpacote, 
      p.nmpathname,
      p.quantidade,
      p.cdproduto, 
      pr.banners,
      pf.nmpath, 
      pf2.nmpath,
      pr.nmproduto, 
      pr.deproduto,
      pr.nmprodutotipo, 
      pp.vlproduto
    order by
      pr.nmprodutotipo
    ;
  `;

  return query;
};
