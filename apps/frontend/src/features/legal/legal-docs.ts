import { CONTACT } from '../../config/contact';

export interface LegalSection {
  body: string[];
  heading: string;
}

export interface LegalDoc {
  intro: string;
  sections: LegalSection[];
  title: string;
  updated: string;
}

const UPDATED = 'Junio 2026';

/**
 * Plantilla legal. NO constituye asesoría jurídica: debe ser revisada por un
 * abogado y completada con los datos reales de la empresa (razón social, RUT,
 * representante legal) antes de su publicación definitiva.
 */
export const LEGAL_DISCLAIMER =
  'Este documento es una plantilla referencial alineada con la normativa chilena vigente. No constituye asesoría legal y debe ser revisado por un abogado y completado con los datos de la empresa (razón social y RUT) antes de su uso oficial.';

const IDENTIFICACION = `Monopiston es un taller de servicio técnico de motocicletas Honda NAVI, actualmente en formación, con domicilio en ${CONTACT.address.street}, ${CONTACT.address.area}, Chile. [Completar razón social y RUT]. Contacto: ${CONTACT.phoneDisplay} · ${CONTACT.email}.`;

export const legalDocs: Record<string, LegalDoc> = {
  'bases-legales': {
    intro:
      'Condiciones generales aplicables al sitio, a los servicios y a eventuales promociones de Monopiston.',
    sections: [
      { body: [IDENTIFICACION], heading: '1. Identificación' },
      {
        body: [
          'La información de servicios, precios y disponibilidad publicada en el sitio es referencial y puede actualizarse sin previo aviso. Los valores se expresan en pesos chilenos (CLP) e incluyen los impuestos que correspondan.',
        ],
        heading: '2. Información del sitio',
      },
      {
        body: [
          'Cuando existan promociones, descuentos o concursos, se publicarán bases específicas indicando vigencia, requisitos de participación, beneficios, stock y mecánica, conforme a la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores.',
          'Mientras no se publiquen bases específicas, no existen promociones vigentes.',
        ],
        heading: '3. Promociones',
      },
      {
        body: [
          'Monopiston podrá modificar estas bases y las condiciones del sitio en cualquier momento. Las modificaciones rigen desde su publicación.',
        ],
        heading: '4. Vigencia y modificaciones',
      },
    ],
    title: 'Bases legales',
    updated: UPDATED,
  },
  consultas: {
    intro:
      'Canales de atención para consultas, solicitudes y reclamos sobre nuestros servicios.',
    sections: [
      {
        body: [
          `WhatsApp y teléfono: ${CONTACT.phoneDisplay}.`,
          `Correo electrónico: ${CONTACT.email}.`,
          `Atención presencial: ${CONTACT.address.street}, ${CONTACT.address.area}, en el horario de atención publicado.`,
        ],
        heading: '1. Canales de atención',
      },
      {
        body: [
          'Para una consulta o reclamo, indícanos tu nombre, un medio de contacto y el detalle de tu solicitud (incluyendo, si aplica, la patente de tu moto y la fecha de la atención). Esto nos permite responder con mayor rapidez.',
        ],
        heading: '2. Cómo presentar una consulta o reclamo',
      },
      {
        body: [
          'Procuramos responder dentro de los días hábiles siguientes a la recepción de tu mensaje.',
        ],
        heading: '3. Plazos de respuesta',
      },
      {
        body: [
          'Sin perjuicio de nuestros canales, como consumidor tienes derecho a reclamar ante el Servicio Nacional del Consumidor (SERNAC) a través de www.sernac.cl, conforme a la Ley N° 19.496.',
        ],
        heading: '4. SERNAC',
      },
    ],
    title: 'Consultas y reclamos',
    updated: UPDATED,
  },
  privacidad: {
    intro:
      'Tratamos tus datos personales conforme a la Ley N° 19.628 sobre Protección de la Vida Privada y su reforma (Ley N° 21.719).',
    sections: [
      { body: [IDENTIFICACION], heading: '1. Responsable del tratamiento' },
      {
        body: [
          'Recopilamos los datos que nos entregas al agendar o contactarnos: nombre, correo, teléfono y los datos de tu motocicleta (modelo, patente, kilometraje) y del servicio solicitado.',
        ],
        heading: '2. Datos que tratamos',
      },
      {
        body: [
          'Usamos tus datos para gestionar reservas, prestar el servicio, mantener el historial de tu moto, emitir documentos y contactarte por temas relacionados con tu atención.',
        ],
        heading: '3. Finalidad',
      },
      {
        body: [
          'La base de licitud es la ejecución del servicio que solicitas y, cuando corresponda, tu consentimiento. No vendemos ni cedemos tus datos a terceros con fines comerciales.',
        ],
        heading: '4. Base de licitud',
      },
      {
        body: [
          'Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición sobre tus datos escribiéndonos a ' +
            CONTACT.email +
            '. Atenderemos tu solicitud conforme a la ley.',
        ],
        heading: '5. Tus derechos',
      },
      {
        body: [
          'Conservamos los datos mientras sean necesarios para prestar el servicio y cumplir obligaciones legales, y aplicamos medidas razonables de seguridad para protegerlos.',
        ],
        heading: '6. Conservación y seguridad',
      },
    ],
    title: 'Política de privacidad',
    updated: UPDATED,
  },
  terminos: {
    intro:
      'Estos términos regulan el uso del sitio y la contratación de servicios de mantención y reparación de motocicletas Honda NAVI.',
    sections: [
      { body: [IDENTIFICACION], heading: '1. Identificación del prestador' },
      {
        body: [
          'Ofrecemos mantención preventiva, diagnóstico y reparación de motocicletas Honda NAVI. Las descripciones, duraciones y precios publicados son referenciales y pueden ajustarse tras la evaluación de la moto, lo que se informará antes de ejecutar el trabajo.',
        ],
        heading: '2. Servicios',
      },
      {
        body: [
          'Las reservas se realizan en línea y quedan sujetas a confirmación según disponibilidad. Te pedimos puntualidad; si no puedes asistir, avísanos con anticipación para reagendar.',
        ],
        heading: '3. Agendamiento y reservas',
      },
      {
        body: [
          'Los precios se expresan en pesos chilenos (CLP) e incluyen los impuestos que correspondan. Cuando un trabajo requiera un valor distinto al referencial, entregaremos un presupuesto previo para tu aprobación.',
        ],
        heading: '4. Precios y pagos',
      },
      {
        body: [
          'Los servicios y repuestos cuentan con la garantía legal establecida en la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores. Ante cualquier disconformidad puedes contactarnos y, además, reclamar ante el SERNAC (www.sernac.cl).',
        ],
        heading: '5. Garantías y derechos del consumidor',
      },
      {
        body: [
          'El cliente declara ser propietario de la motocicleta o estar autorizado para encargar su servicio. Monopiston no responde por objetos de valor dejados en la moto.',
        ],
        heading: '6. Responsabilidad',
      },
      {
        body: [
          'Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia se someterá a los tribunales competentes de Santiago, sin perjuicio de los derechos que la ley reconoce al consumidor.',
        ],
        heading: '7. Legislación aplicable',
      },
    ],
    title: 'Términos y condiciones',
    updated: UPDATED,
  },
};
