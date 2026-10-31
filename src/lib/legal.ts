import { AFFILIATE_MAX, HOLD_DAYS, REF_WINDOW_DAYS } from "@/lib/plaza";

export const SUPPORT_EMAIL = "soporte@plazax.com.co";

/** Plazo (días calendario desde la entrega) para abrir una disputa por el carrito. */
export const DISPUTE_WINDOW_DAYS = HOLD_DAYS;

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: { title?: string; text: string }[] }
  | {
      kind: "box";
      tone: "indigo" | "amber";
      icon: string;
      title: string;
      intro?: string;
      items: { title?: string; text: string }[];
    };

export type LegalSection = {
  id: string;
  title: string;
  /** Texto del enlace en el pie de página (si aparece allí). */
  footer?: string;
  blocks: LegalBlock[];
};

export const LEGAL_NOTICE =
  "Al usar Plaza X como Comprador, Empresa o Afiliado aceptas estos Términos y Condiciones, las Reglas de Publicación y las Políticas de Protección al Consumidor conforme a la legislación colombiana vigente.";

export const LEGAL_SECTIONS: LegalSection[] = [
  {
    id: "general",
    title: "Naturaleza del servicio",
    blocks: [
      {
        kind: "p",
        text: "Plaza X es una plataforma tecnológica de comercio electrónico y anuncios. Actuamos como canal digital de intermediación que permite a empresas y comerciantes publicar productos y conectar con compradores y afiliados. Plaza X no es propietaria de los artículos ofrecidos por vendedores terceros.",
      },
    ],
  },
  {
    id: "reglas-publicacion",
    title: "Reglas de publicación de productos y anuncios",
    footer: "Reglas de Publicación",
    blocks: [
      {
        kind: "p",
        text: "Toda empresa vendedora se compromete a respetar estas reglas. Su incumplimiento permite retirar la publicación y suspender la cuenta.",
      },
      {
        kind: "list",
        items: [
          {
            title: "Productos prohibidos",
            text: "Réplicas no autorizadas, sustancias prohibidas, medicamentos bajo fórmula, armas, especies protegidas o productos de procedencia ilícita.",
          },
          {
            title: "Fotos y precios veraces",
            text: 'Las imágenes deben corresponder al estado real del artículo. Están prohibidos los precios falsos o "simbólicos" para manipular los filtros.',
          },
          {
            title: "Sin spam ni duplicados",
            text: "No se permite publicar el mismo producto varias veces ni crear anuncios repetidos con cuentas diferentes.",
          },
          {
            title: "Derechos de autor y marcas",
            text: "Quien publica declara ser propietario o tener autorización de uso de logos, fotos y descripciones.",
          },
        ],
      },
    ],
  },
  {
    id: "proteccion-comprador",
    title: "Protección al comprador, productos diferentes y reclamaciones",
    footer: "Protección al Comprador y Disputas",
    blocks: [
      {
        kind: "p",
        text: "Lo que Plaza X puede hacer ante un producto diferente, defectuoso o un presunto fraude depende de cómo se pagó:",
      },
      {
        kind: "box",
        tone: "indigo",
        icon: "fa-shield-halved",
        title: "A. Compras pagadas en el carrito de Plaza X (protección directa)",
        items: [
          {
            title: "Custodia",
            text: `El dinero no se libera de inmediato al vendedor ni al afiliado: queda retenido hasta la entrega y ${HOLD_DAYS} días más.`,
          },
          {
            title: "Disputa",
            text: `Si recibes un producto diferente, averiado o no lo recibes, usa el botón "Abrir disputa / Reportar problema" en tu pedido, dentro de los ${DISPUTE_WINDOW_DAYS} días siguientes a la entrega. El pago al vendedor se congela de inmediato.`,
          },
          {
            title: "Investigación y reembolso",
            text: "Te pediremos evidencias (fotos, video del desempaque, guía de la transportadora). Si se confirma la inconsistencia, se hace el reembolso total y se sanciona o veta definitivamente la cuenta del vendedor.",
          },
        ],
      },
      {
        kind: "box",
        tone: "amber",
        icon: "fa-triangle-exclamation",
        title: "B. Transacciones por fuera de la plataforma",
        intro:
          "Cuando la compra se acuerda por fuera de Plaza X (mensajería externa, transferencias directas o efectivo contraentrega independiente):",
        items: [
          { text: "Plaza X no custodia esos fondos y no puede hacer reversiones." },
          {
            title: "Bloqueo",
            text: "Con la denuncia y las capturas de evidencia, suspendemos de forma permanente la cuenta fraudulenta.",
          },
          {
            title: "Cooperación con autoridades",
            text: "Conservamos registros de IP, de registro y de actividad en la plataforma. Ante una denuncia penal formal, los entregamos a la Fiscalía General de la Nación o a la autoridad judicial competente que los solicite.",
          },
        ],
      },
    ],
  },
  {
    id: "seguridad-fraude",
    title: "Seguridad y prevención de fraudes",
    footer: "Consejos de Seguridad y Fraude",
    blocks: [
      {
        kind: "list",
        items: [
          {
            text: "Paga siempre por el carrito de Plaza X: es la única forma de tener custodia y reembolso.",
          },
          {
            text: "En entregas locales, acuerda encuentros en lugares públicos y concurridos.",
          },
          {
            text: "Desconfía de precios muy por debajo del mercado o de quien te pida pagar por fuera antes de ver el producto.",
          },
          {
            text: "Plaza X nunca te pedirá contraseñas ni códigos por WhatsApp o correo.",
          },
        ],
      },
    ],
  },
  {
    id: "retracto",
    title: "Derecho de retracto (art. 47, Ley 1480 de 2011)",
    footer: "Derecho de Retracto (Ley 1480)",
    blocks: [
      {
        kind: "p",
        text: "En compras hechas por el carrito de Plaza X puedes retractarte dentro de los cinco (5) días hábiles siguientes a la entrega. El producto se devuelve sin uso y en su empaque original; el costo del envío de retorno lo asume el consumidor. El reembolso se hace dentro de los treinta (30) días calendario siguientes. No aplica a productos perecederos, de uso personal, personalizados o bienes digitales ya descargados.",
      },
    ],
  },
  {
    id: "reversion",
    title: "Reversión del pago (Decreto 587 de 2016)",
    footer: "Reversión del Pago",
    blocks: [
      {
        kind: "p",
        text: "Aplica cuando hubo fraude, una operación no solicitada, el producto no se entregó o no corresponde a lo pedido o es defectuoso. Debes presentar la queja al vendedor (a través de Plaza X) y avisar a la entidad emisora de tu medio de pago dentro de los cinco (5) días hábiles siguientes a conocer el hecho, y devolver el producto si lo recibiste.",
      },
    ],
  },
  {
    id: "habeas",
    title: "Protección de datos personales (Ley 1581 de 2012)",
    footer: "Protección de Datos (Ley 1581)",
    blocks: [
      {
        kind: "p",
        text: `Tus datos se usan solo para procesar pedidos, poner en contacto a las partes de una compra, gestionar comisiones de afiliados, atender disputas y enviar notificaciones operativas. Puedes conocer, actualizar, rectificar o pedir la supresión de tus datos escribiendo a ${SUPPORT_EMAIL}. Los avisos públicos de compras recientes nunca muestran nombres: solo el producto y la ciudad.`,
      },
    ],
  },
  {
    id: "afiliados-legal",
    title: "Reglamento del programa de afiliados",
    footer: "Términos del Programa de Afiliados",
    blocks: [
      {
        kind: "p",
        text: `Los afiliados son promotores independientes. La comisión (hasta ${Math.round(AFFILIATE_MAX * 100)}% según el producto) se gana sobre compras pagadas por su enlace dentro de los ${REF_WINDOW_DAYS} días siguientes al clic, y se libera ${HOLD_DAYS} días después de la entrega si no hubo retracto ni disputa. Los pagos están sujetos a los impuestos y retenciones que determine la DIAN. Está prohibido el spam, la publicidad engañosa y comprar por el propio enlace.`,
      },
    ],
  },
];
