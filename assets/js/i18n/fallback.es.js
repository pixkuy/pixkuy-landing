/* i18n — Fallback ES
 * Ruta: assets/js/i18n/fallback.es.js
 * Fuente de verdad: assets/js/i18n.js (FALLBACK_ES) — mantener 1:1
 * Responsabilidad única:
 * - Objeto de traducciones fallback para ES
 * NOTA: Este fichero no contiene lógica. Solo datos.
 */

(function () {
  "use strict";

  // Namespace interno i18n
  var root = window.__pixkuyI18nModules;
  if (!root) {
    root = {};
    window.__pixkuyI18nModules = root;
  }

  // Fallback ES EXACTO (no modificar contenido)
  root.FALLBACK_ES = {
    ui: {
      language: "Idioma"
    },
    hero: {
      title: "Movilidad privada con conductor, sin concesiones.",
      subtitle:
        "Conductores seleccionados. Vehículos eléctricos premium.<br>Un estándar consistente para quienes no improvisan su movilidad en Ciudad de México.",
      cta: "Solicitar invitación",
      note: "Acceso limitado · Lanzamiento marzo de 2026"
    },
    local: {
      title: "Ciudad de México, sin fricción.",
      body:
        "Rutas limpias, tiempos controlados y un estándar consistente. Pensado para trabajo, viajes y ocasiones especiales."
    },
    standard: {
      title: "Un estándar pensado para el silencio.",
      subtitle: "Movilidad eléctrica de alta gama.<br>Espacio. Calma. Continuidad."
    },
    services: {
      title: "No todas las necesidades son iguales.",
      item1: "Traslados privados planificados.",
      item2: "Servicios por horas o por días, con continuidad.",
      item3: "Eventos y ocasiones que requieren precisión.",
      item4: "Escapadas cercanas sin fricciones logísticas.",
      bridge:
        "Pixkuy está pensado para quienes valoran la planificación, la discreción y un estándar estable de servicio."
    },
    contact: {
      title: "Mantente informado.",
      subtitle: "Lanzamiento previsto en marzo de 2026.",
      name: "Nombre",
      email: "Email",
      phone: "Teléfono",
      msg: "Ej. evento en 2026, traslado planificado…",
      submit: "Enviar solicitud",
      footer: "Servicio no operativo aún · Solo avisos relevantes"
    },
    legal: {
      tagline: "Movilidad privada con conductor, sin concesiones.",
      location: "Ciudad de México, México.",
      contact: "Contacto exclusivamente mediante el formulario de esta web.",
      links: {
        notice: "Aviso legal",
        privacy: "Privacidad",
        cookies: "Cookies"
      },
      notice: {
        title: "Aviso legal",
        provider: "Titular: Pixkuy Mobility S.A. de C.V.",
        purposeTitle: "Objeto",
        purposeBody:
          "Este sitio web tiene como finalidad informar sobre Pixkuy Mobility y permitir que las personas interesadas soliciten ser contactadas mediante el formulario.",
        conditionsTitle: "Condiciones de uso",
        conditionsBody:
          "El acceso y uso de este sitio implica la aceptación de estas condiciones. El titular podrá actualizar contenidos y condiciones cuando sea necesario.",
        ipTitle: "Propiedad intelectual e industrial",
        ipBody:
          "Los contenidos, marcas, diseño e identidad visual de este sitio están protegidos. No se permite su reproducción o distribución sin autorización.",
        liabilityTitle: "Responsabilidad",
        liabilityBody:
          "El titular no se hace responsable de interrupciones temporales del servicio ni de daños derivados de un uso indebido del sitio.",
        back: "Volver a la landing"
      },
      privacy: {
        title: "Política de privacidad",
        controllerTitle: "Responsable del tratamiento",
        controllerBody: "Responsable: Pixkuy Mobility S.A. de C.V.",
        dataTitle: "Datos que se recogen",
        dataBody:
          "A través del formulario se recogen los datos que la persona introduce (p. ej. nombre, email, teléfono y mensaje).",
        purposeTitle: "Finalidad",
        purposeBody:
          "Gestionar solicitudes de contacto, mantener informadas a las personas interesadas y atender comunicaciones relacionadas con el servicio.",
        legalBasisTitle: "Base legal",
        legalBasisBody: "Consentimiento de la persona interesada al enviar el formulario.",
        retentionTitle: "Conservación",
        retentionBody:
          "Los datos se conservarán el tiempo necesario para atender la solicitud y, en su caso, para comunicaciones relacionadas, salvo obligación legal distinta.",
        rightsTitle: "Derechos",
        rightsBody:
          "Puedes solicitar acceso, rectificación o supresión, así como otros derechos aplicables conforme a la normativa vigente. Para ejercerlos, utiliza el formulario de esta web indicando tu solicitud.",
        securityTitle: "Seguridad",
        securityBody: "Se aplican medidas razonables para proteger los datos frente a accesos no autorizados.",
        back: "Volver a la landing"
      },
      cookies: {
        title: "Política de cookies",
        body1: "Este sitio no utiliza cookies con fines publicitarios ni de seguimiento.",
        body2:
          "Si en el futuro se incorporaran cookies, se informará y, cuando corresponda, se solicitará consentimiento.",
        body3:
          "La preferencia de idioma puede almacenarse localmente en el navegador para mejorar la experiencia.",
        back: "Volver a la landing"
      }
    }
  };
})();
