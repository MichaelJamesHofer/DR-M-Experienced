update public.affiliate_products
set
  name = case
    when name = 'Dr. M''s Experienced Supplement Dispensary'
      then 'Dr. M Experienced Supplement Dispensary'
    else name
  end,
  summary = case
    when summary = 'A DSS supplement dispensary for the Dr. M''s Experienced audience, with thousands of high-quality practitioner-focused supplement products.'
      then 'A DSS supplement dispensary for the Dr. M Experienced audience, with thousands of high-quality practitioner-focused supplement products.'
    else summary
  end,
  purchase_note = case
    when purchase_note = 'This is the Dr. M''s Experienced dispensary URL.'
      then 'This is the Dr. M Experienced dispensary URL.'
    else purchase_note
  end,
  updated_at = now()
where slug = 'doctors-supplement-store'
  and (
    name = 'Dr. M''s Experienced Supplement Dispensary'
    or summary = 'A DSS supplement dispensary for the Dr. M''s Experienced audience, with thousands of high-quality practitioner-focused supplement products.'
    or purchase_note = 'This is the Dr. M''s Experienced dispensary URL.'
  );

update public.affiliate_product_reasons
set body = 'Includes a public listener code for the Dr. M Experienced audience.'
where product_slug = 'best365labs'
  and display_order = 30
  and body = 'Includes a public listener code for the Dr. M''s Experienced audience.';

update public.affiliate_product_reasons
set body = 'Separate Dr. M Experienced dispensary URL keeps podcast-related supplement activity organized.'
where product_slug = 'doctors-supplement-store'
  and display_order = 20
  and body = 'Separate Dr. M''s Experienced dispensary URL keeps podcast-related supplement activity organized.';

do $$
begin
  if exists (
    select 1
    from public.affiliate_products
    where name like '%Dr. M''s Experienced%'
       or summary like '%Dr. M''s Experienced%'
       or drm_thoughts like '%Dr. M''s Experienced%'
       or coalesce(purchase_note, '') like '%Dr. M''s Experienced%'
       or coalesce(caution_note, '') like '%Dr. M''s Experienced%'
  ) or exists (
    select 1
    from public.affiliate_product_reasons
    where body like '%Dr. M''s Experienced%'
  ) then
    raise exception 'Legacy Dr. M brand text remains in the affiliate catalog';
  end if;
end
$$;
