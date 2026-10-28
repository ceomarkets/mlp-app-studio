# Plaza X · MLP App Studio

Marketplace multitienda con red de afiliados, hecho en Pasto, Nariño.

- **Compradores**: catálogo con búsqueda, filtros y orden, página de producto con galería y reseñas, carrito persistente y pago con **Wompi** (tarjeta, PSE, Nequi, botón Bancolombia).
- **Vendedores**: crear tienda, subir productos con fotos, stock y comisión para afiliados (con vista previa del reparto), gestionar pedidos (preparando → enviado → entregado con guía), métricas de 30 días y billetera.
- **Afiliados**: usuario propio, vitrina ordenada por comisión, enlaces con rastreo de 30 días, WhatsApp / compartir / **código QR**, clics, conversión, ganancia por clic y retiros a Nequi, Daviplata o Bancolombia.

Stack: TanStack Start + React 19 + Tailwind + shadcn/ui (plantilla de Lovable), Supabase (Postgres, Auth, Storage, Edge Functions), Wompi.

## Modelo de negocio

| Concepto | Valor |
| --- | --- |
| Comisión de la plataforma | 9 % de cada venta |
| Comisión de afiliado | 3 % a 20 %, la fija el vendedor por producto |
| Sin afiliado | el vendedor recibe también la parte del afiliado |
| Atribución | 30 días desde el clic en el enlace |
| Retención | las ganancias se liberan 7 días después de la entrega |
| Retiro mínimo | $50.000 COP |

Los repartos se calculan **en la base de datos** al crear el pedido: el navegador nunca define precios ni comisiones.

## Desarrollo local (modo demo)

```sh
bun install      # o npm install
bun run dev
```

Sin variables de Supabase la app funciona en **modo demo**: guarda todo en el navegador y simula la pasarela. Cuenta de prueba: `demo@plazax.co` / `demo1234` (vendedora de Tejidos Galeras y afiliada `@laura`, con historial de ventas). Otra cuenta: `comprador@plazax.co` / `demo1234`.

```sh
bun run test     # 19 pruebas: repartos, billetera, firmas de Wompi, flujo completo
bun run build
```

## Puesta en producción

### 1. Base de datos (Lovable Cloud o Supabase)

1. En Lovable activa **Cloud** (o crea un proyecto en supabase.com y pon `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local`).
2. Ejecuta `supabase/migrations/20261028150000_plaza_x_core.sql` (Lovable lo aplica al sincronizar; con la CLI: `supabase db push`). Crea las tablas, la seguridad por filas (RLS), las funciones de pedidos y retiros y el bucket de imágenes.
3. En Auth → URL Configuration agrega tu dominio como *Site URL* y `https://tu-dominio/cuenta` como *Redirect URL*.

### 2. Wompi

1. Crea tu cuenta de comercio en [comercios.wompi.co](https://comercios.wompi.co). En **Desarrolladores** copia la llave pública, el secreto de integridad y el secreto de eventos (primero los de *sandbox*).
2. Guárdalos como secretos de Supabase: `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`.
3. Despliega las funciones: `supabase functions deploy wompi-checkout` y `supabase functions deploy wompi-webhook` (el webhook va sin JWT; ver `supabase/config.toml`).
4. En Wompi → Desarrolladores → **URL de eventos**: `https://<proyecto>.supabase.co/functions/v1/wompi-webhook`.

Flujo de pago: `create_order()` crea el pedido pendiente con precios reales → `wompi-checkout` firma (SHA-256) y devuelve la URL del checkout → Wompi cobra → `wompi-webhook` verifica el checksum del evento y llama a `mark_order_paid()`, que valida el monto, descuenta stock y libera el pedido a las tiendas.

### 3. Operación

- **Retiros**: se registran como `requested`. Págalos y márcalos `paid` en la tabla `withdrawals` (o `rejected`, que devuelve el saldo).
- **Cancelaciones**: si una tienda cancela un ítem, el reembolso al comprador se hace desde el panel de Wompi.

## Estructura

```
src/lib/plaza.ts               reglas del negocio (repartos, billetera, series)
src/lib/backend/               capa de datos: supabase.ts (real) y demo.ts (local)
src/lib/client-state.ts        carrito y referido (localStorage)
src/routes/                    páginas: /, /producto/$id, /tienda/$slug, /carrito,
                               /pedido/$id, /entrar, /cuenta, /vendedores, /afiliados,
                               /r/$usuario/$producto (enlace de afiliado)
src/components/panels/         billetera, gráficas, formularios del vendedor
supabase/migrations/           esquema, RLS y funciones SQL
supabase/functions/            wompi-checkout, wompi-webhook y utilidades compartidas
```

Este proyecto está conectado a [Lovable](https://lovable.dev/projects/b6494d02-ee85-4cd3-a78a-45cf170bf533): los cambios en `main` se sincronizan con el editor.
<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
