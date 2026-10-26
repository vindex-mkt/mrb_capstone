import type { StaticPageSection } from "@/components/StaticPage";

export type StaticPageContent = {
	title: string;
	description: string;
	sections: StaticPageSection[];
	isDraft?: boolean;
};

export const helpPage: StaticPageContent = {
	title: "Centro de ayuda",
	description:
		"Encuentra orientación para comprar, vender y seguir tus pedidos en Vindex.",
	sections: [
		{
			title: "Compra con confianza",
			paragraphs: [
				"Revisa la descripción, el estado y las condiciones de entrega de cada publicación antes de comprar. Si necesitas aclarar un detalle, usa las opciones de conversación disponibles en la plataforma.",
				"En las compras protegidas, el pago queda en custodia hasta que confirmes la recepción del producto. La entrega puede incluir una validación física mediante OTP.",
			],
		},
		{
			title: "Seguimiento de pedidos",
			paragraphs: [
				"Cuando el pedido considera despacho, consulta su avance y la información de seguimiento desde tu perfil. El estado disponible puede variar según la etapa de preparación y transporte.",
			],
		},
		{
			title: "Si algo no resulta como esperabas",
			paragraphs: [
				"Conserva los antecedentes de la compra y revisa la información de devoluciones y entregas de Vindex. Las condiciones concretas de cada operación deben quedar visibles antes de confirmar el pago.",
			],
		},
	],
};

export const shippingPage: StaticPageContent = {
	title: "Envíos y entregas",
	description:
		"Vindex busca facilitar envíos a todo Chile con información de seguimiento y una recepción segura.",
	sections: [
		{
			title: "Despacho del pedido",
			paragraphs: [
				"Las alternativas de entrega dependen del producto y de las condiciones informadas por quien lo vende. Antes de pagar, revisa si está disponible el envío o si corresponde coordinar otra modalidad.",
				"Cuando el pedido se despacha, el seguimiento se muestra en la información de la compra a medida que se registran actualizaciones del transporte.",
			],
		},
		{
			title: "Recepción con validación OTP",
			paragraphs: [
				"Al recibir el producto, revisa que corresponda a tu compra. La validación física mediante OTP se realiza como parte de la confirmación de entrega; no compartas el código antes de tener el producto en tus manos.",
			],
		},
		{
			title: "Problemas con la entrega",
			paragraphs: [
				"Si el seguimiento no avanza o el pedido llega con un problema, conserva la información de la compra y utiliza las opciones de ayuda disponibles en la plataforma antes de confirmar la recepción.",
			],
		},
	],
};

export const returnsPage: StaticPageContent = {
	title: "Devoluciones",
	description:
		"Una guía simple para actuar si necesitas devolver un producto o informar un problema.",
	sections: [
		{
			title: "Revisa las condiciones de la compra",
			paragraphs: [
				"Las condiciones de devolución pueden depender del producto, de su estado y de la información publicada por quien lo vende. Revísalas antes de pagar y guarda los antecedentes de tu pedido.",
			],
		},
		{
			title: "Si recibiste un producto distinto o dañado",
			paragraphs: [
				"Registra el problema y conserva el embalaje y los comprobantes disponibles. Informa la situación mediante las opciones de ayuda de Vindex antes de confirmar la entrega cuando corresponda.",
			],
		},
		{
			title: "Revisión del caso",
			paragraphs: [
				"Vindex debe revisar los antecedentes de cada caso y comunicar los pasos aplicables. Esta página no establece plazos ni garantiza un resultado específico; las condiciones definitivas deben ser revisadas por el equipo del proyecto.",
			],
		},
	],
};

export const paymentMethodsPage: StaticPageContent = {
	title: "Métodos de pago",
	description:
		"Conoce las alternativas de pago consideradas para completar una compra en Vindex.",
	sections: [
		{
			title: "Webpay Plus",
			paragraphs: [
				"Webpay Plus es una solución de pago en línea de Transbank que permite pagar con los medios habilitados por el servicio, como tarjetas de crédito, débito o prepago, según disponibilidad.",
			],
		},
		{
			title: "Mercado Pago",
			paragraphs: [
				"Mercado Pago permite pagar a través de su plataforma con los medios que tenga disponibles para cada usuario y operación. Las alternativas concretas se muestran durante el proceso de pago.",
			],
		},
		{
			title: "Compra protegida",
			paragraphs: [
				"Vindex contempla la custodia del pago hasta que se confirme la entrega. La disponibilidad de cada medio de pago debe verificarse en el checkout; no ingreses datos de pago fuera del flujo presentado por la plataforma.",
			],
		},
	],
};

export const termsPage: StaticPageContent = {
	title: "Términos y condiciones",
	description:
		"Reglas generales para el uso de Vindex, sus publicaciones, compras y subastas.",
	isDraft: true,
	sections: [
		{
			title: "Uso de la plataforma",
			paragraphs: [
				"Vindex es un proyecto de marketplace que conecta a compradores y vendedores. Quienes usan la plataforma deben entregar información correcta, respetar a otras personas y utilizar las funciones de acuerdo con su finalidad.",
			],
		},
		{
			title: "Publicaciones y operaciones",
			paragraphs: [
				"Las personas vendedoras son responsables de describir con claridad sus productos, su estado y las condiciones de entrega. Antes de confirmar una compra o una puja, revisa cuidadosamente la información de la publicación.",
				"En las operaciones con compra protegida, el pago se mantiene en custodia hasta que se confirme la entrega. La validación física con OTP se utiliza al recibir el producto. Los detalles operativos y las excepciones deben ser definidos por el equipo antes de publicar estos términos como definitivos.",
			],
		},
		{
			title: "Disponibilidad y revisión",
			paragraphs: [
				"Las funciones pueden cambiar durante el desarrollo del proyecto. Este borrador no reemplaza una revisión legal ni constituye una declaración de condiciones definitivas.",
			],
		},
	],
};

export const privacyPage: StaticPageContent = {
	title: "Privacidad",
	description:
		"Información general sobre el tratamiento de datos en Vindex, pendiente de revisión por el equipo.",
	isDraft: true,
	sections: [
		{
			title: "Datos y finalidad",
			paragraphs: [
				"Para operar una cuenta y gestionar compras o ventas, una plataforma como Vindex puede tratar datos de cuenta, información de publicaciones y antecedentes necesarios para gestionar una operación. El equipo debe confirmar qué datos recopila efectivamente el proyecto y por cuánto tiempo los conserva.",
			],
		},
		{
			title: "Uso y protección",
			paragraphs: [
				"La información debe utilizarse solo para fines relacionados con el funcionamiento de la plataforma, la atención de operaciones y la seguridad de las cuentas. No ingreses datos sensibles que no sean necesarios para usar el servicio.",
			],
		},
		{
			title: "Cookies",
			id: "cookies",
			paragraphs: [
				"Vindex puede utilizar cookies o almacenamiento del navegador para mantener sesiones y recordar preferencias necesarias para el sitio. El equipo debe documentar las tecnologías efectivamente usadas, su duración y cualquier herramienta de medición antes de publicar una política definitiva.",
			],
		},
		{
			title: "Revisión de esta política",
			paragraphs: [
				"Este texto es un borrador académico. Antes de su publicación definitiva, el equipo debe verificar las prácticas reales de datos, los mecanismos para ejercer derechos y los canales de contacto aplicables.",
			],
		},
	],
};

export const otpPage: StaticPageContent = {
	title: "Política de OTP",
	description:
		"El código OTP permite asociar la confirmación de entrega con la recepción física del producto.",
	sections: [
		{
			title: "Cuándo usar el código",
			paragraphs: [
				"La validación con OTP se realiza al recibir físicamente el producto. Comprueba que la entrega corresponda a tu pedido antes de completar la validación.",
			],
		},
		{
			title: "Mantén el código bajo tu control",
			bullets: [
				"No compartas el OTP antes de tener el producto en tus manos.",
				"Ingresa el código únicamente en el flujo de validación de Vindex.",
				"Si no recibiste el producto o detectas un problema, no confirmes la entrega y revisa las opciones de ayuda disponibles.",
			],
			paragraphs: [
				"Confirmar la entrega puede habilitar el cierre de la operación y la liberación del pago en custodia, de acuerdo con el flujo definido por Vindex.",
			],
		},
		{
			title: "Si el código presenta problemas",
			paragraphs: [
				"Si el OTP no funciona o no puedes completar la validación, conserva los datos del pedido y utiliza las opciones de ayuda disponibles en la plataforma.",
			],
		},
	],
};

export const careersPage: StaticPageContent = {
	title: "Trabaja con nosotros",
	description:
		"Vindex está creciendo como proyecto y busca construir una experiencia de marketplace útil y confiable.",
	sections: [
		{
			title: "Oportunidades",
			paragraphs: [
				"Por ahora no hay vacantes publicadas en esta página. Si el equipo abre oportunidades, informará aquí los perfiles buscados y cómo participar.",
			],
		},
		{
			title: "Un proyecto en desarrollo",
			paragraphs: [
				"Vindex es un proyecto universitario. No se recibirán postulaciones por canales no publicados ni se solicitarán pagos para postular.",
			],
		},
	],
};
