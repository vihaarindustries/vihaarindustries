-- 009: home-page sections. The public can only read VISIBLE rows (row-level security), so every section needs a row:
-- a section that is switched off simply stops being returned and disappears from the website.
insert into public.site_sections(section_key, title, content, is_visible, sort_order) values
  ('products',     'Ingredients with purpose.',               '{"eyebrow":"THE PRODUCT RANGE","intro":"Explore core ingredients or speak with us about specifications, pack sizes and bulk requirements."}', true, 0),
  ('capabilities', 'One ingredient partner. Two ways to work.','{"eyebrow":"MADE FOR HOW YOU BUY"}', true, 1),
  ('quality',      'Proof belongs in the open.',              '{"eyebrow":"QUALITY & TRUST","intro":"Verified licences, certifications, achievements and customer feedback."}', true, 2),
  ('cta',          'Have a specification in mind?',           '{"eyebrow":"LET''S TALK INGREDIENTS","intro":"Tell us your product, volume and destination."}', true, 3)
on conflict (section_key) do nothing;
