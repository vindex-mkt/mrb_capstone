import type { StaticPageSection } from "@/components/StaticPage";

export type StaticPageContent = {
	title: string;
	description: string;
	sections: StaticPageSection[];
	isDraft?: boolean;
	updatedAt?: string;
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
		"Condiciones de uso de Vindex para personas usuarias, compradores y vendedores en Chile. Versión 2026-11-15.",
	isDraft: true,
	updatedAt: "15 de noviembre de 2026",
	sections: [
		{
			title: "1. Aceptación y alcance",
			paragraphs: [
				"Estos términos regulan el acceso y uso de Vindex, incluyendo sus funciones de marketplace, tiendas, compras, publicaciones, subastas, pagos y coordinación de entregas. Al crear una cuenta o utilizar estas funciones, declaras que leíste y aceptas estos términos y la política de privacidad publicada en el sitio. Si no estás de acuerdo, no debes crear una cuenta ni utilizar la plataforma.",
				"Vindex está dirigido a personas con capacidad legal para contratar. Si actúas en nombre de una empresa, declaras tener facultades para obligarla. El uso de Vindex debe cumplir la legislación vigente en Chile, incluyendo las normas de protección de los derechos de consumidores cuando sean aplicables.",
			],
		},
		{
			title: "2. Rol de Vindex y cuentas",
			paragraphs: [
				"Vindex proporciona herramientas para que compradores y vendedores se encuentren y gestionen operaciones. Salvo que una pantalla o comunicación indique expresamente lo contrario, el vendedor es quien ofrece y vende el producto, y es responsable de su existencia, titularidad, descripción, calidad, entrega y cumplimiento de las obligaciones que le correspondan. Vindex no pasa a ser vendedor por alojar una publicación.",
				"Debes entregar información veraz y mantenerla actualizada, proteger tus credenciales y avisar oportunamente si sospechas que alguien accedió a tu cuenta. Eres responsable de la actividad realizada desde ella. No puedes crear cuentas para suplantar a otras personas, eludir restricciones ni interferir con el funcionamiento del sitio.",
			],
		},
		{
			title: "3. Publicaciones y obligaciones del vendedor",
			paragraphs: [
				"El vendedor debe tener derecho a ofrecer el producto y publicar información completa, comprobable y no engañosa, incluyendo precio total, características relevantes, estado, disponibilidad, costos y condiciones de despacho o retiro. Las imágenes y descripciones deben representar fielmente el producto.",
				"Está prohibido publicar bienes ilícitos, falsificados, robados, peligrosos o cuya venta esté restringida por la ley, así como contenido que infrinja derechos de terceros. El vendedor debe cumplir las obligaciones tributarias, de garantía, información, seguridad y entrega que le sean aplicables según su calidad de proveedor y la normativa chilena.",
				"Vindex puede retirar publicaciones o limitar cuentas cuando existan indicios de infracción a estos términos, a la ley o a los derechos de otras personas. Esta facultad no reemplaza las acciones de las autoridades ni determina por sí sola la responsabilidad de las partes.",
			],
		},
		{
			title: "4. Compras, precios y derechos del consumidor",
			paragraphs: [
				"Antes de comprar, revisa la publicación, el precio final, los costos de despacho, el plazo estimado y las condiciones informadas. La confirmación de la compra y las instrucciones de pago que muestra el checkout forman parte de la operación. No envíes dinero ni datos de pago fuera de los canales indicados por Vindex.",
				"Cuando el vendedor tenga la calidad de proveedor y la operación esté sujeta a la Ley N.º 19.496 y sus reglamentos, se respetarán los derechos irrenunciables que esa normativa reconoce a los consumidores, incluyendo los relativos a información, garantías y retracto cuando proceda y con las excepciones legales correspondientes. Estos términos no reducen esos derechos.",
				"Las solicitudes, cambios, devoluciones o reclamos deben gestionarse por los canales habilitados, sin perjuicio de los derechos que puedas ejercer directamente frente al vendedor o ante los organismos competentes.",
			],
		},
		{
			title: "5. Subastas y ofertas",
			paragraphs: [
				"Cada subasta puede indicar sus propias reglas, duración, incrementos, precio mínimo y condiciones de cierre. Léelas antes de ofertar. Cuando las reglas de la subasta indiquen que una oferta es vinculante, ofertar constituye un compromiso de compra si resultas adjudicado, sujeto a la ley aplicable y a la información mostrada en esa subasta.",
				"No está permitido manipular ofertas, coordinar pujas ficticias ni interferir con una subasta. Vindex puede revisar actividad irregular, cancelar ofertas o adoptar medidas sobre cuentas conforme a estos términos y las reglas informadas en la publicación.",
			],
		},
		{
			title: "6. Pagos, custodia y entrega",
			paragraphs: [
				"Los medios de pago disponibles, comisiones, condiciones de liberación y eventuales plazos se informan en el checkout o durante la operación. Si se ofrece una modalidad de compra protegida, los fondos se mantienen en custodia y se liberan de acuerdo con el estado de entrega y las reglas comunicadas para esa operación; la custodia no equivale a una garantía de que el producto cumple lo ofrecido.",
				"Cuando la operación lo requiera, la entrega puede validarse mediante un código OTP de un solo uso. Solo comparte el código al recibir físicamente el producto y verifica que corresponda a tu compra. El vendedor debe entregar el producto a la persona autorizada y no solicitar el código antes de la entrega. Las instrucciones específicas del pedido determinan los pasos aplicables.",
				"Comprador y vendedor deben coordinar la entrega usando las opciones disponibles y conservar comprobantes relevantes. Los plazos pueden variar por factores ajenos a Vindex; esto no limita las obligaciones legales del vendedor.",
			],
		},
		{
			title: "7. Conductas prohibidas y propiedad intelectual",
			paragraphs: [
				"No debes usar Vindex para cometer fraudes, acosar, amenazar, discriminar, distribuir contenido ilícito, vulnerar derechos de propiedad intelectual o privacidad, ni intentar acceder sin autorización a cuentas, datos o sistemas. Tampoco debes introducir código malicioso, automatizar operaciones de forma abusiva o evadir controles de seguridad.",
				"Conservas los derechos sobre el contenido que publicas y declaras contar con las autorizaciones necesarias. Otorgas a Vindex permiso no exclusivo y limitado para alojarlo, reproducirlo y mostrarlo en la medida necesaria para operar y promover la plataforma. Puedes solicitar su retiro, sujeto a las obligaciones legales y a la conservación de antecedentes de operaciones.",
			],
		},
		{
			title: "8. Disponibilidad, responsabilidad y cambios",
			paragraphs: [
				"Vindex puede actualizar, suspender o mantener funciones para operar, mejorar o proteger el servicio. Se procurará informar cambios relevantes, sin perjuicio de interrupciones urgentes por seguridad, mantenimiento o causas fuera de control razonable. Ninguna disposición excluye responsabilidades o derechos que no puedan excluirse conforme a la ley chilena.",
				"Podemos modificar estos términos para reflejar cambios legales, operativos o de funciones. Publicaremos la versión actualizada y su fecha de vigencia. Si un cambio requiere nuevo consentimiento, lo solicitaremos antes de que continúes usando la función afectada; el uso posterior a la vigencia constituye aceptación solo cuando la ley lo permita.",
			],
		},
		{
			title: "9. Privacidad, soporte y legislación aplicable",
			paragraphs: [
				"El tratamiento de datos personales se rige por la política de privacidad de Vindex y la legislación chilena aplicable. Para ejercer derechos relacionados con tus datos, compras o cuenta, utiliza los canales de contacto publicados en el sitio.",
				"Estos términos se rigen por las leyes de Chile. Las controversias se resolverán ante los tribunales u organismos competentes, respetando las normas de competencia y los derechos que protegen a consumidores. Antes de publicar esta versión como definitiva, el operador de Vindex debe completar sus datos de identificación y contacto y someterla a revisión legal en Chile.",
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
				"",
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
