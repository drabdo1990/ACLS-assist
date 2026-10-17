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

  // ---- Event log ----
  'ev.start': 'تفعيل نداء الإنعاش (Code Blue)', // draft — clinician review required
  'ev.start.detail': 'تم التعرف على توقف القلب — بدء الإنعاش (CPR)', // draft — clinician review required
  'ev.compressions': 'بدء الضغطات الصدرية', // draft — clinician review required
  'ev.compressions.detail': 'المعدل 100–120/min، العمق 5–6 cm، ارتداد كامل للصدر', // draft — clinician review required
  'ev.pause': 'إيقاف مؤقت للإنعاش (CPR)', // draft — clinician review required
  'ev.resume': 'استئناف الإنعاش (CPR)', // draft — clinician review required
  'ev.cycle': 'اكتملت الدورة {n}', // draft — clinician review required
  'ev.cycle.detail': 'فحص النظم / تبديل القائم بالضغطات', // draft — clinician review required
  'ev.cycle.detailRhythm': 'النظم: {rhythm} · تبديل القائم بالضغطات', // draft — clinician review required
  'ev.rhythmCheck': 'فحص النظم — {rhythm}', // draft — clinician review required
  'ev.branch': 'مسار النظم: {branch}', // draft — clinician review required
  'ev.rosc': 'إعلان عودة الدورة الدموية التلقائية (ROSC)', // draft — clinician review required
  'ev.rosc.detail': 'إجمالي مدة التوقف: {durationMs}. إجمالي الصدمات: {shocks}. إجمالي Epinephrine: {epiMg} mg.', // draft — clinician review required
  'ev.end': 'إنهاء الإنعاش', // draft — clinician review required
  'ev.end.detail': 'أُوقف الإنعاش · المدة الإجمالية {durationMs}', // draft — clinician review required
  'ev.rearrest': 'توقف قلبي متكرر', // draft — clinician review required
  'ev.epi': 'Epinephrine 1 mg IV/IO', // draft — clinician review required
  'ev.epi.detail': 'الجرعة رقم {n} · دفع 20 mL NS ورفع الذراع 10–20 s · تُكرر كل 3–5 min', // draft — clinician review required
  'ev.shock': 'إزالة الرجفان: الصدمة رقم {n} ({joules}J {waveform})', // draft — clinician review required
  'ev.shock.nonshockable': 'سُجّلت أثناء المسار غير القابل للصدمة', // draft — clinician review required
  'ev.amio': 'Amiodarone {mg} mg IV/IO', // draft — clinician review required
  'ev.dose.first': 'الجرعة الأولى', // draft — clinician review required
  'ev.dose.second': 'الجرعة الثانية', // draft — clinician review required
  'ev.dose.additional': 'جرعة إضافية', // draft — clinician review required
  'ev.lido': 'Lidocaine {minMg}–{maxMg} mg IV/IO', // draft — clinician review required
  'ev.lido.detail': 'الجرعة رقم {n} · {perKg} ({kg} kg) · التراكمي ≥ {cumMg} من حد أقصى {maxMg} mg (3 mg/kg)', // draft — clinician review required
  'ev.lido.detailExceeds':
    'الجرعة رقم {n} · {perKg} ({kg} kg) · التراكمي ≥ {cumMg} من حد أقصى {maxMg} mg (3 mg/kg) · يتجاوز 3 mg/kg', // draft — clinician review required
  'ev.mag': 'Magnesium sulfate 1–2 g IV/IO', // draft — clinician review required
  'ev.mag.detail': 'Torsades de pointes', // draft — clinician review required
  'ev.airway': 'وضع مجرى هواء متقدم — {airway}', // draft — clinician review required
  'ev.airway.detail': 'ضغطات مستمرة + نَفَس واحد كل 6 s (10/min)', // draft — clinician review required
  'ev.airwayOff': 'إلغاء تسجيل مجرى الهواء المتقدم', // draft — clinician review required
  'ev.airwayOff.detail': 'العودة إلى ضغطات/تهوية 30:2', // draft — clinician review required
  'ev.causeOn': 'تمت معالجة السبب — {cause}', // draft — clinician review required
  'ev.causeOff': 'أُلغي تحديد السبب — {cause}', // draft — clinician review required
  'ev.pocusOn': 'POCUS — {item}', // draft — clinician review required
  'ev.pocusOff': 'أُلغي تحديد POCUS — {item}', // draft — clinician review required
  'ev.pulseCheck': 'فحص النبض — لا يوجد نبض', // draft — clinician review required
  'ev.pulseCheck.detail': 'متابعة الإنعاش (CPR)', // draft — clinician review required
  'ev.postRosc.on': 'رعاية ما بعد ROSC: {item}', // draft — clinician review required
  'ev.postRosc.off': 'رعاية ما بعد ROSC (أُلغي التحديد): {item}', // draft — clinician review required

  // ---- Pediatric events ----
  'ev.pedsStart.measured': 'نداء إنعاش أطفال — {kg} kg (مقاس)', // draft — clinician review required
  'ev.pedsStart.estimated': 'نداء إنعاش أطفال — {kg} kg (تقديري، العمر {years} y)', // draft — clinician review required
  'ev.pedsStart.estimatedMonths': 'نداء إنعاش أطفال — {kg} kg (تقديري، العمر {months} m)', // draft — clinician review required
  'ev.pedsStart.noWeight': 'نداء إنعاش أطفال — الوزن غير محدد', // draft — clinician review required
  'ev.weight.set.measured': 'تم تحديد الوزن — {kg} kg (مقاس)', // draft — clinician review required
  'ev.weight.set.estimated': 'تم تحديد الوزن — {kg} kg (تقديري، العمر {years} y)', // draft — clinician review required
  'ev.weight.set.estimatedMonths': 'تم تحديد الوزن — {kg} kg (تقديري، العمر {months} m)', // draft — clinician review required
  'ev.weight.corrected.measured': 'تم تصحيح الوزن — {kg} kg (مقاس)', // draft — clinician review required
  'ev.weight.corrected.estimated': 'تم تصحيح الوزن — {kg} kg (تقديري، العمر {years} y)', // draft — clinician review required
  'ev.weight.corrected.estimatedMonths': 'تم تصحيح الوزن — {kg} kg (تقديري، العمر {months} m)', // draft — clinician review required
  'ev.pedsEpi': 'Epinephrine {mg} mg IV/IO', // draft — clinician review required
  'ev.pedsEpi.detail': 'الجرعة رقم {n} · 0.01 mg/kg ({kg} kg)', // draft — clinician review required
  'ev.pedsEpi.noWeight': 'أُعطي Epinephrine — الجرعة غير محسوبة (لا يوجد وزن)', // draft — clinician review required
  'ev.pedsEpi.noWeight.detail': 'الجرعة رقم {n} · حدد الوزن لحساب الجرعات', // draft — clinician review required
  'ev.pedsAmio.noWeight': 'أُعطي Amiodarone — الجرعة غير محسوبة (لا يوجد وزن)', // draft — clinician review required
  'ev.pedsLido': 'Lidocaine {mg} mg IV/IO', // draft — clinician review required
  'ev.pedsLido.detail': 'الجرعة رقم {n} · 1 mg/kg ({kg} kg)', // draft — clinician review required
  'ev.pedsLido.noWeight': 'أُعطي Lidocaine — الجرعة غير محسوبة (لا يوجد وزن)', // draft — clinician review required
  'ev.pedsMag': 'Magnesium sulfate {minMg}–{maxMg} mg IV/IO', // draft — clinician review required
  'ev.pedsMag.noWeight': 'أُعطي Magnesium — الجرعة غير محسوبة (لا يوجد وزن)', // draft — clinician review required

  // ---- Pediatric idle toggle + weight card ----
  'peds.toggle': 'الفئة', // draft — clinician review required
  'peds.toggle.adult': 'بالغ', // draft — clinician review required
  'peds.toggle.pediatric': 'أطفال', // draft — clinician review required
  'peds.previewNotice': 'معاينة — ليس للاستخدام السريري حتى يعتمدها طبيب مختص', // draft — clinician review required
  'peds.weight.title': 'الوزن', // draft — clinician review required
  'peds.weight.notSet': 'الوزن غير محدد', // draft — clinician review required
  'peds.weight.summary.measured': '{kg} kg (مقاس)', // draft — clinician review required
  'peds.weight.summary.estimated': '≈ {kg} kg (تقديري، {years} y)', // draft — clinician review required
  'peds.weight.summary.estimatedMonths': '≈ {kg} kg (تقديري، {months} m)', // draft — clinician review required
  'peds.weight.estimateFromAge': 'التقدير حسب العمر', // draft — clinician review required
  'peds.weight.measuredChips': 'الوزن المقاس (kg)', // draft — clinician review required
  'peds.age.newborn': 'حديث الولادة', // draft — clinician review required
  'peds.age.months': '{months} شهر', // draft — clinician review required
  'peds.age.years': '{years} سنة', // draft — clinician review required
  'peds.badge.measured': 'أطفال · {kg} kg', // draft — clinician review required
  'peds.badge.estimated': 'أطفال · ≈{kg} kg (تقديري)', // draft — clinician review required
  'peds.badge.noWeight': 'أطفال · حدد الوزن', // draft — clinician review required
  'peds.setWeightBanner': 'حدد الوزن — حساب الجرعات يحتاج وزنًا', // draft — clinician review required
  'peds.setWeight': 'حدد الوزن', // draft — clinician review required
  'peds.grid.logNoWeight': 'سجّل — الجرعة غير محسوبة', // draft — clinician review required
  'peds.grid.epi.logNoWeight': 'سجّل Epinephrine — الجرعة غير محسوبة', // draft — clinician review required
  'peds.grid.shock.logNoWeight': 'سجّل الصدمة — أدخل الطاقة', // draft — clinician review required
  'peds.grid.shock.manualNote': 'الوزن غير محدد — اختر الطاقة المضبوطة على جهاز الصدمات. لم تُحسب J/kg.', // draft — clinician review required
  'peds.grid.mag.logNoWeight': 'سجّل Magnesium — الجرعة غير محسوبة', // draft — clinician review required
  'peds.grid.epi.title': 'Epi {mg} mg = {mL} mL', // draft — clinician review required
  'peds.grid.shock.title': 'صدمة', // draft — clinician review required
  'peds.grid.shock.jkg': '{joules} J · {perKg} J/kg', // draft — clinician review required
  'peds.grid.shock.chip2': '2 J/kg', // draft — clinician review required
  'peds.grid.shock.chip4': '4 J/kg', // draft — clinician review required
  'peds.grid.shock.escalate': 'تصعيد ≤ 10 J/kg', // draft — clinician review required
  'peds.grid.energyNote': 'استخدم أقرب قيمة متاحة تساوي أو تقل عن المطلوب', // draft — clinician review required
  'peds.grid.amio.title': 'Amiodarone {mg} mg · 5 mg/kg', // draft — clinician review required
  'peds.grid.lido.title': 'Lidocaine {mg} mg · 1 mg/kg', // draft — clinician review required
  'peds.grid.mag.title': 'Mg {minMg}–{maxMg} mg', // draft — clinician review required
  'peds.max': '(حد أقصى)', // draft — clinician review required
  'peds.grid.epi.flush': 'IV/IO + دفع بمحلول ملحي', // draft — clinician review required
  'peds.roscBanner.sub': 'SpO₂ 94–99% · تجنب SBP دون المئين الخامس للعمر — فتح القائمة', // draft — clinician review required
  'app.title.pediatric': 'قيادة إنعاش الأطفال (PALS)', // draft — clinician review required
  'peds.vent.none': 'ضغطات صدرية بنسبة {ratio} — التوقف للتهوية فقط', // draft — clinician review required

  // ---- Event param values ----
  'rhythm.VF': 'رجفان بطيني (VF)', // draft — clinician review required
  'rhythm.pVT': 'تسرع بطيني عديم النبض (pVT)', // draft — clinician review required
  'rhythm.PEA': 'نشاط كهربائي عديم النبض (PEA)', // draft — clinician review required
  'rhythm.Asystole': 'توقف الانقباض (Asystole)', // draft — clinician review required
  'rhythm.Pulse': 'يوجد نبض', // draft — clinician review required
  'branch.shockable': 'قابل للصدمة (VF / pVT)', // draft — clinician review required
  'branch.nonshockable': 'غير قابل للصدمة (Asystole / PEA)', // draft — clinician review required
  'waveform.biphasic': 'ثنائية الطور', // draft — clinician review required
  'waveform.monophasic': 'أحادية الطور', // draft — clinician review required
  'waveform.select': 'شكل الموجة', // draft — clinician review required
  'airway.ETT': 'ETT',
  'airway.SGA': 'مجرى هواء فوق المزمار (SGA)', // draft — clinician review required

  // ---- CPR guidance cards (adult values; pediatric profile has its own keys) ----
  'cpr.adult.ratio': '30:2',
  'cpr.adult.depth': 'العمق 5–6 cm، ارتداد كامل للصدر', // draft — clinician review required
  'cpr.adult.rate': 'المعدل 100–120/min', // draft — clinician review required
  'cpr.adult.airway': 'ضغطات متواصلة + نَفَس واحد كل 6 s (10/min)', // draft — clinician review required

  // ---- Pediatric CPR / ventilation (values from content/profiles/pediatric.ts — clinician review required) ----
  'p.cpr.ratio': '15:2 (منقذان) / 30:2 (منقذ واحد)', // draft — clinician review required
  'p.cpr.depth': 'حوالي ثلث عمق الصدر (≈4 cm للرضيع، ≈5 cm للطفل)', // draft — clinician review required
  'p.cpr.rate': 'المعدل 100–120/min', // draft — clinician review required
  'p.cpr.airway': 'ضغطات متواصلة + نفسة كل 2–3 s (20–30/min)', // draft — clinician review required

  // ---- Pediatric algorithm ----
  'p.algo.title.shockable': 'رجفان بطيني / تسرع بطيني عديم النبض عند الأطفال (VF / pVT)', // draft — clinician review required
  'p.algo.title.nonshockable': 'توقف قلبي عند الأطفال — Asystole / PEA', // draft — clinician review required
  'p.algo.ongoing.shockable': 'الصدمة عند كل فحص نظم كل دقيقتين طالما استمر VF/pVT · Epinephrine كل 3–5 min.', // draft — clinician review required
  'p.algo.ongoing.nonshockable': 'CPR لمدة دقيقتين ← إعادة فحص النظم · Epinephrine كل 3–5 min.', // draft — clinician review required
  'p.algo.step.shock1': 'صدمة — 2 J/kg', // draft — clinician review required
  'p.algo.step.shock2': 'صدمة — 4 J/kg', // draft — clinician review required
  'p.algo.step.shock3': 'صدمة — ≥ 4 J/kg', // draft — clinician review required
  'p.algo.step.epi': 'CPR لمدة دقيقتين + Epinephrine 0.01 mg/kg · النظر في مجرى هواء متقدم', // draft — clinician review required
  'p.algo.step.aa': 'CPR لمدة دقيقتين + Amiodarone 5 mg/kg أو Lidocaine 1 mg/kg · معالجة H’s و T’s', // draft — clinician review required
  'p.algo.step.nonshockableEpi': 'CPR لمدة دقيقتين + Epinephrine 0.01 mg/kg بأسرع وقت', // draft — clinician review required
  'p.algo.step.access': 'IV/IO + مجرى هواء متقدم + قياس ثاني أكسيد الكربون (capnography)', // draft — clinician review required

  // ---- Pediatric post-ROSC bundle ----
  'pPostRosc.spo2': 'SpO₂ 94–99% — تجنب فرط الأكسجة', // draft — clinician review required
  'pPostRosc.co2': 'CO₂ طبيعي — تحقق بواسطة قياس CO₂ الزفيري (capnography) أو غازات الدم', // draft — clinician review required
  'pPostRosc.bp': 'تجنب انخفاض ضغط الدم (SBP دون المئين الخامس للعمر) — سوائل أو موسعات وعائية حسب البروتوكول المحلي', // draft — clinician review required
  'pPostRosc.temp': 'معالجة الحمى؛ التحكم بالحرارة حسب البروتوكول المحلي', // draft — clinician review required
  'pPostRosc.glucose': 'فحص السكر وتصحيحه', // draft — clinician review required
  'pPostRosc.ecg': 'تخطيط قلب 12-lead / إيكو حسب الحاجة', // draft — clinician review required
  'pPostRosc.seizure': 'مراقبة التشنجات ومعالجتها', // draft — clinician review required
  'pPostRosc.picu': 'النقل إلى العناية المركزة للأطفال (PICU)؛ إكمال السجل؛ مناقشة الفريق (debrief)', // draft — clinician review required

  // ---- Algorithm (prompts and steps) ----
  'algo.title.none': 'اختيار مسار النظم', // draft — clinician review required
  'algo.ongoing.none': 'وصل جهاز المراقبة / مزيل الرجفان، فحص النظم، ثم اختيار قابل أو غير قابل للصدمة.', // draft — clinician review required
  'algo.title.shockable': 'رجفان بطيني / تسرع بطيني عديم النبض (VF / pVT)', // draft — clinician review required
  'algo.ongoing.shockable1':
    'صدمة عند كل فحص دوري (كل دقيقتين) ما دام VF/pVT مستمراً · Epinephrine كل 3–5 min · جرعة ثانية من Amiodarone 150 mg (أو Lidocaine 0.5–0.75 mg/kg كل 5–10 min، أقصى جرعة 3 mg/kg).', // draft — clinician review required
  'algo.ongoing.shockable2':
    'صدمة عند كل فحص دوري (كل دقيقتين) ما دام VF/pVT مستمراً · Epinephrine كل 3–5 min · معالجة الأسباب H’s و T’s.', // draft — clinician review required
  'algo.title.nonshockable': 'سكون القلب / نشاط كهربائي عديم النبض (Asystole / PEA)', // draft — clinician review required
  'algo.ongoing.nonshockable':
    'إنعاش قلبي رئوي (CPR) لمدة دقيقتين ← إعادة فحص النظم · Epinephrine كل 3–5 min · إذا أصبح قابلاً للصدمة، بدّل المسار واصدم.', // draft — clinician review required
  'algo.step.shock1': 'صدمة رقم 1', // draft — clinician review required
  'algo.step.cpr1': 'CPR لمدة دقيقتين · وصول وريدي/عظمي (IV/IO)', // draft — clinician review required
  'algo.step.shock2': 'صدمة رقم 2', // draft — clinician review required
  'algo.step.shockableEpi': 'CPR لمدة دقيقتين + Epinephrine 1 mg · النظر في مجرى هواء متقدم', // draft — clinician review required
  'algo.step.shock3': 'صدمة رقم 3', // draft — clinician review required
  'algo.step.aa': 'CPR لمدة دقيقتين + Amiodarone 300 mg / Lidocaine · معالجة H’s و T’s', // draft — clinician review required
  'algo.step.nonshockableEpi': 'CPR لمدة دقيقتين + Epinephrine 1 mg بأسرع ما يمكن', // draft — clinician review required
  'algo.step.access': 'مدخل IV/IO · النظر في مجرى هواء متقدم + قياس CO₂ الزفيري (capnography)', // draft — clinician review required
  'algo.step.causes': 'تحديد الأسباب القابلة للعكس (H’s و T’s)', // draft — clinician review required

  // ---- SBAR ----
  'sbar.title': 'ResusCode — ملخص الإنعاش', // draft — clinician review required
  'sbar.generated': 'تاريخ التقرير: {date}', // draft — clinician review required
  'sbar.totalArrestTime': 'إجمالي مدة التوقف: {clock}', // draft — clinician review required
  'sbar.outcome': 'النتيجة: {outcome}', // draft — clinician review required
  'sbar.outcome.none': 'لم يتم تسجيل توقف للقلب', // draft — clinician review required
  'sbar.phiNotice': '(خالٍ من المعلومات الصحية المحمية PHI — لم تُسجَّل أي بيانات تعريفية للمريض)', // draft — clinician review required
  'sbar.section.situation': '=== الوضع ===', // draft — clinician review required
  'sbar.section.background': '=== الخلفية ===', // draft — clinician review required
  'sbar.section.assessment': '=== التقييم ===', // draft — clinician review required
  'sbar.section.stats': '=== إحصاءات النداء ===', // draft — clinician review required
  'sbar.section.postRosc': '=== رعاية ما بعد ROSC ===', // draft — clinician review required
  'sbar.section.recommendations': '=== التوصيات ===', // draft — clinician review required
  'sbar.section.timeline': '=== التسلسل الزمني ===', // draft — clinician review required
  'sbar.situation.adultArrest': 'توقف قلبي داخل المستشفى لدى مريض بالغ — وفق بروتوكول ACLS (SHA 2024، المتوافق مع AHA/ERC).', // draft — clinician review required
  'sbar.situation.activated': 'تم تفعيل النداء في {time}. مدة التوقف: {duration}.', // draft — clinician review required
  'sbar.situation.durationRel': 'مدة التوقف: {duration}.', // draft — clinician review required
  'sbar.situation.roscAt': 'تحققت ROSC في [{clock}] ({time}).', // draft — clinician review required
  'sbar.situation.roscAtRel': 'تحققت ROSC في [{clock}].', // draft — clinician review required
  'sbar.situation.none': 'لم يتم تسجيل توقف للقلب.', // draft — clinician review required
  'sbar.branch': 'مسار النظم: {branch}', // draft — clinician review required
  'sbar.branch.none': 'لم يتم الاختيار', // draft — clinician review required
  'sbar.branch.shockable': 'قابل للصدمة (VF / pVT)', // draft — clinician review required
  'sbar.branch.nonshockable': 'غير قابل للصدمة (Asystole / PEA)', // draft — clinician review required
  'sbar.cycles': 'دورات الإنعاش (CPR) المكتملة: {n}', // draft — clinician review required
  'sbar.airway.placed': 'مجرى هواء متقدم: تم وضع {type} (ضغطات مستمرة + نَفَس واحد كل 6 s)', // draft — clinician review required
  'sbar.airway.ett': 'ETT', // draft — clinician review required
  'sbar.airway.sga': 'مجرى هواء فوق المزمار (SGA)', // draft — clinician review required
  'sbar.airway.none': 'مجرى هواء متقدم: لم يُوضع (30:2)', // draft — clinician review required
  'sbar.shocks': 'الصدمات المقدمة: {n}', // draft — clinician review required
  'sbar.epi': 'Epinephrine: {count} {doses} (إجمالي {mg} mg)', // draft — clinician review required
  'sbar.epi.dose': 'جرعة', // draft — clinician review required
  'sbar.epi.doses': 'جرعات', // draft — clinician review required
  'sbar.amio': 'جرعات Amiodarone: {count}{details}', // draft — clinician review required
  'sbar.lido': 'جرعات Lidocaine: {count}{details}', // draft — clinician review required
  'sbar.lido.weight': ' (الجرعة حسب الوزن {kg} kg)', // draft — clinician review required
  'sbar.mag': 'جرعات Magnesium sulfate: {count}', // draft — clinician review required
  'sbar.rhythms': 'النظم الموثقة: {rhythms}', // draft — clinician review required
  'sbar.noneRecorded': 'لم يُسجَّل شيء', // draft — clinician review required
  'sbar.shocks.energies': 'طاقات إزالة الرجفان: {energies}', // draft — clinician review required
  'sbar.causes': 'الأسباب القابلة للعكس المعالجة: {causes}', // draft — clinician review required
  'sbar.pocus': 'نتائج POCUS: {findings}', // draft — clinician review required
  'sbar.stats.training': 'تدريب / محاكاة — ليس مريضاً حقيقياً', // draft — clinician review required
  'sbar.stats.voided': 'ملغى — مُستبعَد من الإحصاءات', // draft — clinician review required
  'sbar.stats.over5': ' ⚠ يتجاوز 5 دقائق', // draft — clinician review required
  'sbar.postRosc.completed': 'المكتمل ({done}/{total}):', // draft — clinician review required
  'sbar.postRosc.pending': 'لم تُسجَّل بعد:', // draft — clinician review required
  'sbar.postRosc.noneRecorded': '  (لم يُسجَّل شيء)', // draft — clinician review required
  'sbar.postRosc.none': '  (لا يوجد)', // draft — clinician review required
  'sbar.rec.rosc1': '- حزمة ما بعد ROSC: تأمين مجرى الهواء (ETT)، SpO₂ 92–98%، تجنب فرط التهوية.', // draft — clinician review required
  'sbar.rec.rosc2': '- انخفاض الضغط: سوائل IV حتى 2 L، ثم dopamine 5–10 mcg/kg/min (أو norepinephrine/epinephrine)؛ الهدف MAP ≥ 65 mmHg.', // draft — clinician review required
  'sbar.rec.rosc3': '- تخطيط قلب 12-lead — مختبر القسطرة عند STEMI؛ في حال عدم الاستجابة، ضبط الحرارة 32–37.5 °C لمدة 12–24 h.', // draft — clinician review required
  'sbar.rec.rosc4': '- تصحيح الغلوكوز > 10 mmol/L، الشوارد والحماض؛ النقل إلى ICU/CCU؛ جلسة استخلاص الفريق (debrief).', // draft — clinician review required
  'sbar.rec.terminated': '- توثيق وقت إنهاء الإنعاش / التسليم؛ التواصل مع العائلة؛ جلسة استخلاص الفريق (debrief).', // draft — clinician review required
  'sbar.peds.situation': 'توقف قلبي داخل المستشفى لدى طفل — وفق بروتوكول PALS (SHA).', // draft — clinician review required
  'sbar.peds.weight.measured': 'الوزن {kg} kg (مقاس).', // draft — clinician review required
  'sbar.peds.weight.estimated': 'الوزن ≈{kg} kg (تقديري من العمر {years} y).', // draft — clinician review required
  'sbar.peds.weight.estimatedMonths': 'الوزن ≈{kg} kg (تقديري من العمر {months} m).', // draft — clinician review required
  'sbar.peds.weight.none': 'الوزن غير محدد — الجرعات غير محسوبة.', // draft — clinician review required
  'sbar.peds.epi': 'Epinephrine: {count} × 0.01 mg/kg {details}', // draft — clinician review required
  'sbar.peds.amio': 'Amiodarone: {count} × 5 mg/kg {details}', // draft — clinician review required
  'sbar.peds.lido': 'Lidocaine: {count} × 1 mg/kg {details}', // draft — clinician review required
  'sbar.peds.dosesNotCalculated': 'جرعات غير محسوبة', // draft — clinician review required
  'sbar.peds.rec.rosc1': '- SpO₂ 94–99% — تجنب فرط الأكسجة؛ CO₂ طبيعي.', // draft — clinician review required
  'sbar.peds.rec.rosc2': '- تجنب انخفاض الضغط (SBP دون المئين الخامس للعمر) — سوائل أو موسعات وعائية حسب البروتوكول المحلي.', // draft — clinician review required
  'sbar.peds.rec.rosc3': '- تخطيط قلب 12-lead / إيكو عند الحاجة؛ معالجة الحمى وضبط الحرارة حسب البروتوكول المحلي.', // draft — clinician review required
  'sbar.peds.rec.rosc4': '- فحص السكر وتصحيحه؛ مراقبة التشنجات؛ النقل إلى PICU؛ مناقشة الفريق (debrief).', // draft — clinician review required
  'sbar.rec.none': '- لم يتم تسجيل إنعاش.', // draft — clinician review required
  'sbar.timeline.empty': '(لا توجد أحداث)', // draft — clinician review required

  // ---- Status & Outcomes ----
  'status.idle': 'لم يبدأ', // draft — clinician review required
  'status.active': 'قيد التنفيذ — الإنعاش (CPR) مستمر', // draft — clinician review required
  'status.paused': 'قيد التنفيذ — الإنعاش (CPR) متوقف مؤقتاً', // draft — clinician review required
  'status.rosc': 'تحققت ROSC', // draft — clinician review required
  'status.terminated': 'أُنهي الإنعاش', // draft — clinician review required
  'outcome.rosc': 'تحققت ROSC', // draft — clinician review required
  'outcome.rosc_then_terminated': 'تحققت ROSC ثم أُنهي الإنعاش', // draft — clinician review required
  'outcome.terminated': 'أُنهي دون ROSC', // draft — clinician review required
  'outcome.incomplete': 'غير مكتمل (لم يُنهَ النداء)', // draft — clinician review required

  // ---- Statistics Panel & Formatter ----
  'stats.outcome': 'النتيجة', // draft — clinician review required
  'stats.population': 'الفئة', // draft — clinician review required
  'stats.pop.pediatric': 'أطفال (PALS — SHA)', // draft — clinician review required
  'stats.weight': 'الوزن', // draft — clinician review required
  'stats.weight.measured': '{kg} kg (مقاس)', // draft — clinician review required
  'stats.weight.estimated': '≈ {kg} kg (تقديري من العمر {years} y)', // draft — clinician review required
  'stats.weight.estimatedMonths': '≈ {kg} kg (تقديري من العمر {months} m)', // draft — clinician review required
  'stats.notCalculated': ' ({count} غير محسوبة)', // draft — clinician review required
  'stats.episodes': ' ({count} نوبة ROSC)', // draft — clinician review required
  'stats.arrestTime': 'مدة التوقف (باستثناء فترات ROSC)', // draft — clinician review required
  'stats.firstRosc': 'أول ROSC', // draft — clinician review required
  'stats.firstShock': 'أول صدمة', // draft — clinician review required
  'stats.firstEpi': 'أول إبينفرين', // draft — clinician review required
  'stats.firstEpi.branch': ' (مسار {branch})', // draft — clinician review required
  'stats.branch.shockable': 'قابل للصدمة', // draft — clinician review required
  'stats.branch.nonshockable': 'غير قابل للصدمة', // draft — clinician review required
  'stats.shocks': 'الصدمات', // draft — clinician review required
  'stats.epiDoses': 'جرعات الإبينفرين', // draft — clinician review required
  'stats.epiInterval': 'فترة الإبينفرين (المتوسط / الأطول)', // draft — clinician review required
  'stats.amiodarone': 'Amiodarone', // draft — clinician review required
  'stats.lidoDoses': 'جرعات Lidocaine', // draft — clinician review required
  'stats.magDoses': 'جرعات Magnesium', // draft — clinician review required
  'stats.cycles': 'دورات CPR المكتملة', // draft — clinician review required
  'stats.pausedTime': 'الوقت المسجل كإيقاف مؤقت', // draft — clinician review required
  'stats.airway': 'مجرى هواء متقدم', // draft — clinician review required
  'stats.airway.sga': 'مجرى هواء فوق المزمار في {time}', // draft — clinician review required
  'stats.airway.ett': 'ETT في {time}', // draft — clinician review required
  'stats.rhythms': 'النظم الموثقة', // draft — clinician review required
  'stats.causes': 'الأسباب المعالجة (H’s & T’s)', // draft — clinician review required
  'stats.pocus': 'نتائج POCUS', // draft — clinician review required
  'stats.postRosc': 'حزمة رعاية ما بعد ROSC', // draft — clinician review required
  'stats.postRosc.recorded': '{done}/{total} تم تسجيلها', // draft — clinician review required
  'stats.timeNote': 'الأوقات من تفعيل النداء، كما تم تسجيلها.', // draft — clinician review required

  // ---- History Panel & Formatter ----
  'history.status.local': 'على هذا الجهاز فقط', // draft — clinician review required
  'history.status.queued': 'في انتظار الإرسال', // draft — clinician review required
  'history.status.sent': 'تم الإرسال ✓', // draft — clinician review required
  'history.status.sent_unconfirmed': 'تم الإرسال (غير مؤكد)', // draft — clinician review required
  'history.status.failed': 'ستتم إعادة المحاولة', // draft — clinician review required
  'history.status.rejected': 'مرفوض من الجدول', // draft — clinician review required
  'history.flag.training': 'تدريب', // draft — clinician review required
  'history.flag.void': 'ملغى', // draft — clinician review required
  'history.flag.pediatric': 'أطفال', // draft — clinician review required
  'history.agg.adult': 'نداءات البالغين ({n})', // draft — clinician review required
  'history.agg.pediatric': 'نداءات الأطفال ({n})', // draft — clinician review required
  'history.agg.codesCounted': 'النداءات المحتسبة', // draft — clinician review required
  'history.agg.incomplete': '{count} غير مكتمل', // draft — clinician review required
  'history.agg.excluded': '{count} تدريب/ملغى', // draft — clinician review required
  'history.agg.anyRosc': 'أي ROSC', // draft — clinician review required
  'history.agg.ratio': '{count} من {total}', // draft — clinician review required
  'history.agg.medianFirstEpi': 'وسيط أول إبينفرين', // draft — clinician review required
  'history.agg.medianFirstShock': 'وسيط أول صدمة', // draft — clinician review required
  'history.agg.medianArrest': 'وسيط مدة التوقف', // draft — clinician review required

  // ---- Upload & Rejection Labels ----
  'upload.reject.key': 'التسجيل غير صالح — اتصل بالمسؤول', // draft — clinician review required
  'upload.reject.update': 'حدّث التطبيق', // draft — clinician review required
  'upload.reject.size': 'السجل كبير جداً بالنسبة للجدول — اتصل بالمسؤول', // draft — clinician review required
  'upload.test.notEnrolled': 'هذا الجهاز غير مسجل بعد.', // draft — clinician review required
  'upload.test.sent': 'تم التسليم والتأكيد ✓ — يجب أن يظهر صف تجريبي في الجدول الآن.', // draft — clinician review required
  'upload.test.sentUnconfirmed': 'تم الإرسال، لكن هذا المتصفح لا يستطيع قراءة الرد، لذا لم يتم تأكيد التسليم. تحقق من الجدول لرؤية الصف التجريبي.', // draft — clinician review required
  'upload.test.offline': 'أنت غير متصل بالإنترنت — حاول مرة أخرى عند الاتصال.', // draft — clinician review required
  'upload.test.notJson': 'أجاب البرنامج النصي بصفحة خطأ. تحقق من ضبط النشر على "أي شخص" وأنه أحدث إصدار.', // draft — clinician review required
  'upload.test.failed': 'تعذر الوصول إلى البرنامج النصي ({reason}).', // draft — clinician review required

  // ---- App Shell ----
  'app.title': 'قيادة إنعاش البالغين (ACLS)', // draft — clinician review required
  'app.offline': 'دون اتصال', // draft — clinician review required
  'app.settings': 'الإعدادات', // draft — clinician review required
  'app.wake.titleActive': 'الشاشة لن تنطفئ', // draft — clinician review required
  'app.wake.titleIdle': 'منع انطفاء الشاشة غير مفعّل', // draft — clinician review required
  'app.wake.titleUnsupported': 'منع انطفاء الشاشة غير مدعوم في هذا المتصفح', // draft — clinician review required
  'app.wake.active': 'مستيقظة', // draft — clinician review required
  'app.wake.idle': 'خامل', // draft — clinician review required
  'app.wake.unsupported': 'غير متاح', // draft — clinician review required
  'app.restored.title': 'تمت استعادة الجلسة من الزيارة السابقة', // draft — clinician review required
  'app.restored.fresh': 'بدء من جديد', // draft — clinician review required
  'app.restored.dismiss': 'إغلاق', // draft — clinician review required
  'app.restored.stale':
    'الجلسة المحفوظة عمرها {hours} ساعة — قد تكون لنداء إنعاش سابق. ابدأ من جديد، أو احتفظ بها لمراجعتها.', // draft — clinician review required
  'app.restored.freshSession':
    'تمت استعادة الجلسة من هذا الجهاز — المؤقتات مستمرة وفق الطوابع الزمنية المحفوظة.', // draft — clinician review required
  'app.disclaimer':
    'أداة مساعدة لدعم القرار السريري فقط، مستندة إلى دليل مقدم خدمة ACLS الصادر عن جمعية القلب السعودية 2024 (المتوافق مع AHA/ERC). تحقق من كل جرعة وفقاً للبروتوكول المحلي. ليست بديلاً عن التقدير السريري. خالية من المعلومات الصحية المحمية (PHI) — لا تُسجَّل أي بيانات تعريفية للمريض. تبقى البيانات على هذا الجهاز ما لم يتم تسجيل وحدتك لرفع بيانات الإنعاش (الإعدادات).', // draft — clinician review required
  'tab.hud': 'شاشة التحكم (HUD)', // draft — clinician review required
  'tab.causes': 'الأسباب (H’s & T’s)', // draft — clinician review required
  'tab.log': 'السجل و SBAR', // draft — clinician review required

  // ---- HUD Screen & Master Clock ----
  'hud.roscBanner.title': 'حزمة رعاية ما بعد ROSC', // draft — clinician review required
  'hud.roscBanner.sub': 'MAP ≥ 65 · SpO₂ 92–98% · تخطيط 12-lead · TTM — فتح القائمة', // draft — clinician review required
  'hud.clock.status.standby': 'جاهزية', // draft — clinician review required
  'hud.clock.status.active': 'توقف قلبي نشط', // draft — clinician review required
  'hud.clock.status.paused': 'توقف قلبي نشط · موقوف مؤقتاً', // draft — clinician review required
  'hud.clock.status.rosc': 'تحققت ROSC', // draft — clinician review required
  'hud.clock.status.terminated': 'أُنهي الإنعاش', // draft — clinician review required
  'hud.clock.elapsed': 'إجمالي وقت التوقف', // draft — clinician review required

  // ---- Controls ----
  'hud.ctrl.startCode': 'بدء نداء الإنعاش', // draft — clinician review required
  'hud.ctrl.startCodeSub': 'بدء ساعة التوقف ودورة الدقيقتين وسجل الأحداث', // draft — clinician review required
  'hud.ctrl.reviewCode': 'مراجعة النداء', // draft — clinician review required
  'hud.ctrl.reviewCodeSub': 'السجل و SBAR', // draft — clinician review required
  'hud.ctrl.newCode': 'نداء جديد', // draft — clinician review required
  'hud.ctrl.newCodeSub': 'استمرار بالضغط 2.5 ثانية — مسح الجلسة', // draft — clinician review required
  'hud.ctrl.rearrest': 'توقف قلبي متكرر', // draft — clinician review required
  'hud.ctrl.rearrestSub': 'استئناف CPR', // draft — clinician review required
  'hud.ctrl.pause': 'إيقاف مؤقت', // draft — clinician review required
  'hud.ctrl.resume': 'استئناف', // draft — clinician review required
  'hud.ctrl.rosc': 'تحققت ROSC', // draft — clinician review required
  'hud.ctrl.end': 'إنهاء / مراجعة النداء', // draft — clinician review required
  'hud.ctrl.endSub': 'استمرار بالضغط ثانيتين — إنهاء وفتح السجل', // draft — clinician review required

  // ---- Cycle Panel ----
  'hud.cycle.title': 'دورة CPR لمدة دقيقتين', // draft — clinician review required
  'hud.cycle.index': 'الدورة {n}', // draft — clinician review required
  'hud.cycle.awaiting': 'بانتظار البدء', // draft — clinician review required
  'hud.cycle.stopped': 'الدورة متوقفة', // draft — clinician review required
  'hud.cycle.complete': 'اكتملت الدورة', // draft — clinician review required
  'hud.cycle.remaining': 'الوقت المتبقي للدورة', // draft — clinician review required
  'hud.cycle.rhythmCheck': 'فحص النظم', // draft — clinician review required
  'hud.cycle.switchCompressors': 'تبديل القائم بالضغطات', // draft — clinician review required
  'hud.cycle.logRhythm': 'تسجيل النظم — إعادة ضبط الدورة', // draft — clinician review required
  'hud.cycle.resetBtn': 'إعادة ضبط دورة الدقيقتين', // draft — clinician review required
  'hud.cycle.subtext': 'ساعة التوقف مستمرة · طول الدورة {length} s', // draft — clinician review required

  // ---- Intervention Grid ----
  'hud.grid.title': 'تدخلات ACLS', // draft — clinician review required
  'hud.grid.vent.ett': 'ضغطات صدرية مستمرة + نَفَس واحد كل 6 ثوانٍ (10 أنفاس/دقيقة)', // draft — clinician review required
  'hud.grid.vent.none': 'ضغطات : تهوية بنسبة 30:2 — التوقف للتهوية فقط', // draft — clinician review required
  'hud.grid.epi.next': 'الجرعة التالية من Epi بعد {lockout}', // draft — clinician review required
  'hud.grid.epi.eligible': 'حان موعد الجرعة — اضغط للتسجيل', // draft — clinician review required
  'hud.grid.epi.flush': 'IV/IO + دفع 20 mL NS', // draft — clinician review required
  'hud.grid.shock.title': 'صدمة', // draft — clinician review required
  'hud.grid.shock.titleCount': 'صدمة · ×{n}', // draft — clinician review required
  'hud.grid.shock.last': 'آخر صدمة: #{n} {joules}J', // draft — clinician review required
  'hud.grid.shock.select': 'اختيار الطاقة', // draft — clinician review required
  'hud.grid.shock.deliver': 'إعطاء الصدمة رقم {n} · {joules}J', // draft — clinician review required
  'hud.grid.shock.waveformSub': '{waveform} — تسجيل وطابع زمني', // draft — clinician review required
  'hud.grid.amio.sub1': 'الجرعة الأولى ← التالية 150 mg', // draft — clinician review required
  'hud.grid.amio.sub2': 'الجرعة الثانية (بولوس أخير)', // draft — clinician review required
  'hud.grid.amio.subMax': 'أُعطي بولوسان كحد أقصى', // draft — clinician review required
  'hud.grid.lido.exceeds': '⚠ يتجاوز الحد الأقصى 3 mg/kg (المُعطى {given} من {max} mg)', // draft — clinician review required
  'hud.grid.lido.sub': 'جرعة {n} · {perKg}{interval} لوزن {kg} kg', // draft — clinician review required
  'hud.grid.airwayPlaced': 'تم وضع مجرى هواء {type}', // draft — clinician review required
  'hud.grid.ett': 'تم وضع ETT', // draft — clinician review required
  'hud.grid.ettSub': 'مجرى هواء متقدم', // draft — clinician review required
  'hud.grid.sga': 'تم وضع SGA', // draft — clinician review required
  'hud.grid.sgaSub': 'فوق المزمار', // draft — clinician review required
  'hud.grid.airwayActiveSub': 'ضغطات مستمرة مفعلة · اضغط للإلغاء', // draft — clinician review required
  'hud.grid.energyTitle': 'طاقة إزالة الرجفان', // draft — clinician review required
  'hud.grid.shock.waveformLabel': 'شكل الموجة', // draft — clinician review required
  'hud.grid.epiInterval': 'فاصل تكرار جرعة Epi', // draft — clinician review required
  'hud.grid.mgIndication': 'Torsades', // draft — clinician review required
  'hud.grid.logNoPulse': 'تسجيل غياب النبض', // draft — clinician review required
  'hud.grid.undo': 'تراجع عن آخر إدخال', // draft — clinician review required

  // ---- Metronome ----
  'hud.metro.title': 'إيقاع CPR (Metronome)', // draft — clinician review required
  'hud.metro.audio': 'الصوت', // draft — clinician review required
  'hud.metro.vibrate': 'الاهتزاز', // draft — clinician review required
  'hud.metro.paused': 'الإيقاع موقوف مؤقتاً', // draft — clinician review required
  'hud.metro.on': 'الإيقاع يعمل', // draft — clinician review required
  'hud.metro.off': 'الإيقاع متوقف', // draft — clinician review required
  'hud.metro.audioOn': 'تشغيل الصوت', // draft — clinician review required
  'hud.metro.audioOff': 'إيقاف الصوت', // draft — clinician review required
  'hud.metro.vibrateOn': 'تشغيل الاهتزاز', // draft — clinician review required
  'hud.metro.vibrateOff': 'إيقاف الاهتزاز', // draft — clinician review required
  'hud.metro.dec': 'تقليل السرعة', // draft — clinician review required
  'hud.metro.inc': 'زيادة السرعة', // draft — clinician review required
  'hud.metro.noHaptics': 'الاهتزاز غير متاح على هذا الجهاز (iOS) — التنبيهات الصوتية تعمل.', // draft — clinician review required
  'hud.metro.accentNote': 'نغمة مميزة كل 10 نبضات للمساعدة في العد.', // draft — clinician review required

  // ---- Rhythm Branch ----
  'hud.branch.title': 'مسار النظم', // draft — clinician review required
  'hud.branch.shockable.title': 'قابل للصدمة', // draft — clinician review required
  'hud.branch.shockable.sub': 'VF / VT عديم النبض', // draft — clinician review required
  'hud.branch.nonshockable.title': 'غير قابل للصدمة', // draft — clinician review required
  'hud.branch.nonshockable.sub': 'Asystole / PEA', // draft — clinician review required
  'hud.branch.then': 'ثم:', // draft — clinician review required

  // ---- UI Controls & Notices ----
  'ui.hold.confirm': 'استمر بالضغط للتأكيد', // draft — clinician review required
  'ui.status.soundOff': 'كتم الصوت — اضغط هنا', // draft — clinician review required
  'ui.status.notSaved': 'غير محفوظ', // draft — clinician review required
  'ui.status.storageWarning': 'مساحة التخزين غير متاحة أو ممتلئة — إعادة تحميل الصفحة ستؤدي لفقدان الجلسة', // draft — clinician review required
  'ui.clockNotice.text': 'تحديث: ساعة التوقف تستمر في العمل أثناء الإيقاف المؤقت للإنعاش — تُستثنى فترات ROSC فقط.', // draft — clinician review required
  'ui.clockNotice.dismiss': 'حسناً', // draft — clinician review required
  'ui.weight.title': 'وزن تحديد الجرعة', // draft — clinician review required
  'ui.weight.dec': 'إنقاص الوزن', // draft — clinician review required
  'ui.weight.inc': 'زيادة الوزن', // draft — clinician review required
  'ui.weight.set': 'تعيين هذا الوزن', // draft — clinician review required

  // ---- Causes & POCUS ----
  'causes.title': 'الأسباب القابلة للعكس — 6 H’s و 5 T’s', // draft — clinician review required
  'causes.group.H': '6 H’s — أسباب قابلة للعكس', // draft — clinician review required
  'causes.group.T': '5 T’s — أسباب قابلة للعكس', // draft — clinician review required
  'pocus.title': 'الموجات فوق الصوتية في نقطة الرعاية (POCUS)', // draft — clinician review required
  'pocus.warning': 'الفحص أثناء فحص النظم فقط — لا تُطِل التوقف أكثر من 10 ثوانٍ أبداً.', // draft — clinician review required
  'postRosc.title': 'حزمة رعاية ما بعد ROSC', // draft — clinician review required

  // ---- Code Stats Panel & Flags ----
  'stats.title': 'إحصاءات نداء الإنعاش', // draft — clinician review required
  'stats.voidedNotice': 'ملغى — محفوظ في السجل، مستثنى من الإحصاءات', // draft — clinician review required
  'stats.trainingActive': 'تدريب / محاكاة ✓', // draft — clinician review required
  'stats.markTraining': 'تحديد كتدريب', // draft — clinician review required
  'stats.restore': 'استعادة (إلغاء الإلغاء)', // draft — clinician review required
  'stats.voidLabel': 'إلغاء هذا النداء', // draft — clinician review required
  'stats.voidSub': 'استمرار بالضغط ثانيتين — يُحفظ ويُستثنى من الإحصاءات', // draft — clinician review required
  'stats.voidSubPast': 'استمرار بالضغط ثانيتين — محفوظ، مستثنى من الإحصاءات', // draft — clinician review required

  // ---- History Panel ----
  'history.title': 'السجل التاريخي · {count} نداء', // draft — clinician review required
  'history.empty': 'لا توجد نداءات منتهية على هذا الجهاز بعد. يُحفظ النداء هنا بمجرد انتهائه أو إعادة ضبطه.', // draft — clinician review required
  'history.showFewer': 'عرض أقل', // draft — clinician review required
  'history.showAll': 'عرض الكل ({count})', // draft — clinician review required
  'history.exportCsv': 'تصدير CSV', // draft — clinician review required
  'history.clearHistory': 'مسح السجل التاريخي', // draft — clinician review required
  'history.clearHistorySub': 'استمرار بالضغط 2.5 ثانية', // draft — clinician review required
  'history.retentionNote': 'يُحفظ حتى 500 نداء على هذا الجهاز — إحصاءات فقط، دون سجل الأحداث.', // draft — clinician review required

  // ---- SBAR Debrief Export ----
  'sbar.exportTitle': 'تصدير تقرير SBAR', // draft — clinician review required
  'sbar.copied': 'تم النسخ إلى الحافظة', // draft — clinician review required
  'sbar.copyBtn': 'نسخ ملخص إنعاش SBAR', // draft — clinician review required
  'sbar.copySub': 'تقرير نصي جاهز للصق في السجل الطبي الإلكتروني', // draft — clinician review required
  'sbar.downloadBtn': 'تنزيل ملف .txt', // draft — clinician review required
  'sbar.previewBtn': 'معاينة', // draft — clinician review required
  'sbar.hidePreview': 'إخفاء المعاينة', // draft — clinician review required
  'sbar.resetBtn': 'إعادة ضبط الجلسة', // draft — clinician review required
  'sbar.resetSub':
    'استمر بالضغط 2.5 ثانية لمسح النداء الحالي من الشاشة. النداءات المنتهية تبقى في السجل التاريخي على هذا الجهاز.', // draft — clinician review required
  'sbar.exportLang': 'لغة التقرير', // draft — clinician review required

  // ---- Timeline & Log Screen ----
  'timeline.all': 'الكل', // draft — clinician review required
  'timeline.drugs': 'الأدوية', // draft — clinician review required
  'timeline.shocks': 'الصدمات', // draft — clinician review required
  'timeline.cycles': 'الدورات', // draft — clinician review required
  'timeline.rhythm': 'النظم', // draft — clinician review required
  'timeline.airway': 'مجرى الهواء', // draft — clinician review required
  'timeline.causes': 'الأسباب (H’s & T’s)', // draft — clinician review required
  'timeline.oldestFirst': 'الأقدم أولاً', // draft — clinician review required
  'timeline.newestFirst': 'الأحدث أولاً', // draft — clinician review required
  'timeline.empty': 'لم يتم تسجيل أي أحداث بعد.', // draft — clinician review required
  'log.title': 'سجل الأحداث · {count} حدث', // draft — clinician review required

  // ---- Settings sheet ----
  'settings.title': 'الإعدادات',
  'settings.close': 'إغلاق الإعدادات',
  'settings.upload.title': 'رفع بيانات النداءات',
  'settings.upload.enrolled': 'مسجَّل',
  'settings.upload.waiting': 'بانتظار الإرسال: {n}',
  'settings.upload.nothingWaiting': 'لا شيء بانتظار الإرسال.',
  'settings.upload.sending': 'جارٍ الإرسال…',
  'settings.upload.sendTest': 'إرسال سجل تجريبي',
  'settings.upload.stop': 'إيقاف الرفع',
  'settings.upload.stopSub': 'اضغط مطولاً 2 ثانية — لهذا الجهاز فقط',
  'settings.upload.off': 'الرفع متوقف. تبقى النداءات على هذا الجهاز. يمكن لمسؤول وحدتك تزويدك برابط أو رمز تسجيل.',
  'settings.backfill.title': 'نداءات سابقة',
  'settings.backfill.ask': 'إرسال النداءات السابقة (الإحصاءات فقط)؟ العدد: {n}',
  'settings.backfill.send': 'إرسال',
  'settings.backfill.notNow': 'ليس الآن',
  'settings.enroll.title': 'التسجيل برمز',
  'settings.enroll.field': 'الصق رمز التسجيل أو الرابط',
  'settings.enroll.placeholder': 'https://…#enroll=…  أو الرمز بعد #enroll=',
  'settings.enroll.invalid': 'هذا الرمز غير صالح.',
  'settings.enroll.check': 'التحقق من الرمز',
  'settings.history.title': 'السجل على هذا الجهاز',
  'settings.retention.all': 'الاحتفاظ بالكل',
  'settings.retention.last': 'الاحتفاظ بآخر…',
  'settings.retention.afterUpload': 'الحذف بعد الرفع',
  'settings.retention.note':
    'يُحتفظ بما يصل إلى 500 نداء. خيار «الحذف بعد الرفع» يزيل النداء من هذا الجهاز فقط بعد أن يؤكد الجدول استلامه.',
  'settings.device.title': 'هذا الجهاز',
  'settings.device.id': 'معرّف الجهاز',
  'settings.device.note':
    'معرّف عشوائي أُنشئ على هذا الجهاز. عند التسجيل، تُرسل النداءات المنتهية إحصاءاتها وتاريخ ووقت البدء ووحدتك وملخصاً بأوقات نسبية. لا تُسجَّل أي معرّفات للمرضى أبداً.', // draft — clinician review required (consent wording)

  // ---- Enrollment (consent wording) ----
  'enroll.enroll': 'تسجيل',
  'enroll.cancel': 'إلغاء',
  'enroll.dismiss': 'إغلاق',
  'enroll.linkInvalid': 'رابط التسجيل هذا غير صالح وتم تجاهله.',
  'enroll.confirmTitle': 'تسجيل هذا الجهاز لرفع بيانات النداءات؟',
  'enroll.notice':
    'عند التسجيل، تُرسل إحصاءات كل نداء منتهٍ (الأوقات، الصدمات، الأدوية، النتيجة) وتاريخ ووقت بدئه ووحدتك وملخصاً بأوقات نسبية — دون أي معرّفات للمرضى — إلى جدول Google الخاص بالمسؤول الذي أصدر هذا الرمز.', // draft — clinician review required (consent wording)
  'enroll.destination': 'الوجهة',
  'enroll.unit': 'الوحدة',
  'enroll.replacing': 'سيحل هذا محل تسجيلك الحالي.',
  'enroll.nothingSent': 'لا يُرسل أي شيء حتى تضغط «تسجيل». يمكنك الإيقاف في أي وقت من الإعدادات.', // draft — clinician review required (consent wording)

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
    'تخطيط قلب 12-lead بعد ROSC؛ PCI إسعافي / مختبر القسطرة (أو حلّ الخثرة)؛ النظر في eCPR.', // draft — clinician review required

  // ---- POCUS ----
  'pocus.effusion.view': 'المسار تحت الخنجري / أسفل الضلوع', // draft — clinician review required
  'pocus.effusion.label': 'انصباب تاموري', // draft — clinician review required
  'pocus.effusion.meaning': 'مع انخماص البطين الأيمن ← دكاك: بزل التامور.', // draft — clinician review required
  'pocus.rv_strain.view': 'المسار تحت الخنجري / أسفل الضلوع', // draft — clinician review required
  'pocus.rv_strain.label': 'توسع / إجهاد البطين الأيمن', // draft — clinician review required
  'pocus.rv_strain.meaning': 'RV ≥ LV ← النظر في انصمام رئوي كبير: حلّ الخثرة.', // draft — clinician review required
  'pocus.contractility.view': 'المسار تحت الخنجري / أسفل الضلوع', // draft — clinician review required
  'pocus.contractility.label': 'انقباض منسق (PEA كاذب)', // draft — clinician review required
  'pocus.contractility.meaning': 'نشاط منظم دون نبض ← تعزيز رافعات الضغط، والبحث عن السبب.', // draft — clinician review required
  'pocus.standstill.view': 'المسار تحت الخنجري / أسفل الضلوع', // draft — clinician review required
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
  'postRosc.ecg': 'تخطيط قلب 12-lead — STEMI ← مختبر القسطرة؛ يحدد ICU أو CCU', // draft — clinician review required
  'postRosc.neuro':
    'عدم الاستجابة: ضبط الحرارة 32–37.5 °C لمدة 12–24 h؛ السيطرة على الاختلاج؛ المحافظة على تروية الدماغ', // draft — clinician review required
  'postRosc.glucose': 'تصحيح الغلوكوز > 10 mmol/L ومنع نقص السكر', // draft — clinician review required
  'postRosc.cause': 'تصحيح الشوارد ونقص الأكسجة والحماض — مراجعة الأسباب H’s و T’s', // draft — clinician review required
  'postRosc.vitals': 'علامات حيوية متكررة؛ الإبلاغ فوراً عن أي تدهور', // draft — clinician review required
  'postRosc.icu':
    'النقل عند الاستقرار والجاهزية إلى ICU / CCU؛ إكمال سجل الإنعاش؛ جلسة استخلاص (debrief)', // draft — clinician review required
};
