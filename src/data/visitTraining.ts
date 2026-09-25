/**
 * VARA Visit Certification — contenido de la capacitación.
 *
 * Esto no es relleno. Un Visit Partner entra a la casa de alguien: lo que
 * dice acá es lo que va a hacer o dejar de hacer cuando esté solo en el lugar.
 *
 * Regla de redacción: cada punto es una conducta observable, no un valor
 * abstracto. "Sé profesional" no sirve. "No opines sobre el precio" sí.
 *
 * Los umbrales de aprobación viven en `src/types/varaVisit.ts`
 * (QUIZ_PASSING_SCORE, QUIZ_QUESTION_COUNT, MAX_QUIZ_ATTEMPTS).
 */

import type { TrainingModule } from '@/types/varaVisit'

export const TRAINING_MODULES: TrainingModule[] = [
  {
    id: 'seguridad',
    order: 1,
    title: 'Seguridad personal y de la propiedad',
    summary: 'Cómo cuidarte y cuidar el lugar durante la visita.',
    keyPoints: [
      'Avisá a VARA antes de entrar: el check-in es tu registro de que estás ahí.',
      'Si algo te incomoda, salí. Ninguna visita vale tu seguridad.',
      'No entres a una propiedad si hay personas que no estaban informadas.',
      'Tené a mano el botón "Necesito ayuda" durante toda la visita.',
      'Nunca dejes la puerta abierta mientras mostrás otro ambiente.',
    ],
  },
  {
    id: 'acceso',
    order: 2,
    title: 'Acceso a propiedades',
    summary: 'Cómo entrar y salir sin generar problemas.',
    keyPoints: [
      'Usá solo el método de acceso indicado en la solicitud.',
      'No fuerces cerraduras, portones ni ventanas. Si no podés entrar, reportalo.',
      'Registrá la hora real de entrada, no la hora pactada.',
      'Si el acceso es por portería o seguridad, identificate como Visit Partner de VARA.',
      'Al salir, verificá puertas, ventanas y luces. Queda en el checklist.',
    ],
  },
  {
    id: 'conducta',
    order: 3,
    title: 'Conducta profesional',
    summary: 'Cómo te presentás y cómo tratás a las personas.',
    keyPoints: [
      'Llegá 10 minutos antes. La puntualidad es una métrica visible de tu perfil.',
      'Presentate con nombre y aclarando que sos Visit Partner de VARA.',
      'No consumas alimentos, bebidas ni uses instalaciones de la propiedad.',
      'No hables mal de la propiedad, del dueño ni de otros interesados.',
      'Si no sabés algo, decí que no sabés y que lo vas a averiguar.',
    ],
  },
  {
    id: 'privacidad',
    order: 4,
    title: 'Privacidad',
    summary: 'Qué información podés ver, usar y compartir.',
    keyPoints: [
      'Las instrucciones de acceso son confidenciales: no se comparten con nadie.',
      'No fotografíes objetos personales, documentos ni fotos familiares.',
      'No compartas el domicilio ni datos de contacto de ninguna de las partes.',
      'No difundas información de una propiedad fuera de VARA.',
      'Los datos de la visita se cargan en VARA, no en WhatsApp ni en tu agenda.',
    ],
  },
  {
    id: 'promesas',
    order: 5,
    title: 'Qué podés y qué NO podés prometer',
    summary: 'El límite de tu rol. El más importante de todos los módulos.',
    keyPoints: [
      'NO sos agente inmobiliario ni representás al vendedor en la negociación.',
      'NO podés aceptar ofertas, señas, reservas ni dinero de ningún tipo.',
      'NO podés afirmar que la documentación está en regla: eso lo verifica VARA.',
      'NO podés asegurar que un precio es negociable ni sugerir un monto.',
      'SÍ podés describir lo que ves y registrar las preguntas que te hacen.',
      'Ante cualquier pregunta que exceda esto: "Lo registro y VARA te responde".',
    ],
  },
  {
    id: 'recibir',
    order: 6,
    title: 'Cómo recibir interesados',
    summary: 'El protocolo cuando mostrás una propiedad.',
    keyPoints: [
      'Confirmá la identidad de quien llega contra lo informado en la solicitud.',
      'Si llegan más personas de las informadas, registralo antes de decidir.',
      'Mostrá los ambientes en un orden y no pierdas de vista a los visitantes.',
      'Anotá las preguntas textualmente mientras las hacen, no de memoria después.',
      'No dejes solos a los visitantes en ningún momento.',
    ],
  },
  {
    id: 'checklist',
    order: 7,
    title: 'Checklist de visita',
    summary: 'Qué tenés que completar sí o sí.',
    keyPoints: [
      'El checklist se completa durante la visita, no después.',
      'Un ítem marcado es una afirmación tuya: solo marcá lo que efectivamente hiciste.',
      'Los ítems obligatorios bloquean el cierre de la visita.',
      'Si no pudiste cumplir un ítem, dejalo sin marcar y explicá por qué en observaciones.',
    ],
  },
  {
    id: 'visit-mode',
    order: 8,
    title: 'Uso de Visit Mode',
    summary: 'La pantalla que usás en el lugar.',
    keyPoints: [
      'Visit Mode se usa desde el celular, en el lugar, no desde tu casa después.',
      'Check-in al llegar, PIN con el cliente, cronómetro, checklist, check-out.',
      'Sin PIN confirmado la visita no arranca. No es opcional.',
      'Si perdés señal, los datos se guardan y se sincronizan cuando vuelve.',
    ],
  },
  {
    id: 'llaves',
    order: 9,
    title: 'Manejo de llaves y códigos',
    summary: 'El punto donde más confianza se juega.',
    keyPoints: [
      'Nunca copies una llave ni compartas un código de acceso.',
      'No guardes códigos en notas del celular ni en mensajes.',
      'Devolvé las llaves el mismo día, por el medio acordado.',
      'Si perdés una llave, reportalo inmediatamente como incidente.',
    ],
  },
  {
    id: 'observaciones',
    order: 10,
    title: 'Registro de observaciones',
    summary: 'Hechos, no interpretaciones.',
    keyPoints: [
      'Escribí lo que viste y lo que se dijo, no lo que creés que significaba.',
      'MAL: "Los compradores estaban desesperados por cerrar."',
      'BIEN: "Preguntaron dos veces cuál era el plazo mínimo para reservar."',
      'MAL: "La cocina está horrible."',
      'BIEN: "Mancha de humedad de unos 40 cm en la pared norte de la cocina."',
      'VARA interpreta después. Si interpretás vos, VARA razona sobre una opinión.',
    ],
  },
  {
    id: 'incidentes',
    order: 11,
    title: 'Incidentes',
    summary: 'Qué hacer cuando algo sale mal.',
    keyPoints: [
      'Reportá el incidente el mismo día, aunque parezca menor.',
      'Un incidente no es una falta tuya: es información que protege a todos.',
      'Si hay riesgo para una persona, primero ponete a salvo y después reportá.',
      'VARA no llama a servicios de emergencia por vos: si hace falta, llamás vos al 911.',
      'No intentes resolver un conflicto por tu cuenta ni negociar con nadie.',
    ],
  },
  {
    id: 'checkout',
    order: 12,
    title: 'Check-out',
    summary: 'Cerrar bien es parte del trabajo.',
    keyPoints: [
      'No cierres la app: presioná "Finalizar visita". Es lo que registra tu salida.',
      'Verificá el cierre de la propiedad antes del check-out.',
      'El reporte se carga dentro de las 24 horas. Es parte del servicio, no un extra.',
      'Una visita sin reporte queda incompleta y afecta tu completion rate.',
    ],
  },
]

// ──────────────────────────── Quiz ────────────────────────────

export interface QuizQuestion {
  id: string
  moduleId: string
  question: string
  options: string[]
  /** Índice de la opción correcta. */
  correctIndex: number
  /** Se muestra después de responder, acierte o no. Se aprende del error. */
  explanation: string
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q01', moduleId: 'promesas',
    question: 'Un interesado te ofrece dejarte una seña en efectivo para reservar la propiedad. ¿Qué hacés?',
    options: [
      'La acepto y le aviso al dueño después.',
      'No acepto dinero bajo ninguna circunstancia y lo registro en el reporte.',
      'La acepto solo si el dueño me autorizó por mensaje.',
      'Le digo que se la deje al portero.',
    ],
    correctIndex: 1,
    explanation: 'Un Visit Partner nunca recibe dinero. Aceptar una seña te convierte en parte de una operación que no te corresponde y expone a todos.',
  },
  {
    id: 'q02', moduleId: 'promesas',
    question: '¿Podés decirle a un interesado que la documentación de la propiedad está en regla?',
    options: [
      'Sí, si el dueño me lo dijo.',
      'Sí, si vi la escritura.',
      'No. La documentación la verifica VARA, no el Visit Partner.',
      'Sí, pero aclarando que es aproximado.',
    ],
    correctIndex: 2,
    explanation: 'Afirmar que la documentación está en regla es una afirmación legal. No es tu rol y puede generar responsabilidad real.',
  },
  {
    id: 'q03', moduleId: 'observaciones',
    question: '¿Cuál de estas observaciones está bien redactada para el reporte?',
    options: [
      'Los visitantes parecían muy interesados.',
      'La propiedad está en mal estado.',
      'Preguntaron dos veces por el plazo de escrituración.',
      'Creo que van a hacer una oferta baja.',
    ],
    correctIndex: 2,
    explanation: 'Solo la tercera es un hecho verificable. Las otras tres son interpretaciones: VARA razonaría sobre una opinión y se equivocaría con confianza.',
  },
  {
    id: 'q04', moduleId: 'observaciones',
    question: 'Ves una mancha de humedad. ¿Cómo la registrás?',
    options: [
      'La cocina tiene problemas serios de humedad.',
      'Mancha de humedad de unos 40 cm en la pared norte de la cocina.',
      'Hay humedad, habría que revisarlo.',
      'No la registro para no perjudicar la venta.',
    ],
    correctIndex: 1,
    explanation: 'Describí ubicación y tamaño. No diagnostiques la causa ni omitas el dato: el reporte incompleto le hace perder dinero al cliente.',
  },
  {
    id: 'q05', moduleId: 'visit-mode',
    question: 'Llegaste a la propiedad y el cliente no te pasa el PIN. ¿Podés iniciar la visita?',
    options: [
      'Sí, si el cliente me autoriza por mensaje.',
      'Sí, el PIN es opcional.',
      'No. Sin PIN confirmado la visita no arranca.',
      'Sí, si ya hice visitas antes en esa propiedad.',
    ],
    correctIndex: 2,
    explanation: 'El PIN es la confirmación de identidad bilateral. Sin él no hay forma de probar que la persona correcta autorizó el ingreso.',
  },
  {
    id: 'q06', moduleId: 'visit-mode',
    question: 'Terminaste de mostrar la propiedad. ¿Qué hacés con la app?',
    options: [
      'La cierro, ya terminé.',
      'Presiono "Finalizar visita" para registrar mi salida.',
      'La dejo abierta hasta llegar a casa.',
      'Espero a que el cliente la cierre.',
    ],
    correctIndex: 1,
    explanation: 'El check-out es lo que registra tu hora de salida. Sin él la visita queda incompleta y sin trazabilidad.',
  },
  {
    id: 'q07', moduleId: 'llaves',
    question: 'El dueño te deja una copia de la llave para futuras visitas. ¿Qué hacés?',
    options: [
      'La guardo, así es más práctico.',
      'La devuelvo el mismo día por el medio acordado.',
      'Le saco foto por si la pierdo.',
      'Se la dejo al portero.',
    ],
    correctIndex: 1,
    explanation: 'Retener llaves fuera del acuerdo es el tipo de cosa que destruye la confianza del servicio entero.',
  },
  {
    id: 'q08', moduleId: 'llaves',
    question: '¿Dónde guardás el código de acceso de una propiedad?',
    options: [
      'En las notas del celular.',
      'En un mensaje de WhatsApp conmigo mismo.',
      'En ningún lado fuera de VARA.',
      'En un papel en la billetera.',
    ],
    correctIndex: 2,
    explanation: 'Un código fuera de VARA es un código que puede filtrarse con un celular perdido.',
  },
  {
    id: 'q09', moduleId: 'recibir',
    question: 'Informaron 2 visitantes y llegan 5. ¿Qué hacés?',
    options: [
      'Los hago pasar, total ya están.',
      'Registro la diferencia y decido; si no me siento seguro, no hago la visita.',
      'Hago pasar solo a 2.',
      'Llamo al dueño y hago lo que diga.',
    ],
    correctIndex: 1,
    explanation: 'Más personas de las informadas es un flag de seguridad. Registrarlo protege al dueño y a vos.',
  },
  {
    id: 'q10', moduleId: 'recibir',
    question: 'Durante la visita, los interesados quieren recorrer solos. ¿Los dejás?',
    options: [
      'Sí, así se sienten cómodos.',
      'Sí, si son pocos.',
      'No. No se deja solos a los visitantes en ningún momento.',
      'Sí, si les saco los objetos de valor antes.',
    ],
    correctIndex: 2,
    explanation: 'Estás ahí porque el dueño no está. Perder de vista a un visitante anula el sentido del servicio.',
  },
  {
    id: 'q11', moduleId: 'seguridad',
    question: 'Durante la visita te sentís inseguro. ¿Qué hacés?',
    options: [
      'Aguanto, ya falta poco.',
      'Termino rápido para no perder el pago.',
      'Salgo de la propiedad y reporto. Ninguna visita vale mi seguridad.',
      'Llamo al dueño y espero instrucciones.',
    ],
    correctIndex: 2,
    explanation: 'VARA prefiere una visita cancelada a un partner en riesgo. Salir nunca se penaliza.',
  },
  {
    id: 'q12', moduleId: 'seguridad',
    question: '¿Cuándo hacés el check-in?',
    options: [
      'Cuando salgo de casa.',
      'Al llegar a la propiedad.',
      'Cuando termino la visita.',
      'El día anterior, para no olvidarme.',
    ],
    correctIndex: 1,
    explanation: 'El check-in registra que estás ahí, en ese momento. Adelantarlo destruye el valor del registro.',
  },
  {
    id: 'q13', moduleId: 'privacidad',
    question: 'Un conocido te pregunta dónde queda la propiedad que mostraste. ¿Qué le decís?',
    options: [
      'Le paso la dirección, no es secreto.',
      'Le paso el link de la publicación.',
      'No comparto el domicilio ni datos de la operación.',
      'Le digo el barrio nomás.',
    ],
    correctIndex: 2,
    explanation: 'El domicilio y los datos de la operación son confidenciales. El link público lo comparte el dueño si quiere, no vos.',
  },
  {
    id: 'q14', moduleId: 'privacidad',
    question: 'Al fotografiar un ambiente para el reporte aparecen fotos familiares. ¿Qué hacés?',
    options: [
      'Saco la foto igual, es parte del ambiente.',
      'Encuadro de forma que no aparezcan objetos personales.',
      'Saco la foto y después la recorto.',
      'No saco ninguna foto.',
    ],
    correctIndex: 1,
    explanation: 'Las fotos documentan la propiedad, no la vida de quien la habita.',
  },
  {
    id: 'q15', moduleId: 'acceso',
    question: 'No podés entrar con el método indicado. ¿Qué hacés?',
    options: [
      'Pruebo otras formas de entrar.',
      'Le pido al vecino que me abra.',
      'Reporto el problema de acceso y no fuerzo nada.',
      'Cancelo y me voy sin avisar.',
    ],
    correctIndex: 2,
    explanation: 'Forzar un acceso, aunque sea con buena intención, es exactamente lo que un dueño teme.',
  },
  {
    id: 'q16', moduleId: 'acceso',
    question: 'Al terminar, ¿qué verificás antes del check-out?',
    options: [
      'Que no quede nadie adentro.',
      'Puertas, ventanas y luces.',
      'Las dos anteriores.',
      'Nada, el dueño revisa después.',
    ],
    correctIndex: 2,
    explanation: 'Cerrar bien es parte del servicio y queda registrado en el checklist.',
  },
  {
    id: 'q17', moduleId: 'conducta',
    question: 'Un interesado te pregunta si el precio es negociable. ¿Qué respondés?',
    options: [
      'Le digo que seguro aceptan menos.',
      'Le doy un número aproximado.',
      'Registro la pregunta y le digo que VARA le responde.',
      'Le digo que no es negociable.',
    ],
    correctIndex: 2,
    explanation: 'Opinar sobre el precio te mete en la negociación. Tu trabajo es registrar la pregunta.',
  },
  {
    id: 'q18', moduleId: 'conducta',
    question: '¿A qué hora conviene llegar a una visita pactada a las 10:00?',
    options: [
      'A las 10:00 en punto.',
      'Alrededor de las 9:50.',
      'A las 10:15, siempre hay demora.',
      'Cuando el cliente confirme que llegó.',
    ],
    correctIndex: 1,
    explanation: 'Llegar antes te da margen para el acceso y el check-in. La puntualidad es una métrica visible de tu perfil.',
  },
  {
    id: 'q19', moduleId: 'incidentes',
    question: 'Se rompió un objeto durante la visita, algo menor. ¿Reportás?',
    options: [
      'No, fue menor.',
      'Solo si el dueño lo nota.',
      'Sí, el mismo día, aunque parezca menor.',
      'Lo pago y no digo nada.',
    ],
    correctIndex: 2,
    explanation: 'Un incidente reportado por vos es información. Descubierto después, es un problema de confianza.',
  },
  {
    id: 'q20', moduleId: 'incidentes',
    question: 'Hay una situación de riesgo para una persona en la propiedad. ¿Qué hacés primero?',
    options: [
      'Reporto el incidente en la app.',
      'Me pongo a salvo y llamo al 911 si hace falta; después reporto.',
      'Espero que VARA llame a emergencias.',
      'Llamo al cliente.',
    ],
    correctIndex: 1,
    explanation: 'VARA no llama a servicios de emergencia por vos. Primero la seguridad de las personas, después el registro.',
  },
]

/** Corrige el quiz. Devuelve score 0–1 y el detalle por pregunta. */
export function gradeQuiz(answers: Record<string, number>): {
  score: number
  correct: number
  total: number
  wrong: QuizQuestion[]
} {
  const wrong = QUIZ_QUESTIONS.filter(q => answers[q.id] !== q.correctIndex)
  const correct = QUIZ_QUESTIONS.length - wrong.length
  return {
    score: QUIZ_QUESTIONS.length === 0 ? 0 : correct / QUIZ_QUESTIONS.length,
    correct,
    total: QUIZ_QUESTIONS.length,
    wrong,
  }
}
