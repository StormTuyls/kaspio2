insert into public.transactions
  (id, organisation_id, pot_id, amount, direction, occurred_on,
   memo, counterparty, bank_account, created_by)
select v.id::uuid, '03be1d68-0be2-5b39-b86a-e3135dfdf6ca', v.pot::uuid,
       v.amt, v.dir::txn_direction, v.d::date, v.memo, v.cp,
       'BE72230034114516', '8ce38e95-6a4f-4d5c-a659-8ef96fb3c023'
from (values
  ('89790324-4908-5118-aa86-a80e90558fd3','b64b6412-fb96-413e-b3ca-628c22869c02','2026-08-09',2801.60,'out','loon juli','Sven Swinnen'),
  ('da2725b9-a4fc-59b5-a914-29c97719465f','b64b6412-fb96-413e-b3ca-628c22869c02','2026-07-13',2929.56,'out','loon juni','Sven Swinnen'),
  ('055c5aa2-5ffb-54da-b876-b18589182e0b','b64b6412-fb96-413e-b3ca-628c22869c02','2026-06-03',3293.91,'out','loon mei','Sven Swinnen'),
  ('4f95e931-fae6-5f85-b615-0b31725762f3','b64b6412-fb96-413e-b3ca-628c22869c02','2026-05-05',2690.96,'out','loon april','Sven Swinnen'),
  ('574796a1-6303-5cc4-909f-b1386f4dd1f5','b64b6412-fb96-413e-b3ca-628c22869c02','2026-04-02',2623.22,'out','loon maart','Sven Swinnen'),
  ('578486b4-411f-5da2-b6d6-247a669b02af','b64b6412-fb96-413e-b3ca-628c22869c02','2026-03-05',2823.90,'out','loon stu februari','Sven Swinnen'),
  ('2b15ebc6-f640-5d70-9c19-bfb28b3938ea','b64b6412-fb96-413e-b3ca-628c22869c02','2026-02-05',3299.03,'out','loon januari','Sven Swinnen'),
  ('74b41a7f-150d-59f5-9a25-7acd004ba956','b64b6412-fb96-413e-b3ca-628c22869c02','2026-01-03',1279.26,'out','loon december','Sven Swinnen'),
  ('5756aed5-6ebe-5d42-a627-055144e4234f','0862c114-fd83-4b18-892a-b2e7d06dbfc3','2026-08-09',2073.83,'out','loon juli','VANDERLINDEN GERT'),
  ('68ba760d-019a-50c9-9576-7fe14b57ffd7','0862c114-fd83-4b18-892a-b2e7d06dbfc3','2026-08-01',1378.95,'out','vakantiegeld','VANDERLINDEN GERT'),
  ('1c35a63d-c533-59ef-ae80-ba1c1f627a85','0862c114-fd83-4b18-892a-b2e7d06dbfc3','2026-07-05',2076.80,'out','loon juni','VANDERLINDEN GERT'),
  ('98d2057f-e570-5ef8-b103-6005d7c35d80','0862c114-fd83-4b18-892a-b2e7d06dbfc3','2026-06-03',2100.39,'out','loon mei','VANDERLINDEN GERT'),
  ('3e2b5383-13c5-563d-b81b-009cdf03d612','0862c114-fd83-4b18-892a-b2e7d06dbfc3','2026-05-05',2068.82,'out','loon april','VANDERLINDEN GERT'),
  ('70e66f16-4d11-578b-b1a3-ca92ce270613','0862c114-fd83-4b18-892a-b2e7d06dbfc3','2026-04-02',2074.25,'out','loon maart','VANDERLINDEN GERT'),
  ('9bb96a6a-9062-5279-ab37-c06416deaa1b','0862c114-fd83-4b18-892a-b2e7d06dbfc3','2026-03-05',2062.05,'out','loon februari','VANDERLINDEN GERT'),
  ('a5489419-56d3-56b2-8c04-cac2e23bb5bd','0862c114-fd83-4b18-892a-b2e7d06dbfc3','2026-02-05',2086.98,'out','loon januari','VANDERLINDEN GERT'),
  ('0f68eae4-31c3-5eee-8d0a-390dffac8c75','0862c114-fd83-4b18-892a-b2e7d06dbfc3','2026-01-03',2014.85,'out','loon december','VANDERLINDEN GERT'),
  ('6e4b5648-8369-5bed-a310-162869511206','dc786135-4d96-4d23-b86f-ab7fa64aa46c','2026-08-09',339.39,'out','+++037/2802/34413+++','PLUXEE BELGIUM/PLACEMENTS'),
  ('cc383f50-a4ea-5e07-8a79-d9202f9da435','dc786135-4d96-4d23-b86f-ab7fa64aa46c','2026-07-05',339.39,'out','+++037/2240/32209+++','PLUXEE BELGIUM/PLACEMENTS'),
  ('d0f46a7c-051b-5669-aab0-ea051a2ef448','dc786135-4d96-4d23-b86f-ab7fa64aa46c','2026-06-06',331.69,'out','+++037/1674/36749+++','PLUXEE BELGIUM/PLACEMENTS'),
  ('19c8557d-e977-55db-b3f6-ac9c8ab361b1','dc786135-4d96-4d23-b86f-ab7fa64aa46c','2026-05-17',316.29,'out','+++037/1145/85994+++','PLUXEE BELGIUM/PLACEMENTS'),
  ('e5c1ae84-65ba-57c3-9f66-2f1a6627183f','dc786135-4d96-4d23-b86f-ab7fa64aa46c','2026-04-15',377.90,'out','+++037/0573/48823+++','PLUXEE BELGIUM/PLACEMENTS'),
  ('92582214-f120-5474-bbe2-f11f609c5acc','dc786135-4d96-4d23-b86f-ab7fa64aa46c','2026-03-05',300.88,'out','+++037/0025/63829+++','PLUXEE BELGIUM/PLACEMENTS'),
  ('66c15b76-03c4-54d9-80bf-77a1375c762a','dc786135-4d96-4d23-b86f-ab7fa64aa46c','2026-02-05',377.91,'out','+++036/9514/36745+++','PLUXEE BELGIUM/PLACEMENTS'),
  ('faa182bb-f440-5a02-a2ee-01508914da0d','dc786135-4d96-4d23-b86f-ab7fa64aa46c','2026-01-03',219.76,'out','+++036/8941/71278+++','PLUXEE BELGIUM/PLACEMENTS'),
  ('353477aa-9d29-54d3-a741-2eab36976d7d','8f7e4f03-0986-495a-8113-66277ef2d363','2026-08-09',6567.60,'out','+++202/6048/18365+++','SODIWE VZW'),
  ('d7ad18b6-5327-5378-a7a6-b9ad02ea5679','8f7e4f03-0986-495a-8113-66277ef2d363','2026-07-24',1175.11,'out','+++202/6045/22719+++','SODIWE VZW'),
  ('6f995ac0-ea09-538e-81a0-ec5e225c0711','8f7e4f03-0986-495a-8113-66277ef2d363','2026-07-13',2889.99,'out','+++202/6040/77024+++','SODIWE VZW'),
  ('d7d1c809-5601-54c1-acd9-336ccf5eadfb','8f7e4f03-0986-495a-8113-66277ef2d363','2026-06-06',5692.39,'out','+++202/6034/48746+++','SODIWE VZW'),
  ('81b70a30-6541-5f8a-8c5b-3ffde8982ea0','8f7e4f03-0986-495a-8113-66277ef2d363','2026-05-11',5145.12,'out','+++202/6028/64322+++','SODIWE VZW'),
  ('6d313aac-5168-5963-8750-a81547b029fc','8f7e4f03-0986-495a-8113-66277ef2d363','2026-04-22',2491.20,'out','+++202/6026/01210+++','SODIWE VZW'),
  ('2f79d8f6-2ebf-5d4c-b00e-a260d64a8676','8f7e4f03-0986-495a-8113-66277ef2d363','2026-04-02',2627.02,'out','+++202/6020/55279+++','SODIWE VZW'),
  ('e01fba0b-74a3-5a21-b142-798558156671','8f7e4f03-0986-495a-8113-66277ef2d363','2026-03-05',5798.17,'out','+++202/6014/20335+++','SODIWE VZW'),
  ('83d07a9c-5a02-5b2c-b4f1-e1f83e5cff8f','8f7e4f03-0986-495a-8113-66277ef2d363','2026-02-05',5376.72,'out','+++202/6007/54166+++','SODIWE VZW'),
  ('320b61e3-ea47-5058-af65-fc9436737ef1','8f7e4f03-0986-495a-8113-66277ef2d363','2026-01-22',2478.17,'out','+++202/6004/31238+++','SODIWE VZW'),
  ('4c3abd83-89c0-5cd3-8251-762399691f03','8f7e4f03-0986-495a-8113-66277ef2d363','2026-01-03',1705.31,'out','+++202/6000/01206+++','SODIWE VZW'),
  ('99e2162e-d9b0-5f3b-8391-35aa9f95271d','ab746641-d9a8-4453-a98b-588223b89a33','2026-03-19',319.43,'in','080237332 AFREKENING EJP 2025','WAARBORG EN SOCIAAL FONDS VOOR DE')
) as v(id, pot, d, amt, dir, memo, cp)
on conflict (id) do nothing;

-- Loon Barman                          8 regels    -21741.44   stand   -21741.00  verschil    -0.44
-- Loon Secretaris                      9 regels    -17936.92   stand   -17936.92  verschil    -0.00
-- Maaltijdcheques & Eco-cheques        8 regels     -2603.21   stand    -2603.21  verschil     0.00
-- Soc Secr                            11 regels    -41946.80   stand   -41946.80  verschil     0.00
-- RSZ & SOC. FONDS                     1 regels       319.43   stand      319.43  verschil     0.00
