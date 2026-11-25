-- Placeholder products for the mall preview (replace/edit in admin). Inserted only when the catalog is empty.
insert into public.tts_catalog (name, brand, category, sort, price_krw, list_price_krw, price_jpy, list_price_jpy, commission, moq, sample, active, mall, live, free_ship, section, sold, rating, stock, img_url, descr, detail, options)
select * from (values
 ('데일리 글로우 페이셜 세럼 30ml','glow.lab','beauty',1,28000,39000,2980,3980,20,100,true,true,true,true,true,'deal',12840,4.8,500,'https://whaleguard.github.io/tiktokshop-partner/img/p-serum.jpg','매일 쓰는 수분 광채 세럼','가볍게 스며드는 수분 세럼입니다. 아침·저녁 세안 후 2~3방울을 얼굴 전체에 펴 발라 주세요.','용량: 30ml, 50ml'),
 ('쿠션 팩트 SPF50+ 본품+리필','glow.lab','beauty',2,32000,45000,3480,4680,18,100,true,true,true,true,true,'deal',9420,4.7,400,'https://whaleguard.github.io/tiktokshop-partner/img/p-cushion.jpg','얇고 촉촉한 커버 쿠션','본품과 리필 1개 구성. 얇게 밀착되는 세미 매트 마무리.','호수: 21호 라이트, 23호 내추럴'),
 ('워터 립 틴트 3종 세트','PEONY','beauty',3,19800,27000,2180,2980,22,200,true,true,true,false,true,'',15230,4.9,800,'https://whaleguard.github.io/tiktokshop-partner/img/p-tint.jpg','로즈·코랄·레드 3종','촉촉한 워터 제형으로 맑게 물드는 립 틴트 3종 세트입니다.',''),
 ('마일드 선크림 SPF50+ PA++++ 50ml','SUNDAY','beauty',4,15900,22000,1780,2380,20,200,true,true,true,false,false,'',7310,4.7,600,'https://whaleguard.github.io/tiktokshop-partner/img/p-sunscreen.jpg','백탁 없는 데일리 선크림','끈적임 없이 산뜻하게 마무리되는 데일리 선크림.',''),
 ('하이드레이팅 시트 마스크 10매','SUNDAY','beauty',5,12000,20000,1380,2180,25,300,true,true,true,false,false,'deal',21050,4.8,1000,'https://whaleguard.github.io/tiktokshop-partner/img/p-mask.jpg','5종 시트 마스크 10매','5가지 타입 시트 마스크 각 2매 구성.',''),
 ('코리안 스낵 파우치 3종 세트','K-SNACK','food',6,12900,15900,1480,1780,15,300,true,true,true,true,false,'',18620,4.6,700,'https://whaleguard.github.io/tiktokshop-partner/img/p-snack.jpg','인기 과자 3가지 맛','달콤·고소·바삭 3가지 맛 파우치 세트.',''),
 ('소프트 아이보리 니트 가디건','SEONGSU ATELIER','fashion',7,59000,79000,5980,7980,18,50,true,true,true,false,true,'',3280,4.8,120,'https://whaleguard.github.io/tiktokshop-partner/img/p-knit.jpg','부드러운 울 블렌드 가디건','데일리로 입기 좋은 루즈핏 니트 가디건.','사이즈: S, M, L'),
 ('스테인리스 텀블러 500ml','DAILY MOOD','living',8,18900,25000,1980,2680,20,100,true,true,true,false,false,'deal',6410,4.7,300,'https://whaleguard.github.io/tiktokshop-partner/img/p-tumbler.jpg','보온·보냉 파스텔 텀블러','이중 진공 구조로 보온·보냉이 오래 유지됩니다.','컬러: 로즈, 민트, 아이보리'),
 ('무드등 미니 가습기','DAILY MOOD','living',9,29000,39000,3180,4180,18,100,true,true,true,true,true,'',4920,4.6,200,'https://whaleguard.github.io/tiktokshop-partner/img/p-humidifier.jpg','은은한 조명 미니 가습기','저소음 초음파 방식, USB-C 전원.',''),
 ('곰돌이 아크릴 키링 3종','BEARLAND','hobby',10,9900,12000,1080,1380,25,300,true,true,true,false,false,'',11870,4.9,900,'https://whaleguard.github.io/tiktokshop-partner/img/p-keyring.jpg','가방에 다는 곰돌이 키링','양면 인쇄 아크릴 키링 3종 세트.',''),
 ('무선 충전 패드 15W','TONEBUDS','tech',11,24900,35000,2680,3780,15,100,false,true,true,false,true,'deal',5230,4.5,250,'https://whaleguard.github.io/tiktokshop-partner/img/p-charger.jpg','슬림 고속 무선 충전기','15W 고속 무선 충전, 미끄럼 방지 패드.',''),
 ('노이즈캔슬링 무선 이어폰','TONEBUDS','tech',12,79000,99000,7980,9980,12,100,false,true,true,true,true,'',8740,4.7,150,'https://whaleguard.github.io/tiktokshop-partner/img/p-earbuds.jpg','ANC 무선 이어폰','액티브 노이즈 캔슬링, 최대 30시간 재생.','')
) as v(name, brand, category, sort, price_krw, list_price_krw, price_jpy, list_price_jpy, commission, moq, sample, active, mall, live, free_ship, section, sold, rating, stock, img_url, descr, detail, options)
where not exists (select 1 from public.tts_catalog);

update public.tts_config set data = data || jsonb_build_object('shipKRW', 3000, 'freeOverKRW', 30000, 'shipJPY', 500, 'freeOverJPY', 4000) where id = 1 and not (data ? 'shipKRW');
