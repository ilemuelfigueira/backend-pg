import client from "../lib/prisma.js";

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
export default async function (fastify, options) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { session } = request.headers;

      if (!session) return reply.status(401).send({ message: "Unauthorized" });

      const user = session.user;

      const result = await client.carrinho.findFirstOrThrow({
        include: {
          carrinho_situacao: true,
        },
        where: {
          cdusuario: user.id,
          sgcarrinhosituacao: "PEN",
        },
      });

      return reply.send(result);
    }
  );

  fastify.get(
    "/:cdcarrinho/pacotes",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const paramsMap = new Map(Object.entries(request.params));
      const { session } = request.headers;

      if (!session) return reply.status(401).send({ message: "Unauthorized" });
      if (!paramsMap.has("cdcarrinho"))
        return reply.status(400).send({ message: "Bad Request" });

      const cdcarrinho = paramsMap.get("cdcarrinho");

      const carrinho = await client.carrinho.findFirstOrThrow({
        where: {
          cdcarrinho,
          cdusuario: session.user.id,
        },
      });

      if (!carrinho)
        return NextResponse.json("Carrinho não encontrado", { status: 404 });

      const pacotes = await client.$queryRaw`
        select distinct 
          p.cdpacote, 
          p.cdusuario, 
          p.nmpacote,
          pi2.cdproduto,
          pr.nmproduto,
          pr.deproduto,
          pr.nmprodutotipo,
          cp.nuqtdpacote,
          p.nmpathname,
          CONCAT(pr.nmprodutotipo, ' - ', pr.nmproduto) as concat_nmproduto,
          string_agg(CONCAT(spt.nmsubprodutotipo, ' - ', sp.nmsubproduto), ', ') as concat_nmsubprodutotipo,
          string_agg(sp.nmsubproduto, ', ') as concat_nmsubproduto,
          CONCAT(${process.env.STORAGE_PUBLIC}, COALESCE(pf2.nmpath, pf.nmpath)) as nmpath,
          (SUM(COALESCE(spp.vlsubproduto, 0)) + COALESCE(pp.vlproduto, 0)) * cp.nuqtdpacote as vlpacote
        from carrinho_pacote cp
        inner join pacote p 
          on p.cdpacote = cp.cdpacote 
        inner join pacote_item pi2 
          on pi2.cdpacote = p.cdpacote 
        left join (
          select * from produto_foto pf
          limit 1
        ) as pf
          on pf.cdproduto = pi2.cdproduto 
        inner join carrinho cr
          on cr.cdcarrinho = cp.cdcarrinho
          and cr.sgcarrinhosituacao = 'PEN'
        left join pacote_foto pf2
          on pf2.cdpacote = p.cdpacote
        inner join produto pr
          on pr.cdproduto = pi2.cdproduto
        left join sub_produto sp
          on sp.cdsubproduto = pi2.cdsubproduto
        left join sub_produto_tipo spt
          on spt.cdsubprodutotipo = sp.cdsubprodutotipo
        left join produto_preco pp 
          on pp.cdproduto = pr.cdproduto
          and pp.flativo = 'S'
        left join sub_produto_preco spp
          on spp.cdsubproduto = sp.cdsubproduto
          and spp.flativo = 'S'
        where 1=1
          and cp.cdcarrinho = ${cdcarrinho}::uuid
        group by 
          p.cdpacote, 
          p.nmpathname,
          cp.nuqtdpacote,
          pi2.cdproduto, 
          pf.nmpath, 
          pf2.nmpath,
          pr.nmproduto, 
          pr.deproduto,
          pr.nmprodutotipo, 
          pp.vlproduto, 
          cp.nuqtdpacote
        ;
    `;

      return reply.send(pacotes);
    }
  );
}
