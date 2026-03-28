-- DELETE für Restaurant-Inhaber (Bulk-Löschen Karte / Import „Ersetzen“)
DROP POLICY IF EXISTS "Owner can delete menu_items" ON menu_items;

CREATE POLICY "Owner can delete menu_items"
ON menu_items FOR DELETE
USING (
  restaurant_id IN (
    SELECT id FROM restaurants WHERE auth_user_id = auth.uid()
  )
);
