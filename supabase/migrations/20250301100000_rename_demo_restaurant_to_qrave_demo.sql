-- Demo-Restaurant umbenennen: Chinaski → Qrave Demo, Slug chinaski → qrave-demo
-- menu_items: restaurant_id bleibt unverändert (gehört weiterhin zum gleichen Restaurant)

UPDATE restaurants
SET name = 'Qrave Demo',
    slug = 'qrave-demo'
WHERE slug = 'chinaski';
