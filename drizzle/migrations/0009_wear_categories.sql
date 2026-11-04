-- Categorías para el vestidor virtual: calzado y accesorios de vestir.
alter table public.products drop constraint if exists products_category_check;
--> statement-breakpoint
alter table public.products add constraint products_category_check check (
  category in ('Ropa', 'Calzado', 'Accesorios', 'Alimentos', 'Artesanías', 'Campo', 'Hogar', 'Belleza', 'Tecnología', 'Otros')
);
