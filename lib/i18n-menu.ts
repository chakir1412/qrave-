/**
 * UI-Strings + Kategorie-Übersetzungen für die Gäste-Speisekarte.
 * Quellsprache ist Deutsch. Fallback bei unbekannter Locale ODER fehlendem
 * Key → DE.
 *
 * `t(key, locale)` für statische UI-Strings (Buttons, Tab-Labels, Headers).
 * `tCategory(name, locale)` für Kategorie-Namen (mit Normalisierungs-Lookup,
 * sodass "Heissgetränke" / "Heißgetränke" / "HEIßGETRÄNKE" alle matchen).
 */

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/menu-i18n";

export const MENU_STRINGS = {
  de: {
    all: "Alle",
    vegan: "Vegan",
    vegetarian: "Vegetarisch",
    glutenfree: "Glutenfrei",
    gf_short: "GF",
    spicy: "Scharf",
    halal: "Halal",
    allergens: "Allergene",
    allergens_and_ingredients: "Allergene & Zutaten",
    ingredients: "Zutaten",
    contains: "Enthält:",
    often_ordered_together: "Oft zusammen bestellt",
    add_to_wishlist: "Zur Merkliste",
    on_wishlist: "Auf der Merkliste",
    sold_out: "Ausverkauft",
    daily_special: "Tages-Special",
    todays_special_badge: "✨ Heute besonders",
    lunch_offer: "Mittagsangebot",
    menu_tab: "Speisekarte",
    wishlist: "Merkliste",
    contact: "Kontakt",
    imprint: "Impressum",
    privacy: "Datenschutz",
    close: "Schließen",
    back: "Zurück",
    share: "Teilen",
    note_for_guests: "Hinweis",
    no_items_in_category: "Keine Gerichte in dieser Kategorie.",
    to_menu: "Zur Speisekarte",
    open_today: "Geöffnet",
    open_until: "Geöffnet · bis",
    kitchen_until: "Küche bis",
    closed_today: "Geschlossen",
    closed_today_full: "Heute geschlossen",
    opens_at: "öffnet um",
    area_closed_today: "heute geschlossen",
    help_improve: "Hilfst du uns die Karte zu verbessern?",
    help_improve_sub: "Wir messen mit einer pseudonymen Kennung, welche Gerichte und Kategorien gut ankommen — keine Namen, keine Weitergabe an Dritte. Du kannst jederzeit in den Datenschutz-Einstellungen widerrufen.",
    consent_more: "Mehr erfahren",
    consent_decline: "Nein",
    consent_accept: "Ja, gerne",
    consent_toast_accepted: "✓ Danke — nie wieder gefragt",
    consent_toast_declined: "Verstanden · Kein Tracking aktiv",
    privacy_policy_link: "Datenschutzerklärung",
    privacy_settings: "Datenschutz-Einstellungen",
    privacy_current_active: "Aktuell aktiv — du hilfst uns beim Verbessern der Karte.",
    privacy_current_inactive: "Aktuell inaktiv — kein Tracking läuft.",
    consent_status_accepted: "Du hast zugestimmt",
    consent_status_declined: "Du hast abgelehnt",
    your_data: "Deine Daten",
    your_data_desc: "Mit dieser Kennung kannst du per E-Mail an info@qrave.menu Auskunft oder Löschung deiner Daten verlangen.",
    your_data_none: "Es sind keine dich betreffenden Tier-1-Daten gespeichert.",
    copy: "Kopieren",
    copied: "Kopiert",
    revoke_consent: "Einwilligung widerrufen",
    grant_consent: "Einwilligung erteilen",
    privacy_toast_revoked: "Einwilligung widerrufen · Daten gelöscht",
    privacy_toast_granted: "✓ Einwilligung erteilt",
    disclaimer: "Alle Angaben ohne Gewähr · Preise inkl. MwSt.",
    wishlist_empty: "Deine Liste ist leer.",
    allergens_info: "Hinweise pro Gericht — Details findest du jeweils im Detail-Bildschirm eines Gerichtes.",
    allergens_service: "Bitte informieren Sie zusätzlich unser Service-Team über Ihre Allergien.",
    allergens_only: "Allergene",
    additives_label: "Zusatzstoffe",
  },
  en: {
    all: "All",
    vegan: "Vegan",
    vegetarian: "Vegetarian",
    glutenfree: "Gluten-free",
    gf_short: "GF",
    spicy: "Spicy",
    halal: "Halal",
    allergens: "Allergens",
    allergens_and_ingredients: "Allergens & ingredients",
    ingredients: "Ingredients",
    contains: "Contains:",
    often_ordered_together: "Often ordered together",
    add_to_wishlist: "Add to wishlist",
    on_wishlist: "On wishlist",
    sold_out: "Sold out",
    daily_special: "Today's special",
    todays_special_badge: "✨ Today's special",
    lunch_offer: "Lunch menu",
    menu_tab: "Menu",
    wishlist: "Wishlist",
    contact: "Contact",
    imprint: "Imprint",
    privacy: "Privacy",
    close: "Close",
    back: "Back",
    share: "Share",
    note_for_guests: "Note",
    no_items_in_category: "No dishes in this category.",
    to_menu: "View Menu",
    open_today: "Open",
    open_until: "Open · until",
    kitchen_until: "Kitchen until",
    closed_today: "Closed",
    closed_today_full: "Closed today",
    opens_at: "opens at",
    area_closed_today: "closed today",
    help_improve: "Help us improve the menu?",
    help_improve_sub: "We use a pseudonymous identifier to track which dishes and categories perform well — no names, no data sharing. You can revoke your consent anytime in the privacy settings.",
    consent_more: "Learn more",
    consent_decline: "No",
    consent_accept: "Yes, gladly",
    consent_toast_accepted: "✓ Thanks — we won't ask again",
    consent_toast_declined: "Got it · No tracking active",
    privacy_policy_link: "Privacy policy",
    privacy_settings: "Privacy settings",
    privacy_current_active: "Currently active — you're helping us improve the menu.",
    privacy_current_inactive: "Currently inactive — no tracking is running.",
    consent_status_accepted: "You've agreed",
    consent_status_declined: "You've declined",
    your_data: "Your data",
    your_data_desc: "With this identifier you can email info@qrave.menu to request access to or deletion of your data.",
    your_data_none: "No Tier-1 data related to you is stored.",
    copy: "Copy",
    copied: "Copied",
    revoke_consent: "Revoke consent",
    grant_consent: "Grant consent",
    privacy_toast_revoked: "Consent revoked · data deleted",
    privacy_toast_granted: "✓ Consent granted",
    disclaimer: "All information without guarantee · Prices incl. VAT",
    wishlist_empty: "Your list is empty.",
    allergens_info: "Notes per dish — find details in each dish's detail screen.",
    allergens_service: "Please also inform our service team about your allergies.",
    allergens_only: "Allergens",
    additives_label: "Additives",
  },
  tr: {
    all: "Tümü",
    vegan: "Vegan",
    vegetarian: "Vejetaryen",
    glutenfree: "Glütensiz",
    gf_short: "GF",
    spicy: "Acılı",
    halal: "Helal",
    allergens: "Alerjenler",
    allergens_and_ingredients: "Alerjenler ve içindekiler",
    ingredients: "İçindekiler",
    contains: "İçerir:",
    often_ordered_together: "Sıkça birlikte sipariş edilenler",
    add_to_wishlist: "Listeye ekle",
    on_wishlist: "Listede",
    sold_out: "Tükendi",
    daily_special: "Günün özel menüsü",
    todays_special_badge: "✨ Bugünün özeli",
    lunch_offer: "Öğle menüsü",
    menu_tab: "Menü",
    wishlist: "Liste",
    contact: "İletişim",
    imprint: "Künye",
    privacy: "Gizlilik",
    close: "Kapat",
    back: "Geri",
    share: "Paylaş",
    note_for_guests: "Not",
    no_items_in_category: "Bu kategoride yemek yok.",
    to_menu: "Menüye Git",
    open_today: "Açık",
    open_until: "Açık · saat",
    kitchen_until: "Mutfak saat",
    closed_today: "Kapalı",
    closed_today_full: "Bugün kapalı",
    opens_at: "açılış",
    area_closed_today: "bugün kapalı",
    help_improve: "Menüyü geliştirmemize yardım eder misin?",
    help_improve_sub: "Hangi yemeklerin ve kategorilerin sevildiğini takma bir kimlikle ölçüyoruz — isim yok, üçüncü taraflarla paylaşım yok. Onayınızı istediğiniz zaman gizlilik ayarlarından geri alabilirsiniz.",
    consent_more: "Daha fazla bilgi",
    consent_decline: "Hayır",
    consent_accept: "Evet, memnuniyetle",
    consent_toast_accepted: "✓ Teşekkürler — bir daha sormayız",
    consent_toast_declined: "Anlaşıldı · Takip yok",
    privacy_policy_link: "Gizlilik politikası",
    privacy_settings: "Gizlilik ayarları",
    privacy_current_active: "Şu anda aktif — menüyü geliştirmemize yardım ediyorsunuz.",
    privacy_current_inactive: "Şu anda inaktif — takip çalışmıyor.",
    consent_status_accepted: "Onay verdiniz",
    consent_status_declined: "Reddettiniz",
    your_data: "Verileriniz",
    your_data_desc: "Bu tanımlayıcı ile info@qrave.menu adresine e-posta göndererek verilerinize erişim veya silinmesini talep edebilirsiniz.",
    your_data_none: "Sizinle ilgili Tier-1 verisi kayıtlı değil.",
    copy: "Kopyala",
    copied: "Kopyalandı",
    revoke_consent: "Onayı geri al",
    grant_consent: "Onay ver",
    privacy_toast_revoked: "Onay geri alındı · veriler silindi",
    privacy_toast_granted: "✓ Onay verildi",
    disclaimer: "Tüm bilgiler garantisiz · Fiyatlara KDV dahildir",
    wishlist_empty: "Listeniz boş.",
    allergens_info: "Yemek başına notlar — ayrıntıları her yemeğin detay ekranında bulabilirsiniz.",
    allergens_service: "Lütfen alerjileriniz hakkında servis ekibimize de bilgi verin.",
    allergens_only: "Alerjenler",
    additives_label: "Katkı maddeleri",
  },
  ar: {
    all: "الكل",
    vegan: "نباتي صرف",
    vegetarian: "نباتي",
    glutenfree: "خالٍ من الغلوتين",
    gf_short: "بدون غلوتين",
    spicy: "حار",
    halal: "حلال",
    allergens: "المواد المسببة للحساسية",
    allergens_and_ingredients: "المسببات والمكونات",
    ingredients: "المكونات",
    contains: "يحتوي على:",
    often_ordered_together: "كثيراً ما تُطلب معاً",
    add_to_wishlist: "أضف إلى القائمة",
    on_wishlist: "في القائمة",
    sold_out: "نفد",
    daily_special: "طبق اليوم",
    todays_special_badge: "✨ مميّز اليوم",
    lunch_offer: "قائمة الغداء",
    menu_tab: "القائمة",
    wishlist: "المفضلة",
    contact: "اتصل بنا",
    imprint: "بيانات الناشر",
    privacy: "الخصوصية",
    close: "إغلاق",
    back: "رجوع",
    share: "مشاركة",
    note_for_guests: "ملاحظة",
    no_items_in_category: "لا توجد أطباق في هذا القسم.",
    to_menu: "عرض القائمة",
    open_today: "مفتوح",
    open_until: "مفتوح · حتى",
    kitchen_until: "المطبخ حتى",
    closed_today: "مغلق",
    closed_today_full: "مغلق اليوم",
    opens_at: "يفتح في",
    area_closed_today: "مغلق اليوم",
    help_improve: "هل تساعدنا في تحسين القائمة؟",
    help_improve_sub: "نقيس بمعرّف مستعار الأطباق والفئات التي تحظى بالإعجاب — بلا أسماء ولا مشاركة مع أطراف ثالثة. يمكنك سحب موافقتك في أي وقت من إعدادات الخصوصية.",
    consent_more: "اقرأ المزيد",
    consent_decline: "لا",
    consent_accept: "نعم، بكل سرور",
    consent_toast_accepted: "✓ شكراً — لن نسأل مرة أخرى",
    consent_toast_declined: "تم · لا تتبع",
    privacy_policy_link: "سياسة الخصوصية",
    privacy_settings: "إعدادات الخصوصية",
    privacy_current_active: "نشط حالياً — أنت تساعدنا في تحسين القائمة.",
    privacy_current_inactive: "غير نشط حالياً — لا يوجد تتبع.",
    consent_status_accepted: "لقد وافقت",
    consent_status_declined: "لقد رفضت",
    your_data: "بياناتك",
    your_data_desc: "بهذا المُعرِّف يمكنك مراسلة info@qrave.menu لطلب الاطلاع على بياناتك أو حذفها.",
    your_data_none: "لا توجد بيانات Tier-1 مُخزَّنة تخصك.",
    copy: "نسخ",
    copied: "تم النسخ",
    revoke_consent: "سحب الموافقة",
    grant_consent: "منح الموافقة",
    privacy_toast_revoked: "تم سحب الموافقة · حُذفت البيانات",
    privacy_toast_granted: "✓ تم منح الموافقة",
    disclaimer: "جميع المعلومات دون ضمان · الأسعار شاملة ضريبة القيمة المضافة",
    wishlist_empty: "قائمتك فارغة.",
    allergens_info: "ملاحظات لكل طبق — تجد التفاصيل في شاشة تفاصيل كل طبق.",
    allergens_service: "يرجى أيضاً إبلاغ فريق الخدمة لدينا بحساسيتك تجاه الطعام.",
    allergens_only: "مسببات الحساسية",
    additives_label: "المواد المضافة",
  },
  ru: {
    all: "Все",
    vegan: "Веганское",
    vegetarian: "Вегетарианское",
    glutenfree: "Без глютена",
    gf_short: "БГ",
    spicy: "Острое",
    halal: "Халяль",
    allergens: "Аллергены",
    allergens_and_ingredients: "Аллергены и состав",
    ingredients: "Состав",
    contains: "Содержит:",
    often_ordered_together: "Часто заказывают вместе",
    add_to_wishlist: "В избранное",
    on_wishlist: "В избранном",
    sold_out: "Распродано",
    daily_special: "Блюдо дня",
    todays_special_badge: "✨ Сегодня особенное",
    lunch_offer: "Бизнес-ланч",
    menu_tab: "Меню",
    wishlist: "Избранное",
    contact: "Контакты",
    imprint: "Импрессум",
    privacy: "Конфиденциальность",
    close: "Закрыть",
    back: "Назад",
    share: "Поделиться",
    note_for_guests: "Заметка",
    no_items_in_category: "В этой категории пока ничего нет.",
    to_menu: "Открыть меню",
    open_today: "Открыто",
    open_until: "Открыто · до",
    kitchen_until: "Кухня до",
    closed_today: "Закрыто",
    closed_today_full: "Сегодня закрыто",
    opens_at: "открывается в",
    area_closed_today: "сегодня закрыто",
    help_improve: "Помочь нам улучшить меню?",
    help_improve_sub: "Мы используем псевдонимный идентификатор, чтобы понять, какие блюда и категории нравятся гостям — без имён и без передачи третьим лицам. Вы можете отозвать согласие в любое время в настройках конфиденциальности.",
    consent_more: "Узнать больше",
    consent_decline: "Нет",
    consent_accept: "Да, с радостью",
    consent_toast_accepted: "✓ Спасибо — больше не спросим",
    consent_toast_declined: "Понятно · Отслеживания нет",
    privacy_policy_link: "Политика конфиденциальности",
    privacy_settings: "Настройки конфиденциальности",
    privacy_current_active: "Сейчас активно — вы помогаете нам улучшать меню.",
    privacy_current_inactive: "Сейчас неактивно — отслеживание не выполняется.",
    consent_status_accepted: "Вы согласились",
    consent_status_declined: "Вы отказались",
    your_data: "Ваши данные",
    your_data_desc: "С этим идентификатором вы можете написать на info@qrave.menu и запросить доступ к своим данным или их удаление.",
    your_data_none: "Данные Tier-1, относящиеся к вам, не сохранены.",
    copy: "Копировать",
    copied: "Скопировано",
    revoke_consent: "Отозвать согласие",
    grant_consent: "Дать согласие",
    privacy_toast_revoked: "Согласие отозвано · данные удалены",
    privacy_toast_granted: "✓ Согласие получено",
    disclaimer: "Все данные без гарантии · Цены включают НДС",
    wishlist_empty: "Ваш список пуст.",
    allergens_info: "Примечания к каждому блюду — подробности на экране деталей блюда.",
    allergens_service: "Пожалуйста, также сообщите нашей команде обслуживания о ваших аллергиях.",
    allergens_only: "Аллергены",
    additives_label: "Добавки",
  },
  it: {
    all: "Tutti",
    vegan: "Vegano",
    vegetarian: "Vegetariano",
    glutenfree: "Senza glutine",
    gf_short: "SG",
    spicy: "Piccante",
    halal: "Halal",
    allergens: "Allergeni",
    allergens_and_ingredients: "Allergeni e ingredienti",
    ingredients: "Ingredienti",
    contains: "Contiene:",
    often_ordered_together: "Spesso ordinati insieme",
    add_to_wishlist: "Salva nella lista",
    on_wishlist: "Nella lista",
    sold_out: "Esaurito",
    daily_special: "Speciale del giorno",
    todays_special_badge: "✨ Speciale oggi",
    lunch_offer: "Menù pranzo",
    menu_tab: "Menù",
    wishlist: "Lista",
    contact: "Contatti",
    imprint: "Note legali",
    privacy: "Privacy",
    close: "Chiudi",
    back: "Indietro",
    share: "Condividi",
    note_for_guests: "Nota",
    no_items_in_category: "Nessun piatto in questa categoria.",
    to_menu: "Vedi Menu",
    open_today: "Aperto",
    open_until: "Aperto · fino alle",
    kitchen_until: "Cucina fino alle",
    closed_today: "Chiuso",
    closed_today_full: "Chiuso oggi",
    opens_at: "apre alle",
    area_closed_today: "chiuso oggi",
    help_improve: "Ci aiuti a migliorare il menu?",
    help_improve_sub: "Misuriamo con un identificatore pseudonimo quali piatti e categorie piacciono di più — niente nomi, niente condivisione con terzi. Puoi revocare il consenso in qualsiasi momento nelle impostazioni sulla privacy.",
    consent_more: "Scopri di più",
    consent_decline: "No",
    consent_accept: "Sì, volentieri",
    consent_toast_accepted: "✓ Grazie — non chiederemo più",
    consent_toast_declined: "Capito · Nessun tracking",
    privacy_policy_link: "Informativa privacy",
    privacy_settings: "Impostazioni privacy",
    privacy_current_active: "Attualmente attivo — ci stai aiutando a migliorare il menu.",
    privacy_current_inactive: "Attualmente inattivo — nessun tracciamento in corso.",
    consent_status_accepted: "Hai acconsentito",
    consent_status_declined: "Hai rifiutato",
    your_data: "I tuoi dati",
    your_data_desc: "Con questo identificatore puoi scrivere a info@qrave.menu per richiedere l'accesso o la cancellazione dei tuoi dati.",
    your_data_none: "Nessun dato Tier-1 relativo a te è memorizzato.",
    copy: "Copia",
    copied: "Copiato",
    revoke_consent: "Revoca il consenso",
    grant_consent: "Concedi il consenso",
    privacy_toast_revoked: "Consenso revocato · dati eliminati",
    privacy_toast_granted: "✓ Consenso concesso",
    disclaimer: "Tutte le informazioni senza garanzia · Prezzi IVA inclusa",
    wishlist_empty: "La tua lista è vuota.",
    allergens_info: "Note per piatto — i dettagli si trovano nella schermata di ogni piatto.",
    allergens_service: "La preghiamo di informare anche il nostro personale di sala riguardo alle sue allergie.",
    allergens_only: "Allergeni",
    additives_label: "Additivi",
  },
  fr: {
    all: "Tous",
    vegan: "Végan",
    vegetarian: "Végétarien",
    glutenfree: "Sans gluten",
    gf_short: "SG",
    spicy: "Épicé",
    halal: "Halal",
    allergens: "Allergènes",
    allergens_and_ingredients: "Allergènes & ingrédients",
    ingredients: "Ingrédients",
    contains: "Contient :",
    often_ordered_together: "Souvent commandés ensemble",
    add_to_wishlist: "Ajouter à la liste",
    on_wishlist: "Dans la liste",
    sold_out: "Épuisé",
    daily_special: "Plat du jour",
    todays_special_badge: "✨ Spécial du jour",
    lunch_offer: "Menu déjeuner",
    menu_tab: "Menu",
    wishlist: "Liste",
    contact: "Contact",
    imprint: "Mentions légales",
    privacy: "Confidentialité",
    close: "Fermer",
    back: "Retour",
    share: "Partager",
    note_for_guests: "Note",
    no_items_in_category: "Aucun plat dans cette catégorie.",
    to_menu: "Voir le menu",
    open_today: "Ouvert",
    open_until: "Ouvert · jusqu'à",
    kitchen_until: "Cuisine jusqu'à",
    closed_today: "Fermé",
    closed_today_full: "Fermé aujourd'hui",
    opens_at: "ouvre à",
    area_closed_today: "fermé aujourd'hui",
    help_improve: "Nous aider à améliorer le menu?",
    help_improve_sub: "Nous mesurons avec un identifiant pseudonyme quels plats et catégories plaisent — pas de noms, pas de partage avec des tiers. Vous pouvez retirer votre consentement à tout moment dans les paramètres de confidentialité.",
    consent_more: "En savoir plus",
    consent_decline: "Non",
    consent_accept: "Oui, volontiers",
    consent_toast_accepted: "✓ Merci — on ne demandera plus",
    consent_toast_declined: "Compris · Aucun suivi",
    privacy_policy_link: "Politique de confidentialité",
    privacy_settings: "Paramètres de confidentialité",
    privacy_current_active: "Actuellement actif — vous nous aidez à améliorer le menu.",
    privacy_current_inactive: "Actuellement inactif — aucun suivi en cours.",
    consent_status_accepted: "Vous avez accepté",
    consent_status_declined: "Vous avez refusé",
    your_data: "Vos données",
    your_data_desc: "Avec cet identifiant, vous pouvez écrire à info@qrave.menu pour demander l'accès à vos données ou leur suppression.",
    your_data_none: "Aucune donnée Tier-1 vous concernant n'est enregistrée.",
    copy: "Copier",
    copied: "Copié",
    revoke_consent: "Retirer le consentement",
    grant_consent: "Donner le consentement",
    privacy_toast_revoked: "Consentement retiré · données supprimées",
    privacy_toast_granted: "✓ Consentement donné",
    disclaimer: "Toutes informations sans garantie · Prix TTC",
    wishlist_empty: "Votre liste est vide.",
    allergens_info: "Notes par plat — détails dans l'écran de détail de chaque plat.",
    allergens_service: "Merci d'informer également notre équipe de salle de vos allergies.",
    allergens_only: "Allergènes",
    additives_label: "Additifs",
  },
} as const;

export type MenuStringKey = keyof typeof MENU_STRINGS.de;

/** UI-String-Lookup. Fallback bei fehlender Locale oder fehlendem Key → DE. */
export function t(key: MenuStringKey, locale: string | null | undefined): string {
  if (!locale || !(locale in MENU_STRINGS)) return MENU_STRINGS.de[key];
  const dict = MENU_STRINGS[locale as SupportedLocale];
  return dict[key] ?? MENU_STRINGS.de[key];
}

/** Normalisierung für Kategorie-Lookup: lowercase + diakritisch-frei.
 *  "Heißgetränke", "Heissgetraenke", "HEISSGETRÄNKE" matchen denselben Key. */
function normalizeKategorieKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/** Kategorie-Übersetzungen — Map normalisierter DE-Name → {locale: name}.
 *  Universale Loanwords (Pizza/Pasta/Burger/Sushi/Cocktails) brauchen keinen
 *  Eintrag — sie fallen automatisch auf den Original-DE-Wert zurück. */
const CATEGORY_TRANSLATIONS: Record<string, Partial<Record<SupportedLocale, string>>> = {
  vorspeisen: { en: "Starters", tr: "Başlangıçlar", ar: "المقبلات", ru: "Закуски", it: "Antipasti", fr: "Entrées" },
  hauptgerichte: { en: "Main courses", tr: "Ana yemekler", ar: "الأطباق الرئيسية", ru: "Основные блюда", it: "Secondi piatti", fr: "Plats principaux" },
  salate: { en: "Salads", tr: "Salatalar", ar: "السلطات", ru: "Салаты", it: "Insalate", fr: "Salades" },
  suppen: { en: "Soups", tr: "Çorbalar", ar: "الشوربات", ru: "Супы", it: "Zuppe", fr: "Soupes" },
  beilagen: { en: "Sides", tr: "Garnitürler", ar: "الأطباق الجانبية", ru: "Гарниры", it: "Contorni", fr: "Accompagnements" },
  sides: { en: "Sides", tr: "Garnitürler", ar: "الأطباق الجانبية", ru: "Гарниры", it: "Contorni", fr: "Accompagnements" },
  extras: { en: "Extras", tr: "Ekstralar", ar: "إضافات", ru: "Дополнения", it: "Extra", fr: "Suppléments" },
  dessert: { en: "Dessert", tr: "Tatlı", ar: "الحلويات", ru: "Десерт", it: "Dessert", fr: "Dessert" },
  desserts: { en: "Desserts", tr: "Tatlılar", ar: "الحلويات", ru: "Десерты", it: "Dolci", fr: "Desserts" },
  fisch: { en: "Fish", tr: "Balık", ar: "السمك", ru: "Рыба", it: "Pesce", fr: "Poisson" },
  fleisch: { en: "Meat", tr: "Et", ar: "اللحوم", ru: "Мясо", it: "Carne", fr: "Viandes" },
  schnitzel: { en: "Schnitzel", tr: "Şnitzel", ar: "شنيتزل", ru: "Шницель", it: "Schnitzel", fr: "Schnitzel" },
  flammkuchen: { en: "Flammkuchen", tr: "Flammkuchen", ar: "تارت ألماني (فلامكوخن)", ru: "Тарт-фламбе", it: "Tarte flambée", fr: "Tarte flambée" },
  fruhstuck: { en: "Breakfast", tr: "Kahvaltı", ar: "الإفطار", ru: "Завтрак", it: "Colazione", fr: "Petit-déjeuner" },
  kindermenu: { en: "Kids menu", tr: "Çocuk menüsü", ar: "قائمة الأطفال", ru: "Детское меню", it: "Menù bambini", fr: "Menu enfants" },
  sossen: { en: "Sauces", tr: "Soslar", ar: "الصلصات", ru: "Соусы", it: "Salse", fr: "Sauces" },
  sosse: { en: "Sauce", tr: "Sos", ar: "صلصة", ru: "Соус", it: "Salsa", fr: "Sauce" },
  vegan: { en: "Vegan", tr: "Vegan", ar: "نباتي صرف", ru: "Веганское", it: "Vegano", fr: "Végan" },
  vegetarisch: { en: "Vegetarian", tr: "Vejetaryen", ar: "نباتي", ru: "Вегетарианское", it: "Vegetariano", fr: "Végétarien" },
  snacks: { en: "Snacks", tr: "Atıştırmalıklar", ar: "وجبات خفيفة", ru: "Закуски", it: "Snack", fr: "Snacks" },
  sonstiges: { en: "Other", tr: "Diğer", ar: "متفرقات", ru: "Прочее", it: "Altro", fr: "Autres" },
  alle: { en: "All", tr: "Tümü", ar: "الكل", ru: "Все", it: "Tutti", fr: "Tous" },

  // Drinks
  drinks: { en: "Drinks", tr: "İçecekler", ar: "المشروبات", ru: "Напитки", it: "Bevande", fr: "Boissons" },
  getranke: { en: "Drinks", tr: "İçecekler", ar: "المشروبات", ru: "Напитки", it: "Bevande", fr: "Boissons" },
  softdrinks: { en: "Soft drinks", tr: "Alkolsüz içecekler", ar: "المشروبات الغازية", ru: "Безалкогольные", it: "Bibite", fr: "Boissons gazeuses" },
  heissgetranke: { en: "Hot drinks", tr: "Sıcak içecekler", ar: "المشروبات الساخنة", ru: "Горячие напитки", it: "Bevande calde", fr: "Boissons chaudes" },
  kaffee: { en: "Coffee", tr: "Kahve", ar: "القهوة", ru: "Кофе", it: "Caffè", fr: "Café" },
  tee: { en: "Tea", tr: "Çay", ar: "الشاي", ru: "Чай", it: "Tè", fr: "Thé" },
  safte: { en: "Juices", tr: "Meyve suları", ar: "العصائر", ru: "Соки", it: "Succhi", fr: "Jus" },
  wasser: { en: "Water", tr: "Su", ar: "الماء", ru: "Вода", it: "Acqua", fr: "Eau" },
  bier: { en: "Beer", tr: "Bira", ar: "البيرة", ru: "Пиво", it: "Birra", fr: "Bière" },
  bierevomfass: { en: "Draught beer", tr: "Fıçı bira", ar: "بيرة بالبرميل", ru: "Разливное пиво", it: "Birra alla spina", fr: "Bière pression" },
  flaschenbiere: { en: "Bottled beer", tr: "Şişe bira", ar: "بيرة بالزجاجة", ru: "Бутылочное пиво", it: "Birra in bottiglia", fr: "Bière en bouteille" },
  apfelwein: { en: "Cider", tr: "Elma şarabı", ar: "نبيذ التفاح (سيدر)", ru: "Сидр", it: "Sidro", fr: "Cidre" },
  wein: { en: "Wine", tr: "Şarap", ar: "النبيذ", ru: "Вино", it: "Vino", fr: "Vin" },
  weine: { en: "Wines", tr: "Şaraplar", ar: "النبيذ", ru: "Вина", it: "Vini", fr: "Vins" },
  aperitif: { en: "Aperitif", tr: "Aperatif", ar: "مشروبات ما قبل الوجبة", ru: "Аперитив", it: "Aperitivo", fr: "Apéritif" },
  longdrinks: { en: "Longdrinks", tr: "Longdrink", ar: "مشروبات طويلة", ru: "Лонг-дринки", it: "Longdrink", fr: "Longdrinks" },
  spirituosen: { en: "Spirits", tr: "Sert içecekler", ar: "المشروبات الروحية", ru: "Спиртные напитки", it: "Distillati", fr: "Spiritueux" },
};

/** Kategorie-Lookup mit Normalisierung. Unbekannte / custom Kategorien
 *  fallen auf den Original-Namen zurück (z.B. Restaurant-eigene Sektionen). */
export function tCategory(name: string, locale: string | null | undefined): string {
  if (!locale || locale === "de" || !(locale in MENU_STRINGS)) return name;
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) return name;
  const key = normalizeKategorieKey(name);
  const entry = CATEGORY_TRANSLATIONS[key];
  if (!entry) return name;
  const translated = entry[locale as SupportedLocale];
  return translated ?? name;
}

/** Allergen-Namen LMIV §1169/2011 Annex II + alltagstaugliche Varianten.
 *  Key = lowercased DE-Term, Wert = Lokalisierungen (DE = Key selbst). */
/** Die 14 LMIV-Allergene mit deutschem UI-Label. Schlüssel = Wert in der
 *  `menu_items.allergens`-Spalte (text[]). Reihenfolge = Dashboard-Anzeige. */
export const LMIV_ALLERGENS: ReadonlyArray<{ key: string; de: string }> = [
  { key: "gluten", de: "Gluten" },
  { key: "krebstiere", de: "Krebstiere" },
  { key: "eier", de: "Eier" },
  { key: "fisch", de: "Fisch" },
  { key: "erdnuesse", de: "Erdnüsse" },
  { key: "soja", de: "Soja" },
  { key: "milch", de: "Milch/Laktose" },
  { key: "schalenfruechte", de: "Schalenfrüchte" },
  { key: "sellerie", de: "Sellerie" },
  { key: "senf", de: "Senf" },
  { key: "sesam", de: "Sesam" },
  { key: "sulfite", de: "Schwefeldioxid/Sulfite" },
  { key: "lupinen", de: "Lupinen" },
  { key: "weichtiere", de: "Weichtiere" },
];

/** Schnell-Lookup: LMIV-Schlüssel → deutsches Label. */
export const LMIV_ALLERGEN_KEYS: ReadonlyArray<string> = LMIV_ALLERGENS.map((a) => a.key);
const LMIV_ALLERGEN_DE = new Map(LMIV_ALLERGENS.map((a) => [a.key, a.de]));

const ALLERGEN_NAMES: Record<string, Partial<Record<SupportedLocale, string>>> = {
  // 14 LMIV-Schlüssel — vollständig in allen 7 Sprachen
  gluten: { de: "Gluten", en: "Gluten", tr: "Gluten", ar: "غلوتين", ru: "Глютен", it: "Glutine", fr: "Gluten" },
  krebstiere: { de: "Krebstiere", en: "Crustaceans", tr: "Kabuklular", ar: "قشريات", ru: "Ракообразные", it: "Crostacei", fr: "Crustacés" },
  eier: { de: "Eier", en: "Eggs", tr: "Yumurta", ar: "بيض", ru: "Яйца", it: "Uova", fr: "Œufs" },
  fisch: { de: "Fisch", en: "Fish", tr: "Balık", ar: "سمك", ru: "Рыба", it: "Pesce", fr: "Poisson" },
  erdnuesse: { de: "Erdnüsse", en: "Peanuts", tr: "Yer fıstığı", ar: "فول سوداني", ru: "Арахис", it: "Arachidi", fr: "Arachides" },
  soja: { de: "Soja", en: "Soy", tr: "Soya", ar: "صويا", ru: "Соя", it: "Soia", fr: "Soja" },
  milch: { de: "Milch/Laktose", en: "Milk", tr: "Süt", ar: "حليب", ru: "Молоко", it: "Latte", fr: "Lait" },
  schalenfruechte: { de: "Schalenfrüchte", en: "Tree nuts", tr: "Sert kabuklu yemişler", ar: "مكسرات", ru: "Орехи", it: "Frutta a guscio", fr: "Fruits à coque" },
  sellerie: { de: "Sellerie", en: "Celery", tr: "Kereviz", ar: "كرفس", ru: "Сельдерей", it: "Sedano", fr: "Céleri" },
  senf: { de: "Senf", en: "Mustard", tr: "Hardal", ar: "خردل", ru: "Горчица", it: "Senape", fr: "Moutarde" },
  sesam: { de: "Sesam", en: "Sesame", tr: "Susam", ar: "سمسم", ru: "Кунжут", it: "Sesamo", fr: "Sésame" },
  sulfite: { de: "Schwefeldioxid/Sulfite", en: "Sulphites", tr: "Sülfit", ar: "كبريتيت", ru: "Сульфиты", it: "Solfiti", fr: "Sulfites" },
  lupinen: { de: "Lupinen", en: "Lupin", tr: "Acı bakla", ar: "ترمس", ru: "Люпин", it: "Lupino", fr: "Lupin" },
  weichtiere: { de: "Weichtiere", en: "Molluscs", tr: "Yumuşakçalar", ar: "رخويات", ru: "Моллюски", it: "Molluschi", fr: "Mollusques" },
  // Legacy-Aliases für Freitext-Übersetzung (allergens_text-Rückwärtskompatibilität)
  weizen: { en: "Wheat", tr: "Buğday", ar: "قمح", ru: "Пшеница", it: "Grano", fr: "Blé" },
  laktose: { en: "Lactose", tr: "Laktoz", ar: "لاكتوز", ru: "Лактоза", it: "Lattosio", fr: "Lactose" },
  ei: { en: "Egg", tr: "Yumurta", ar: "بيض", ru: "Яйцо", it: "Uovo", fr: "Œuf" },
  erdnüsse: { en: "Peanuts", tr: "Yer fıstığı", ar: "فول سوداني", ru: "Арахис", it: "Arachidi", fr: "Arachides" },
  nüsse: { en: "Nuts", tr: "Sert kabuklu yemişler", ar: "مكسرات", ru: "Орехи", it: "Frutta a guscio", fr: "Fruits à coque" },
  schalenfrüchte: { en: "Tree nuts", tr: "Sert kabuklu yemişler", ar: "مكسرات", ru: "Орехи", it: "Frutta a guscio", fr: "Fruits à coque" },
  haselnuss: { en: "Hazelnut", tr: "Fındık", ar: "بندق", ru: "Фундук", it: "Nocciola", fr: "Noisette" },
  mandel: { en: "Almond", tr: "Badem", ar: "لوز", ru: "Миндаль", it: "Mandorla", fr: "Amande" },
  schwefeldioxid: { en: "Sulphur dioxide", tr: "Kükürt dioksit", ar: "ثاني أكسيد الكبريت", ru: "Диоксид серы", it: "Anidride solforosa", fr: "Anhydride sulfureux" },
  alkohol: { en: "Alcohol", tr: "Alkol", ar: "كحول", ru: "Алкоголь", it: "Alcol", fr: "Alcool" },
};

/** Übersetzt einen Array von LMIV-Schlüsseln in einen komma-separierten Text
 *  in der Gast-Locale. Unbekannte Schlüssel werden übersprungen. */
export function translateAllergensArray(
  keys: readonly string[] | null | undefined,
  locale: string | null | undefined,
): string {
  if (!keys || keys.length === 0) return "";
  const lc: SupportedLocale =
    locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale)
      ? (locale as SupportedLocale)
      : "de";
  const names = keys
    .map((k) => {
      const key = k.trim().toLowerCase();
      const entry = ALLERGEN_NAMES[key];
      if (entry?.[lc]) return entry[lc];
      // Fallback DE-Label direkt aus LMIV-Liste (weniger Sprachwechsel-Bugs)
      return LMIV_ALLERGEN_DE.get(key) ?? key;
    })
    .filter((s): s is string => typeof s === "string" && s.length > 0);
  if (names.length === 0) return "";
  const prefix = ALLERGEN_TEXT_PREFIX[lc] ?? (lc === "de" ? "Enthält" : "Contains");
  return `${prefix}: ${names.join(", ")}`;
}

/** Übersetzbarer Prefix für Allergen-Anzeige ("Enthält: …"). */
const ALLERGEN_TEXT_PREFIX: Partial<Record<SupportedLocale, string>> = {
  de: "Enthält",
  en: "Contains",
  tr: "İçerir",
  ar: "يحتوي على",
  ru: "Содержит",
  it: "Contiene",
  fr: "Contient",
};

/** Übersetzt `allergens_text`-Strings im Format "Enthält: X, Y, Z" oder
 *  "Allergene: X, Y" auf die Gast-Locale. Bei `de` oder unbekannter Locale:
 *  unverändert zurück. Bei nicht erkanntem Format: ebenfalls Original.
 *  Einzelne Allergen-Tokens die nicht in ALLERGEN_NAMES liegen, bleiben
 *  unverändert (z.B. Restaurant-eigene Hinweise). */
export function translateAllergenText(
  raw: string | null | undefined,
  locale: string | null | undefined,
): string {
  if (!raw) return raw ?? "";
  const text = raw.trim();
  if (!text) return text;
  if (!locale || locale === "de" || !(locale in MENU_STRINGS)) return text;
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) return text;
  const lc = locale as SupportedLocale;

  const m = text.match(/^(Enthält|Allergene)\s*[:\s]\s*(.+)$/i);
  if (!m) return text;

  const items = m[2]
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) return text;

  const translatedItems = items.map((item) => {
    const key = item.toLowerCase();
    const entry = ALLERGEN_NAMES[key];
    return entry?.[lc] ?? item;
  });

  const prefix = ALLERGEN_TEXT_PREFIX[lc] ?? "Contains";
  return `${prefix}: ${translatedItems.join(", ")}`;
}
