const field = (label, type, options = {}) =>
  Object.freeze({ label, type, required: false, multiline: false, ...options });

const text = (label, maxLength, options = {}) =>
  field(label, "text", { maxLength, ...options });
const email = (label, options = {}) =>
  field(label, "email", { maxLength: 254, ...options });
const phone = (label, options = {}) =>
  field(label, "phone", { maxLength: 32, ...options });
const select = (label, values, options = {}) =>
  field(label, "select", { maxLength: 100, values: Object.freeze(values), ...options });
const consent = () => field("Согласие", "consent", { required: true });
const honeypot = () => field("", "honeypot", { maxLength: 256 });

export const PRODUCT_SLUGS = Object.freeze([
  "alfredo-kuritsa",
  "karbonara",
  "mak-end-chiz",
  "vetchina-griby-slivochny-sous",
  "pasta-frikadelki-tomatny-sous",
  "chetyre-syra",
  "kuritsa-pesto-vyalenye-tomaty",
  "primavera",
  "rizotto-rizi-bizi-pesto-zeleny-goroshek",
  "rizotto-griby-slivochny-sous",
  "paelya-kuritsa-ovoshchi",
]);

const gatewayScenario = (businessType) => ({ businessType });

export const FORM_CONTRACTS = Object.freeze({
  "home-b2b": Object.freeze({
    formLabel: "Партнёрская заявка с главной",
    page: "/",
    subjectPrefix: "[PASTODEL][HOME]",
    subjectContext: Object.freeze(["company"]),
    fields: Object.freeze({
      name: text("Имя", 120, { required: true }),
      company: text("Компания", 200, { required: true }),
      email: email("Email", { required: true }),
      phone: phone("Телефон", { required: true }),
      privacy: consent(),
      company_site: honeypot(),
    }),
  }),
  "partneram-b2b": Object.freeze({
    formLabel: "Заявка сетевого ритейла",
    page: "/partneram/",
    subjectPrefix: "[PASTODEL][RETAIL]",
    subjectContext: Object.freeze(["company", "city"]),
    fields: Object.freeze({
      company: text("Название сети", 200, { required: true }),
      store_count: field("Количество торговых точек", "positiveInteger", {
        required: true,
        maxLength: 16,
      }),
      city: text("Город", 120, { required: true }),
      email: email("Email", { required: true }),
      phone: phone("Телефон", { required: true }),
      request_type: select("Тип запроса", [
        "Запрос условий",
        "Коммерческое предложение",
        "Обсуждение пилота",
      ]),
      product: field("Продукт", "productSlug", { maxLength: 100 }),
      privacy: consent(),
      company_site: honeypot(),
    }),
  }),
  "horeca-request": Object.freeze({
    formLabel: "Заявка HoReCa",
    page: "/horeca/",
    subjectPrefix: "[PASTODEL][HORECA]",
    subjectContext: Object.freeze(["company", "city"]),
    fields: Object.freeze({
      name: text("Имя", 120, { required: true }),
      company: text("Компания", 200, { required: true }),
      venue_type: text("Тип заведения", 160, { required: true }),
      city: text("Город", 120, { required: true }),
      phone: phone("Телефон", { required: true }),
      email: email("Email", { required: true }),
      product_interest: text("Интересующие позиции", 1000, {
        multiline: true,
      }),
      request_type: select("Тип запроса", [
        "Заказать дегустацию",
        "Обсудить условия",
        "Запрос по HoReCa",
      ]),
      privacy: consent(),
      company_site: honeypot(),
    }),
  }),
  "partner-gateway": Object.freeze({
    formLabel: "Универсальная партнёрская заявка",
    page: "/stat-partnerom/",
    subjectPrefix: "[PASTODEL][PARTNER]",
    subjectContext: Object.freeze([
      "retail_company",
      "horeca_company",
      "distributor_company",
      "retail_city",
      "horeca_city",
      "distributor_region",
    ]),
    fields: Object.freeze({
      business_type: select("Тип бизнеса", ["Ритейл", "HoReCa", "Дистрибьютор"], {
        required: true,
        maxLength: 32,
      }),
      name: text("Имя", 120, { required: true }),
      phone: phone("Телефон", { required: true }),
      email: email("Email", { required: true }),
      retail_company: text("Название сети", 200, {
        requiredFor: gatewayScenario("Ритейл"),
      }),
      retail_store_count: field("Количество торговых точек", "positiveInteger", {
        maxLength: 16,
        requiredFor: gatewayScenario("Ритейл"),
      }),
      retail_city: text("Город", 120, {
        requiredFor: gatewayScenario("Ритейл"),
      }),
      horeca_company: text("Компания", 200, {
        requiredFor: gatewayScenario("HoReCa"),
      }),
      horeca_venue_type: text("Тип заведения", 160, {
        requiredFor: gatewayScenario("HoReCa"),
      }),
      horeca_city: text("Город", 120, {
        requiredFor: gatewayScenario("HoReCa"),
      }),
      distributor_company: text("Компания", 200, {
        requiredFor: gatewayScenario("Дистрибьютор"),
      }),
      distributor_region: text("Регион", 160, {
        requiredFor: gatewayScenario("Дистрибьютор"),
      }),
      distributor_interest: text("Коротко о запросе", 1000, {
        multiline: true,
        requiredFor: gatewayScenario("Дистрибьютор"),
      }),
      request_type: select("Цель обращения", [
        "Получить условия",
        "Заказать дегустацию",
        "Обсудить сотрудничество",
      ], { required: true }),
      privacy: consent(),
      company_site: honeypot(),
    }),
  }),
  contacts: Object.freeze({
    formLabel: "Обращение с сайта",
    page: "/kontakty/",
    subjectPrefix: "[PASTODEL][CONTACT]",
    subjectContext: Object.freeze(["topic", "name"]),
    fields: Object.freeze({
      name: text("Имя", 120, { required: true }),
      company: text("Компания", 200),
      topic: select("Тема", [
        "Сотрудничество и продажи",
        "Качество и упаковка",
        "Закупки и коммерческие предложения",
        "Общий вопрос",
      ], { required: true }),
      phone: phone("Телефон"),
      email: email("Email", { required: true }),
      message: text("Сообщение", 2000, {
        required: true,
        multiline: true,
      }),
      privacy: consent(),
      company_site: honeypot(),
    }),
  }),
});

export const FORM_IDS = Object.freeze(Object.keys(FORM_CONTRACTS));

export const getFormContract = (formId) => FORM_CONTRACTS[formId];
