UPDATE "finance"."finance_snapshots" AS s SET "data" = jsonb_build_object('holdings', coalesce((
  SELECT jsonb_agg(h.item ORDER BY h.k, h.g, h.o) FROM (
    SELECT 1 AS k, 0::bigint AS g, b.o, jsonb_build_object('kind', 'local_bank', 'name', b.v->>'name', 'group', NULL::text,
      'amount', (b.v->>'amountPkr')::numeric, 'exchangeRate', 1) AS item
    FROM jsonb_array_elements(s."data"->'localBanks') WITH ORDINALITY AS b(v, o)
    UNION ALL
    SELECT 2, 0, b.o, jsonb_build_object('kind', 'remote_bank', 'name', b.v->>'name', 'group', NULL::text,
      'amount', (b.v->>'amountUsd')::numeric, 'exchangeRate', (b.v->>'exchangeRate')::numeric)
    FROM jsonb_array_elements(s."data"->'remoteBanks') WITH ORDINALITY AS b(v, o)
    UNION ALL
    SELECT 3, g.o, f.o, jsonb_build_object('kind', 'mutual_fund', 'name', f.v->>'fund', 'group', e.key,
      'amount', (f.v->>'value')::numeric, 'exchangeRate', 1)
    FROM jsonb_array_elements(s."data"->'mutualFunds') WITH ORDINALITY AS g(v, o)
    CROSS JOIN LATERAL jsonb_each(g.v) AS e(key, value)
    CROSS JOIN LATERAL jsonb_array_elements(e.value) WITH ORDINALITY AS f(v, o)
  ) AS h
), '[]'::jsonb))
WHERE s."data" ? 'localBanks';
