/**
 * Arabic messages. Drug names, doses and units stay Latin (Epinephrine 1 mg IV/IO, mg/kg, J).
 *
 * Every clinical string is marked `// draft — clinician review required`; see
 * docs/i18n/arabic-clinical-review.md. Until sign-off, AR_CLINICAL_REVIEWED stays false and the
 * app shows a notice that English is the reference.
 */
import type { MessageKey } from './en';

export const AR: Readonly<Record<MessageKey, string>> = {
  'lang.label': 'اللغة',
  'lang.en': 'English',
  'lang.ar': 'العربية',
  'i18n.draftNotice': 'النص السريري العربي مسودة بانتظار مراجعة طبية — النص الإنجليزي هو المرجع.',

  // ---- Reversible causes (H's & T's) ----
  'cause.hypoxia.label': 'نقص الأكسجة', // draft — clinician review required
  'cause.hypoxia.clue': 'مرض قلبي/رئوي مزمن، انسداد مجرى الهواء، انزياح الأنبوب؛ زُرقة.', // draft — clinician review required
  'cause.hypoxia.action':
    'مجرى هواء سالك، O₂ بتركيز 100%، تهوية بالقناع والكيس (BVM)، مجرى هواء متقدم؛ التأكيد بقياس CO₂ الزفيري (capnography).', // draft — clinician review required
  'cause.hypovolemia.label': 'نقص حجم الدم', // draft — clinician review required
  'cause.hypovolemia.clue': 'رضّ، نزف داخلي، فقد دم، حروق، قيء/إسهال؛ أوردة رقبة مسطحة.', // draft — clinician review required
  'cause.hypovolemia.action': 'سوائل سريعة IV/IO؛ نقل دم في حالة النزف.', // draft — clinician review required
  'cause.hypothermia.label': 'انخفاض حرارة الجسم', // draft — clinician review required
  'cause.hypothermia.clue': 'التعرض للبرد أو الغمر في ماء بارد، كبار السن، تسمم بالأدوية/الكحول.', // draft — clinician review required
  'cause.hypothermia.action': 'قياس الحرارة المركزية؛ سوائل IV دافئة وتدفئة فعّالة.', // draft — clinician review required
  'cause.hydrogen_ion.label': 'أيون الهيدروجين (الحماض)', // draft — clinician review required
  'cause.hydrogen_ion.clue': 'فشل كلوي، حماض كيتوني سكري (DKA)، جرعة زائدة (TCA، أسبرين، كوكايين، ديفينهيدرامين).', // draft — clinician review required
  'cause.hydrogen_ion.action': 'تهوية كافية؛ بيكربونات الصوديوم IV (≈1 mEq/kg)؛ غازات الدم ABG/VBG، اللاكتات.', // draft — clinician review required
  'cause.hypo_hyperkalemia.label': 'فرط / نقص بوتاسيوم الدم', // draft — clinician review required
  'cause.hypo_hyperkalemia.clue':
    'فشل كلوي، غسيل كلوي حديث، DKA، ACE-I/ARB؛ موجة T مدببة، QRS عريض، موجة جيبية.', // draft — clinician review required
  'cause.hypo_hyperkalemia.action':
    'فرط K: كلوريد الكالسيوم، غلوكوز + إنسولين، بيكربونات الصوديوم، ألبوتيرول بالرذاذ، مدرات، غسيل كلوي. نقص K: تعويض K⁺ / Mg²⁺.', // draft — clinician review required
  'cause.hypoglycemia.label': 'نقص سكر الدم', // draft — clinician review required
  'cause.hypoglycemia.clue': 'استخدام الإنسولين / السلفونيل يوريا، الكحول، فشل كلوي حاد، سكري النوع 1.', // draft — clinician review required
  'cause.hypoglycemia.action':
    'قياس الغلوكوز فوراً؛ المريض فاقد الوعي: غلوكاغون IV/IM (أو دكستروز IV حسب البروتوكول المحلي).', // draft — clinician review required
  'cause.tension_ptx.label': 'استرواح الصدر الضاغط', // draft — clinician review required
  'cause.tension_ptx.clue': 'رضّ، قثطرة مركزية، مريض على جهاز التنفس؛ غياب أصوات التنفس، ضغط مجرى هواء مرتفع.', // draft — clinician review required
  'cause.tension_ptx.action': 'تخفيف فوري بالإبرة أو فغر الصدر بالإصبع.', // draft — clinician review required
  'cause.tamponade.label': 'الدكاك القلبي (الانصباب التاموري الضاغط)', // draft — clinician review required
  'cause.tamponade.clue':
    'رضّ صدري، احتشاء حاد كبير، نزع أسلاك منظم القلب بعد CABG؛ انتفاخ الوريد الوداجي، أصوات قلب خافتة.', // draft — clinician review required
  'cause.tamponade.action': 'POCUS / إيكو؛ بزل التامور بتوجيه الإيكو.', // draft — clinician review required
  'cause.toxins.label': 'السموم', // draft — clinician review required
  'cause.toxins.clue': 'سوابق جرعة زائدة، تعاطي مواد، أفكار انتحارية، متلازمة سمية.', // draft — clinician review required
  'cause.toxins.action':
    'المحافظة على مجرى الهواء وإعطاء الترياق: نالوكسون (الأفيونات)، مستحلب دهني (LAST)، غلوكاغون / إنسولين بجرعة عالية (حاصرات β / CCB).', // draft — clinician review required
  'cause.thrombosis_pulmonary.label': 'الخثار (رئوي)', // draft — clinician review required
  'cause.thrombosis_pulmonary.clue': 'سوابق DVT/PE، عدم الحركة، جراحة حديثة، سرطان، حمل؛ PEA نموذجي.', // draft — clinician review required
  'cause.thrombosis_pulmonary.action':
    'حلّ الخثرة (تجريبياً عند الاشتباه بـ PE)، أو استئصال الصمة جراحياً / ميكانيكياً؛ النظر في eCPR.', // draft — clinician review required
  'cause.thrombosis_coronary.label': 'الخثار (تاجي)', // draft — clinician review required
  'cause.thrombosis_coronary.clue': 'مرض شرياني تاجي / احتشاء سابق، PCI أو CABG، ألم صدري قبل التوقف، VF معنّد.', // draft — clinician review required
  'cause.thrombosis_coronary.action':
    'تخطيط 12 اتجاهاً بعد ROSC؛ PCI إسعافي / مختبر القسطرة (أو حلّ الخثرة)؛ النظر في eCPR.', // draft — clinician review required

  // ---- POCUS ----
  'pocus.effusion.view': 'تحت الرهابة / جانب القص', // draft — clinician review required
  'pocus.effusion.label': 'انصباب تاموري', // draft — clinician review required
  'pocus.effusion.meaning': 'مع انخماص البطين الأيمن ← دكاك: بزل التامور.', // draft — clinician review required
  'pocus.rv_strain.view': 'تحت الرهابة / جانب القص', // draft — clinician review required
  'pocus.rv_strain.label': 'توسع / إجهاد البطين الأيمن', // draft — clinician review required
  'pocus.rv_strain.meaning': 'RV ≥ LV ← النظر في انصمام رئوي كبير: حلّ الخثرة.', // draft — clinician review required
  'pocus.contractility.view': 'تحت الرهابة / جانب القص', // draft — clinician review required
  'pocus.contractility.label': 'انقباض منسق (PEA كاذب)', // draft — clinician review required
  'pocus.contractility.meaning': 'نشاط منظم دون نبض ← تعزيز رافعات الضغط، والبحث عن السبب.', // draft — clinician review required
  'pocus.standstill.view': 'تحت الرهابة / جانب القص', // draft — clinician review required
  'pocus.standstill.label': 'توقف قلبي حقيقي (سكون)', // draft — clinician review required
  'pocus.standstill.meaning': 'لا حركة ← إنذار سيئ؛ يُستأنس به ولا يقرر وحده إنهاء الإنعاش.', // draft — clinician review required
  'pocus.lung_sliding.view': 'الصدر الأمامي (الجهتان)', // draft — clinician review required
  'pocus.lung_sliding.label': 'غياب انزلاق الرئة', // draft — clinician review required
  'pocus.lung_sliding.meaning': 'يرجّح استرواح الصدر الضاغط ← تخفيف الضغط (تأكد أولاً من التهوية في الجهتين).', // draft — clinician review required

  // ---- Post-ROSC bundle ----
  'postRosc.airway':
    'تحسين التهوية والأكسجة — ETT إن لم يوضع بعد؛ SpO₂ 92–98%؛ تجنب فرط التهوية', // draft — clinician review required
  'postRosc.bp':
    'انخفاض الضغط (SBP < 90): سوائل IV حتى 2 L، ثم Dopamine 5–10 mcg/kg/min (أو تسريب norepinephrine / epinephrine)؛ الهدف MAP ≥ 65', // draft — clinician review required
  'postRosc.ecg': 'تخطيط قلب 12 اتجاهاً — STEMI ← مختبر القسطرة؛ يحدد ICU أو CCU', // draft — clinician review required
  'postRosc.neuro':
    'عدم الاستجابة: ضبط الحرارة 32–37.5 °C لمدة 12–24 h؛ السيطرة على الاختلاج؛ المحافظة على تروية الدماغ', // draft — clinician review required
  'postRosc.glucose': 'تصحيح الغلوكوز > 10 mmol/L ومنع نقص السكر', // draft — clinician review required
  'postRosc.cause': 'تصحيح الشوارد ونقص الأكسجة والحماض — مراجعة الأسباب H’s و T’s', // draft — clinician review required
  'postRosc.vitals': 'علامات حيوية متكررة؛ الإبلاغ فوراً عن أي تدهور', // draft — clinician review required
  'postRosc.icu':
    'النقل عند الاستقرار والجاهزية إلى ICU / CCU؛ إكمال سجل الإنعاش؛ جلسة استخلاص (debrief)', // draft — clinician review required
};
