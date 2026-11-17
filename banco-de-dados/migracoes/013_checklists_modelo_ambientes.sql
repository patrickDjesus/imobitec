-- Imobitec | Checklists modelo para todos os tipos de ambiente
-- Pré-requisito: executar 001 a 012 em ordem.
-- Execute este arquivo no Supabase SQL Editor.
-- Script idempotente: preserva modelos existentes e adiciona somente itens ausentes.

begin;

create temporary table seed_context on commit drop as
select id as user_id, organization_id
from public.profiles
where id = '98ed30c7-60cc-449e-ae1a-45e56f9b00ca'::uuid
  and is_active = true;

do $$
begin
  if not exists (select 1 from seed_context) then
    raise exception 'Administrador ativo não encontrado. Verifique UUID e execução dos arquivos 001 e 002.';
  end if;
end;
$$;

create temporary table seed_templates (
  environment_type text primary key,
  template_name text not null
) on commit drop;

insert into seed_templates (environment_type, template_name) values
  ('living_room', 'Modelo padrão - Sala de estar'),
  ('dining_room', 'Modelo padrão - Sala de jantar'),
  ('kitchen', 'Modelo padrão - Cozinha'),
  ('bedroom', 'Modelo padrão - Quarto'),
  ('bathroom', 'Modelo padrão - Banheiro'),
  ('garage', 'Modelo padrão - Garagem ou estacionamento'),
  ('laundry', 'Modelo padrão - Lavanderia'),
  ('office', 'Modelo padrão - Escritório'),
  ('balcony', 'Modelo padrão - Varanda ou sacada'),
  ('hallway', 'Modelo padrão - Corredor ou circulação'),
  ('pantry', 'Modelo padrão - Copa ou despensa'),
  ('closet', 'Modelo padrão - Closet'),
  ('pool', 'Modelo padrão - Piscina'),
  ('outdoor_area', 'Modelo padrão - Área externa'),
  ('other', 'Modelo padrão - Outro ambiente'),
  ('reception', 'Modelo padrão - Recepção'),
  ('service_area', 'Modelo padrão - Área de atendimento'),
  ('sales_area', 'Modelo padrão - Área de vendas'),
  ('meeting_room', 'Modelo padrão - Sala de reunião'),
  ('warehouse', 'Modelo padrão - Estoque ou depósito'),
  ('commercial_kitchen', 'Modelo padrão - Cozinha industrial'),
  ('locker_room', 'Modelo padrão - Vestiário'),
  ('loading_area', 'Modelo padrão - Área de carga e descarga'),
  ('technical_room', 'Modelo padrão - Sala técnica'),
  ('server_room', 'Modelo padrão - Sala de servidores'),
  ('production_area', 'Modelo padrão - Área de produção');

create temporary table seed_items (
  environment_type text not null references seed_templates(environment_type),
  sort_order integer not null,
  item_name text not null,
  category text not null,
  is_required boolean not null default true,
  primary key (environment_type, item_name)
) on commit drop;

insert into seed_items (environment_type, sort_order, item_name, category) values
  -- Sala de estar
  ('living_room', 0, 'Verificar paredes e teto quanto a trincas, manchas e infiltrações', 'structure'),
  ('living_room', 1, 'Verificar piso, rejuntes e rodapés', 'finishing'),
  ('living_room', 2, 'Testar portas, fechaduras e maçanetas', 'equipment'),
  ('living_room', 3, 'Testar janelas, vidros e travas', 'equipment'),
  ('living_room', 4, 'Testar tomadas, interruptores e pontos de TV ou rede', 'installations'),
  ('living_room', 5, 'Testar iluminação e luminárias instaladas', 'installations'),
  ('living_room', 6, 'Avaliar limpeza e conservação geral', 'cleaning'),

  -- Sala de jantar
  ('dining_room', 0, 'Verificar paredes e teto quanto a danos e umidade', 'structure'),
  ('dining_room', 1, 'Verificar piso, rejuntes e rodapés', 'finishing'),
  ('dining_room', 2, 'Testar portas e integração com ambientes próximos', 'equipment'),
  ('dining_room', 3, 'Testar janelas, vidros e travas', 'equipment'),
  ('dining_room', 4, 'Testar tomadas e interruptores', 'installations'),
  ('dining_room', 5, 'Verificar iluminação principal e pontos auxiliares', 'installations'),
  ('dining_room', 6, 'Avaliar limpeza, mobiliário fixo e conservação geral', 'cleaning'),

  -- Cozinha
  ('kitchen', 0, 'Verificar pisos, azulejos e rejuntes', 'finishing'),
  ('kitchen', 1, 'Verificar bancada, cuba e vedação', 'equipment'),
  ('kitchen', 2, 'Testar torneira, sifão e escoamento da pia', 'installations'),
  ('kitchen', 3, 'Verificar armários, portas, gavetas e dobradiças', 'equipment'),
  ('kitchen', 4, 'Testar tomadas, iluminação e pontos para eletrodomésticos', 'installations'),
  ('kitchen', 5, 'Verificar ponto de gás e ausência de vazamentos aparentes', 'safety'),
  ('kitchen', 6, 'Avaliar ventilação, limpeza e sinais de pragas', 'cleaning'),

  -- Quarto
  ('bedroom', 0, 'Verificar paredes e teto quanto a trincas, manchas e umidade', 'structure'),
  ('bedroom', 1, 'Verificar piso, rejuntes e rodapés', 'finishing'),
  ('bedroom', 2, 'Testar porta, fechadura e maçaneta', 'equipment'),
  ('bedroom', 3, 'Testar janelas, vidros, persianas e travas', 'equipment'),
  ('bedroom', 4, 'Testar tomadas, interruptores e iluminação', 'installations'),
  ('bedroom', 5, 'Verificar armários embutidos, prateleiras e dobradiças', 'equipment'),
  ('bedroom', 6, 'Avaliar ventilação, limpeza e conservação geral', 'cleaning'),

  -- Banheiro
  ('bathroom', 0, 'Verificar pisos, revestimentos e rejuntes', 'finishing'),
  ('bathroom', 1, 'Testar ralos, caimento e escoamento da água', 'installations'),
  ('bathroom', 2, 'Testar vaso sanitário, descarga e fixação', 'equipment'),
  ('bathroom', 3, 'Testar lavatório, torneira, sifão e vedação', 'installations'),
  ('bathroom', 4, 'Testar chuveiro, registros e aquecimento disponível', 'installations'),
  ('bathroom', 5, 'Verificar porta, janela, box, espelho e acessórios', 'equipment'),
  ('bathroom', 6, 'Verificar vazamentos, mofo, ventilação e limpeza', 'cleaning'),

  -- Garagem ou estacionamento
  ('garage', 0, 'Verificar piso quanto a trincas, buracos e manchas', 'structure'),
  ('garage', 1, 'Testar portão, motor, controle e travas', 'equipment'),
  ('garage', 2, 'Verificar paredes e teto quanto a infiltrações', 'structure'),
  ('garage', 3, 'Testar iluminação, tomadas e sensores', 'installations'),
  ('garage', 4, 'Verificar ralos, canaletas e drenagem', 'installations'),
  ('garage', 5, 'Verificar demarcações, circulação e itens de segurança', 'safety'),
  ('garage', 6, 'Avaliar limpeza, obstáculos e conservação geral', 'cleaning'),

  -- Lavanderia
  ('laundry', 0, 'Verificar piso, revestimentos e rejuntes', 'finishing'),
  ('laundry', 1, 'Testar tanque, torneira, sifão e escoamento', 'installations'),
  ('laundry', 2, 'Testar ralos e caimento do piso', 'installations'),
  ('laundry', 3, 'Verificar ponto de água e saída para máquina de lavar', 'installations'),
  ('laundry', 4, 'Testar tomadas, interruptores e iluminação', 'installations'),
  ('laundry', 5, 'Verificar janelas, ventilação e varais instalados', 'equipment'),
  ('laundry', 6, 'Verificar vazamentos, umidade e limpeza geral', 'cleaning'),

  -- Escritório
  ('office', 0, 'Verificar paredes, divisórias e teto', 'structure'),
  ('office', 1, 'Verificar piso, rodapés e acabamento', 'finishing'),
  ('office', 2, 'Testar portas, fechaduras e controle de acesso', 'equipment'),
  ('office', 3, 'Testar janelas, vidros, persianas e travas', 'equipment'),
  ('office', 4, 'Testar tomadas elétricas, telefonia e pontos de rede', 'installations'),
  ('office', 5, 'Verificar iluminação, climatização e mobiliário fixo', 'equipment'),
  ('office', 6, 'Avaliar organização, limpeza e circulação', 'cleaning'),

  -- Varanda ou sacada
  ('balcony', 0, 'Verificar piso, rejuntes, caimento e ralos', 'finishing'),
  ('balcony', 1, 'Verificar guarda-corpo, corrimão e fixações', 'safety'),
  ('balcony', 2, 'Verificar impermeabilização e sinais de infiltração', 'structure'),
  ('balcony', 3, 'Testar portas, janelas, vidros e trilhos de acesso', 'equipment'),
  ('balcony', 4, 'Testar iluminação, tomadas e pontos hidráulicos', 'installations'),
  ('balcony', 5, 'Verificar paredes, teto e pintura', 'finishing'),
  ('balcony', 6, 'Avaliar limpeza e conservação geral', 'cleaning'),

  -- Corredor ou circulação
  ('hallway', 0, 'Verificar paredes e teto quanto a danos e infiltrações', 'structure'),
  ('hallway', 1, 'Verificar piso, rodapés e desníveis', 'finishing'),
  ('hallway', 2, 'Testar portas e acessos existentes', 'equipment'),
  ('hallway', 3, 'Testar iluminação e interruptores', 'installations'),
  ('hallway', 4, 'Verificar corrimãos, sinalização e rota de circulação', 'safety'),
  ('hallway', 5, 'Verificar obstáculos e condições de acessibilidade', 'safety'),
  ('hallway', 6, 'Avaliar limpeza e conservação geral', 'cleaning'),

  -- Copa ou despensa
  ('pantry', 0, 'Verificar paredes, teto e sinais de umidade', 'structure'),
  ('pantry', 1, 'Verificar piso, rodapés e revestimentos', 'finishing'),
  ('pantry', 2, 'Verificar prateleiras, armários e bancadas', 'equipment'),
  ('pantry', 3, 'Testar portas, fechaduras e dobradiças', 'equipment'),
  ('pantry', 4, 'Testar iluminação, tomadas e pontos hidráulicos existentes', 'installations'),
  ('pantry', 5, 'Verificar ventilação e sinais de pragas', 'safety'),
  ('pantry', 6, 'Avaliar organização, limpeza e conservação', 'cleaning'),

  -- Closet
  ('closet', 0, 'Verificar armários, prateleiras e cabideiros', 'equipment'),
  ('closet', 1, 'Testar portas, gavetas, trilhos e dobradiças', 'equipment'),
  ('closet', 2, 'Verificar paredes e teto quanto a umidade', 'structure'),
  ('closet', 3, 'Verificar piso, rodapés e acabamento', 'finishing'),
  ('closet', 4, 'Testar iluminação, tomadas e interruptores', 'installations'),
  ('closet', 5, 'Verificar ventilação e sinais de mofo', 'safety'),
  ('closet', 6, 'Avaliar limpeza e conservação geral', 'cleaning'),

  -- Piscina
  ('pool', 0, 'Verificar estrutura quanto a trincas e vazamentos aparentes', 'structure'),
  ('pool', 1, 'Verificar revestimento, rejuntes e bordas', 'finishing'),
  ('pool', 2, 'Verificar nível, transparência e condição da água', 'cleaning'),
  ('pool', 3, 'Testar bomba, filtro e dispositivos de retorno', 'equipment'),
  ('pool', 4, 'Verificar ralos, skimmers e sistema de drenagem', 'installations'),
  ('pool', 5, 'Verificar cercas, tampas, escadas e itens de segurança', 'safety'),
  ('pool', 6, 'Verificar deck, circulação e conservação do entorno', 'safety'),

  -- Área externa
  ('outdoor_area', 0, 'Verificar pisos, calçadas e áreas pavimentadas', 'finishing'),
  ('outdoor_area', 1, 'Verificar muros, cercas e elementos estruturais', 'structure'),
  ('outdoor_area', 2, 'Testar portões, fechaduras e acessos', 'equipment'),
  ('outdoor_area', 3, 'Verificar ralos, canaletas, calhas e drenagem', 'installations'),
  ('outdoor_area', 4, 'Testar iluminação e tomadas externas', 'installations'),
  ('outdoor_area', 5, 'Verificar vegetação, riscos e condições de circulação', 'safety'),
  ('outdoor_area', 6, 'Avaliar limpeza, resíduos e conservação geral', 'cleaning'),

  -- Outro ambiente
  ('other', 0, 'Verificar paredes, teto e elementos estruturais', 'structure'),
  ('other', 1, 'Verificar piso, rodapés e acabamentos', 'finishing'),
  ('other', 2, 'Testar portas, janelas e demais acessos', 'equipment'),
  ('other', 3, 'Testar iluminação, tomadas e interruptores', 'installations'),
  ('other', 4, 'Verificar instalações e equipamentos presentes', 'equipment'),
  ('other', 5, 'Verificar ventilação, umidade e riscos de segurança', 'safety'),
  ('other', 6, 'Avaliar limpeza e conservação geral', 'cleaning'),

  -- Recepção
  ('reception', 0, 'Verificar paredes, teto, piso e acabamentos', 'finishing'),
  ('reception', 1, 'Verificar balcão, mobiliário fixo e área de espera', 'equipment'),
  ('reception', 2, 'Testar porta principal, fechaduras e controle de acesso', 'equipment'),
  ('reception', 3, 'Verificar vitrines, vidros, esquadrias e travas', 'equipment'),
  ('reception', 4, 'Testar iluminação, tomadas, telefonia e pontos de rede', 'installations'),
  ('reception', 5, 'Verificar sinalização, circulação e acessibilidade', 'safety'),
  ('reception', 6, 'Avaliar organização, limpeza e conservação geral', 'cleaning'),

  -- Área de atendimento
  ('service_area', 0, 'Verificar piso, paredes, teto e divisórias', 'finishing'),
  ('service_area', 1, 'Verificar balcões, mesas e mobiliário fixo', 'equipment'),
  ('service_area', 2, 'Testar tomadas elétricas, telefonia e pontos de rede', 'installations'),
  ('service_area', 3, 'Verificar iluminação e climatização', 'equipment'),
  ('service_area', 4, 'Testar portas, acessos e fechaduras', 'equipment'),
  ('service_area', 5, 'Verificar circulação, privacidade e acessibilidade', 'safety'),
  ('service_area', 6, 'Avaliar organização, limpeza e conservação', 'cleaning'),

  -- Área de vendas
  ('sales_area', 0, 'Verificar piso, paredes, teto e acabamento', 'finishing'),
  ('sales_area', 1, 'Verificar vitrines, vidros, esquadrias e travas', 'equipment'),
  ('sales_area', 2, 'Verificar prateleiras, expositores e mobiliário fixo', 'equipment'),
  ('sales_area', 3, 'Testar iluminação geral e iluminação de destaque', 'installations'),
  ('sales_area', 4, 'Testar tomadas, pontos de rede e equipamentos instalados', 'installations'),
  ('sales_area', 5, 'Verificar saídas, circulação, sinalização e acessibilidade', 'safety'),
  ('sales_area', 6, 'Avaliar organização, limpeza e conservação geral', 'cleaning'),

  -- Sala de reunião
  ('meeting_room', 0, 'Verificar paredes, divisórias, teto e piso', 'finishing'),
  ('meeting_room', 1, 'Verificar mesa, cadeiras e mobiliário fixo', 'equipment'),
  ('meeting_room', 2, 'Testar portas, fechaduras e isolamento aparente', 'equipment'),
  ('meeting_room', 3, 'Testar janelas, persianas e travas', 'equipment'),
  ('meeting_room', 4, 'Testar tomadas, pontos de rede e telefonia', 'installations'),
  ('meeting_room', 5, 'Testar iluminação, climatização e recursos audiovisuais', 'equipment'),
  ('meeting_room', 6, 'Avaliar ventilação, limpeza e organização', 'cleaning'),

  -- Estoque ou depósito
  ('warehouse', 0, 'Verificar piso quanto a trincas, desníveis e capacidade aparente', 'structure'),
  ('warehouse', 1, 'Verificar paredes, cobertura e sinais de infiltração', 'structure'),
  ('warehouse', 2, 'Testar portas, portões, fechaduras e acessos', 'equipment'),
  ('warehouse', 3, 'Verificar estantes, prateleiras e fixações', 'equipment'),
  ('warehouse', 4, 'Testar iluminação, tomadas e instalações elétricas aparentes', 'installations'),
  ('warehouse', 5, 'Verificar ventilação, umidade e sinais de pragas', 'safety'),
  ('warehouse', 6, 'Verificar sinalização, extintores, circulação e limpeza', 'safety'),

  -- Cozinha industrial
  ('commercial_kitchen', 0, 'Verificar piso antiderrapante, rejuntes, ralos e drenagem', 'finishing'),
  ('commercial_kitchen', 1, 'Verificar paredes, revestimentos laváveis e teto', 'finishing'),
  ('commercial_kitchen', 2, 'Verificar bancadas, cubas, torneiras e escoamento', 'installations'),
  ('commercial_kitchen', 3, 'Verificar instalações de água e gás quanto a vazamentos', 'safety'),
  ('commercial_kitchen', 4, 'Testar tomadas, quadros e equipamentos elétricos instalados', 'installations'),
  ('commercial_kitchen', 5, 'Testar coifa, exaustão e ventilação', 'equipment'),
  ('commercial_kitchen', 6, 'Verificar higiene, controle de pragas e prevenção de incêndio', 'safety'),

  -- Vestiário
  ('locker_room', 0, 'Verificar piso, revestimentos, rejuntes e ralos', 'finishing'),
  ('locker_room', 1, 'Verificar paredes, teto, umidade e ventilação', 'structure'),
  ('locker_room', 2, 'Verificar armários, bancos, portas e fechaduras', 'equipment'),
  ('locker_room', 3, 'Testar chuveiros, torneiras, registros e escoamento', 'installations'),
  ('locker_room', 4, 'Testar iluminação, tomadas e interruptores protegidos', 'installations'),
  ('locker_room', 5, 'Verificar circulação, privacidade e acessibilidade', 'safety'),
  ('locker_room', 6, 'Avaliar limpeza, odores e conservação geral', 'cleaning'),

  -- Área de carga e descarga
  ('loading_area', 0, 'Verificar piso, doca e plataforma quanto a danos', 'structure'),
  ('loading_area', 1, 'Testar portões, portas e sistemas de acesso', 'equipment'),
  ('loading_area', 2, 'Verificar iluminação interna e externa', 'installations'),
  ('loading_area', 3, 'Verificar drenagem, canaletas e ausência de acúmulo de água', 'installations'),
  ('loading_area', 4, 'Verificar sinalização, demarcações e defensas', 'safety'),
  ('loading_area', 5, 'Verificar circulação, obstáculos e proteção contra quedas', 'safety'),
  ('loading_area', 6, 'Avaliar limpeza, resíduos e conservação geral', 'cleaning'),

  -- Sala técnica
  ('technical_room', 0, 'Verificar piso, paredes, teto e sinais de infiltração', 'structure'),
  ('technical_room', 1, 'Testar porta, fechadura, controle de acesso e sinalização', 'safety'),
  ('technical_room', 2, 'Verificar painéis, tubulações e equipamentos aparentes', 'equipment'),
  ('technical_room', 3, 'Testar iluminação normal e iluminação de emergência', 'installations'),
  ('technical_room', 4, 'Verificar ventilação, temperatura e espaço de manutenção', 'safety'),
  ('technical_room', 5, 'Verificar vazamentos, corrosão e ruídos anormais', 'equipment'),
  ('technical_room', 6, 'Verificar extintor, desobstrução e limpeza', 'safety'),

  -- Sala de servidores
  ('server_room', 0, 'Testar porta, fechadura e controle de acesso', 'safety'),
  ('server_room', 1, 'Verificar piso, forro, vedação e ausência de infiltração', 'structure'),
  ('server_room', 2, 'Verificar racks, organização e identificação do cabeamento', 'equipment'),
  ('server_room', 3, 'Testar alimentação elétrica, aterramento e nobreaks', 'installations'),
  ('server_room', 4, 'Testar climatização e monitoramento de temperatura', 'equipment'),
  ('server_room', 5, 'Verificar detecção, alarme e combate a incêndio', 'safety'),
  ('server_room', 6, 'Verificar umidade, poeira, circulação e limpeza', 'cleaning'),

  -- Área de produção
  ('production_area', 0, 'Verificar piso quanto a danos, desníveis e aderência', 'structure'),
  ('production_area', 1, 'Verificar paredes, teto, cobertura e infiltrações', 'structure'),
  ('production_area', 2, 'Verificar máquinas, proteções e fixações aparentes', 'equipment'),
  ('production_area', 3, 'Testar instalações elétricas e dispositivos de parada de emergência', 'safety'),
  ('production_area', 4, 'Verificar exaustão, ventilação e condições térmicas', 'installations'),
  ('production_area', 5, 'Verificar circulação, sinalização e rotas de emergência', 'safety'),
  ('production_area', 6, 'Avaliar limpeza, resíduos e prevenção de incêndio', 'cleaning');

-- Se modelo padrão já existir inativo e não houver outro ativo, reativa.
update public.inspection_checklist_templates template
set is_active = true,
    updated_at = now()
from seed_templates seed
cross join seed_context context
where template.organization_id = context.organization_id
  and template.environment_type = seed.environment_type
  and lower(trim(template.name)) = lower(trim(seed.template_name))
  and template.is_active = false
  and not exists (
    select 1
    from public.inspection_checklist_templates active_template
    where active_template.organization_id = context.organization_id
      and active_template.environment_type = seed.environment_type
      and active_template.is_active = true
  );

-- Cria somente tipos que ainda não possuem modelo ativo.
insert into public.inspection_checklist_templates (
  organization_id, name, environment_type, is_active, created_by
)
select
  context.organization_id,
  seed.template_name,
  seed.environment_type,
  true,
  context.user_id
from seed_templates seed
cross join seed_context context
where not exists (
  select 1
  from public.inspection_checklist_templates template
  where template.organization_id = context.organization_id
    and template.environment_type = seed.environment_type
    and template.is_active = true
)
on conflict do nothing;

-- Completa modelo ativo de cada tipo sem apagar personalizações e sem duplicar nomes.
insert into public.inspection_checklist_template_items (
  organization_id, template_id, item_name, category, is_required, sort_order
)
select
  context.organization_id,
  template.id,
  seed.item_name,
  seed.category,
  seed.is_required,
  seed.sort_order
from seed_items seed
cross join seed_context context
join public.inspection_checklist_templates template
  on template.organization_id = context.organization_id
 and template.environment_type = seed.environment_type
 and template.is_active = true
where not exists (
  select 1
  from public.inspection_checklist_template_items existing_item
  where existing_item.template_id = template.id
    and lower(trim(existing_item.item_name)) = lower(trim(seed.item_name))
);

commit;

-- Resultado esperado: 26 modelos ativos, cada novo modelo com 7 itens.
select
  template.environment_type,
  template.name,
  count(item.id) as total_itens
from public.inspection_checklist_templates template
left join public.inspection_checklist_template_items item
  on item.template_id = template.id
where template.organization_id = (
  select organization_id
  from public.profiles
  where id = '98ed30c7-60cc-449e-ae1a-45e56f9b00ca'::uuid
)
  and template.is_active = true
group by template.id, template.environment_type, template.name
order by template.name;
