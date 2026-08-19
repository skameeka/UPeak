(function () {
  var STORAGE_KEY = "upeak_lang";
  var DEFAULT_LANG = "ru";

  var DICT = {
    ru: {
      "meta.landing.title": "Upeak — Исследование продуктивности",
      "meta.landing.description": "7-дневный пилот адаптивного планировщика по состоянию и нагрузке",
      "meta.planner.title": "PulseBurn Planner — Прототип",
      "meta.participate.title": "Upeak — Участие в эксперименте",
      "meta.participate.description": "Оставьте заявку на участие в 7-дневном пилоте Upeak",

      "nav.research": "Исследование",
      "nav.experiment": "Эксперимент",
      "nav.join": "Участвовать",
      "nav.lang.aria": "Язык интерфейса",

      "hero.eyebrow": "Исследовательский прототип",
      "hero.brand": "Upeak",
      "hero.title.line1": "Почему ты не успеваешь,",
      "hero.title.line2": "даже когда планируешь хорошо?",
      "hero.subtitle": "Мы проводим 7-дневный пилот адаптивного планировщика, который учитывает состояние, нагрузку и выполнение задач",
      "hero.cta.join": "Участвовать в эксперименте",
      "hero.cta.more": "Узнать больше",
      "hero.logo.alt": "Логотип Upeak",

      "problem.title.line1": "Люди планируют день одинаково,",
      "problem.title.line2": "но их состояние постоянно меняется",
      "problem.plan.title": "План",
      "problem.plan.desc": "Одинаковый каждый день",
      "problem.real.title": "Реальность",
      "problem.real.desc": "Разная энергия и стресс",
      "problem.result.title": "Результат",
      "problem.result.desc": "Перегруз и усталость",
      "problem.gap": "Из-за этого возникает разрыв между планом и возможностями",
      "problem.aim": "Мы хотим понять этот механизм",

      "research.title": "Что мы исследуем",
      "research.sleep": "Сон",
      "research.sleep.arrow": "→ Продуктивность",
      "research.stress": "Стресс",
      "research.stress.arrow": "→ Перегруз",
      "research.energy": "Энергия",
      "research.energy.arrow": "→ Выполнение задач",
      "research.plan": "План",
      "research.plan.arrow": "→ Реальность выполнения",

      "experiment.title": "Как проходит эксперимент",
      "experiment.duration": "7 дней",
      "experiment.duration.note": "два коротких чек-ина в день",
      "experiment.daily.title": "Каждый день",
      "experiment.daily.head": "План по состоянию",
      "experiment.daily.desc": "Утром оцениваешь состояние и распределяешь задачи, вечером закрываешь день и получаешь рекомендацию",
      "experiment.finish.title": "После 7 дней",
      "experiment.finish.head": "Короткий итоговый опрос",
      "experiment.finish.desc": "Расскажешь, что было полезно, что мешало и захотелось ли продолжить пользоваться планировщиком",
      "experiment.note": "Мы ищем первые сигналы полезности, а не обещаем доказанный эффект",

      "disclaimer.title": "Важное пояснение",
      "disclaimer.text1": "Это не готовый продукт, который уже всё решает.",
      "disclaimer.text2": "Это исследование, которое помогает нам понять поведение и построить более точную систему в будущем.",

      "cta.title": "Присоединиться к исследованию",
      "cta.subtitle": "Помоги нам понять, как люди работают на самом деле",

      "planner.eyebrow": "Исследовательский прототип",
      "planner.title": "Планировщик задач по состоянию",
      "planner.home": "На лендинг",

      "planner.morning.title": "1) Утренний чек-ин состояния",
      "planner.morning.sleepHours": "Сколько часов вы спали сегодня?",
      "planner.morning.sleepQuality": "Как вы оцениваете качество сна сегодня?",
      "planner.morning.energy": "Сегодня утром: насколько вы чувствовали усталость и мало энергии?",
      "planner.morning.stress": "Сегодня утром: насколько вы чувствовали нервное напряжение или стресс?",
      "planner.morning.sleepHoursPh": "Например, 7.5 ч",
      "planner.morning.sleepQualityPh": "1–5 (1 плохо, 5 отлично)",
      "planner.morning.energyPh": "1–5 (1 бодро, 5 очень тяжело)",
      "planner.morning.stressPh": "1–5 (1 спокойно, 5 сильный стресс)",
      "planner.scale.hours": "0–14 ч",
      "planner.scale.oneToFive": "1–5",
      "planner.scale.minutes": "5–360 мин",
      "planner.morning.note": "Комментарий",
      "planner.morning.notePh": "Коротко: как вы себя чувствуете",
      "planner.morning.save": "Сохранить чек-ин",
      "planner.readiness": "Состояние",

      "planner.tasks.title": "2) Задачи на день",
      "planner.tasks.task": "Задача",
      "planner.tasks.taskPh": "Например, подготовить презентацию",
      "planner.tasks.difficulty": "Сложность",
      "planner.tasks.urgency": "Срочность",
      "planner.tasks.difficultyPh": "1–5 (сложность)",
      "planner.tasks.urgencyPh": "1–5 (срочность)",
      "planner.tasks.duration": "Оценка времени",
      "planner.tasks.routine": "Рутина (базовая задача дня)",
      "planner.tasks.add": "Добавить задачу",
      "planner.tasks.saveEdit": "Сохранить изменения",
      "planner.tasks.cancelEdit": "Отменить редактирование",
      "planner.tasks.distribute": "Распределить по состоянию",
      "planner.tasks.scaleInvalid": "Укажите сложность и срочность от 1 до 5.",

      "planner.tasks.col.order": "№",
      "planner.tasks.col.status": "Статус",
      "planner.tasks.col.title": "Задача",
      "planner.tasks.col.diff": "Сложн.",
      "planner.tasks.col.urg": "Срочн.",
      "planner.tasks.col.min": "Мин",
      "planner.tasks.col.slot": "Рекомендованный слот",
      "planner.tasks.col.actions": "Действия",
      "planner.tasks.empty": "Пока нет задач на день",
      "planner.tasks.menu": "Меню задачи",
      "planner.tasks.edit": "Редактировать",
      "planner.tasks.delete": "Удалить",
      "planner.tasks.postpone": "Перенести на завтра",
      "planner.tasks.routineChip": "рутина",
      "planner.tasks.dragHandle": "Перетащите, чтобы изменить порядок",
      "planner.tasks.subtaskPh": "Подзадача…",
      "planner.tasks.subtaskDelete": "Удалить подзадачу",
      "planner.tasks.subtasks": "Подзадачи",
      "planner.tasks.subtaskAdd": "Добавить подзадачу",
      "planner.tasks.subtasksToggle": "Показать подзадачи",
      "planner.tasks.reorderHint": "Перетаскивайте задачи за ручку ⋮⋮. Подзадачи — «Добавить подзадачу» в меню ···.",
      "planner.scheduled.title": "3) Запланированные на завтра",
      "planner.scheduled.hint": "Задачи, которые после распределения по состоянию помечены как «перенести на завтра». Утром следующего дня они автоматически вернутся в основной список.",
      "planner.scheduled.col.title": "Задача",
      "planner.scheduled.col.diff": "Сложн.",
      "planner.scheduled.col.urg": "Срочн.",
      "planner.scheduled.col.min": "Мин",
      "planner.scheduled.col.date": "Дата возврата",
      "planner.scheduled.col.actions": "Действия",
      "planner.scheduled.empty": "Список запланированного пуст",
      "planner.scheduled.restore": "Вернуть сегодня",
      "planner.scheduled.delete": "Удалить",

      "planner.evening.title": "4) Вечерний итог дня",
      "planner.evening.fatigue": "Сегодня вечером: насколько вы устали?",
      "planner.evening.taskStart": "Сегодня: насколько часто вам было трудно начать определённые дела?",
      "planner.evening.planOverload": "Насколько сегодня вы чувствовали, что задач больше, чем реально выполнить?",
      "planner.evening.detachment": "Сегодня: насколько вам удалось отвлечься от работы вечером?",
      "planner.evening.fatiguePh": "1 — совсем не устал, 5 — очень устал",
      "planner.evening.taskStartPh": "1 — ни разу, 5 — очень часто",
      "planner.evening.planOverloadPh": "1 — совсем не чувствовал, 5 — чувствовал очень сильно",
      "planner.evening.detachmentPh": "1 — совсем не удалось, 5 — полностью удалось",
      "planner.evening.note": "Комментарий",
      "planner.evening.notePh": "Что помогло/мешало",

      "planner.onboarding.open": "Инструкция",
      "planner.onboarding.title": "Как работает продукт",
      "planner.onboarding.p1": "Этот инструмент помогает планировать день с учётом твоего текущего состояния.",
      "planner.onboarding.p2": "Сначала оцени своё состояние — система определит текущий уровень ресурсов и даст рекомендацию по оптимальной нагрузке.",
      "planner.onboarding.p3": "Дальше ты добавляешь задачи, оцениваешь их сложность и время выполнения. На основе состояния и задач система помогает распределить нагрузку.",
      "planner.onboarding.p4": "В конце дня ты оцениваешь результат — это помогает понять, насколько план соответствовал твоему реальному состоянию.",
      "planner.onboarding.howTitle": "Как пользоваться:",
      "planner.onboarding.step1.title": "Оцени состояние",
      "planner.onboarding.step1.desc": "Ответь на вопросы о сне, энергии, стрессе и текущем состоянии.",
      "planner.onboarding.step2.title": "Получи рекомендацию",
      "planner.onboarding.step2.desc": "Система предложит подходящий уровень нагрузки.",
      "planner.onboarding.step3.title": "Добавь задачи",
      "planner.onboarding.step3.desc": "Укажи важность, сложность и время выполнения. Для обязательной задачи отметь «Рутина» — она не переносится автоматически.",
      "planner.onboarding.step4.title": "Распредели нагрузку",
      "planner.onboarding.step4.desc": "Нажми «Распределить по состоянию». Система разложит задачи по подходящей нагрузке и времени дня.",
      "planner.onboarding.step5.title": "Управляй задачами",
      "planner.onboarding.step5.desc": "Поставь галочку после выполнения. В меню «⋮» можно редактировать, удалить или перенести задачу на завтра.",
      "planner.onboarding.step6.title": "Проверь переносы",
      "planner.onboarding.step6.desc": "Задачи, которые не вошли в нагрузку, появятся в разделе «Запланированные на завтра». Их можно вернуть сегодня или удалить.",
      "planner.onboarding.step7.title": "Оцени результат вечером",
      "planner.onboarding.step7.desc": "Ответь на вопросы о продуктивности, усталости и состоянии, затем закрой день.",
      "planner.onboarding.step8.title": "Заполни финальный отзыв",
      "planner.onboarding.step8.desc": "После третьего заполненного дня появится короткий опрос об опыте использования продукта.",
      "planner.onboarding.close": "Понятно, начать",

      "planner.feedback.title": "5) Финальный отзыв",
      "planner.feedback.hint": "Опрос доступен после завершения третьего дня. Ответьте о своём опыте использования продукта.",
      "planner.feedback.usefulness": "Как вы оцениваете свой опыт использования продукта?",
      "planner.feedback.usefulnessPh": "1 — очень отрицательно, 5 — очень положительно",
      "planner.feedback.stateHelp": "Как вы оцениваете изменения в понимании своего состояния?",
      "planner.feedback.planningHelp": "Как вы оцениваете изменения в распределении нагрузки?",
      "planner.feedback.continue": "Планируете ли вы продолжать пользоваться продуктом?",
      "planner.feedback.yes": "Да",
      "planner.feedback.partially": "Частично",
      "planner.feedback.no": "Нет",
      "planner.feedback.mostUseful": "Если что-то в продукте было полезно, что именно?",
      "planner.feedback.improvements": "Какие изменения вы бы предложили?",
      "planner.feedback.missing": "Есть ли что-то, чего вам не хватало бы без этого продукта? Если да, что именно?",
      "planner.feedback.textPh": "Свободный ответ",
      "planner.feedback.submit": "Отправить отзыв",
      "planner.feedback.thanks": "Спасибо! Отзыв сохранён.",
      "planner.feedback.scaleInvalid": "Укажите значение от 1 до 5 в оценке полезности.",
      "planner.morning.scaleInvalid": "Укажите качество сна, энергию и стресс от 1 до 5.",
      "planner.callInvite.title": "Разговор после 7 дней",
      "planner.callInvite.text": "Вы завершили семь дней. Если хотите, можно созвониться с исследовательницей и рассказать, как прошёл опыт: что было удобно, что мешало и что хотелось бы изменить.",
      "planner.evening.save": "Закрыть день",
      "planner.evening.fact": "Факт",
      "planner.evening.completed": "выполнено",
      "planner.evening.dayClosed": "День закрыт",
      "planner.evening.dayOpen": "День не закрыт",

      "planner.sync.syncing": "Синхронизация…",
      "planner.sync.success": "Данные сохранены",
      "planner.sync.error": "Ошибка синхронизации",

      "planner.alerts.titleRequired": "Введите название задачи",

      "planner.slot.morningRoutine": "Утро (рутина)",
      "planner.slot.morningFocus": "Утро (фокус)",
      "planner.slot.dayOps": "День (операционка)",
      "planner.slot.eveningLight": "Вечер (лёгкие)",
      "planner.slot.none": "Без слота",
      "planner.slot.postpone": "Перенести на завтра",
      "planner.slot.simplify": "Перенести или упростить",

      "participate.back": "← На главную",
      "participate.title": "Участие в эксперименте",
      "participate.subtitle": "Оставьте свои контакты — мы свяжемся с вами и пришлём детали 7-дневного пилота",
      "participate.field.name": "Имя",
      "participate.field.phone": "Телефон",
      "participate.field.telegram": "Telegram",
      "participate.field.email": "Email",
      "participate.optional": "(необязательно)",
      "participate.placeholder.name": "Например, Анна",
      "participate.placeholder.phone": "+7 999 123-45-67",
      "participate.placeholder.telegram": "@username",
      "participate.placeholder.email": "you@example.com",
      "participate.hint.telegram": "Можно с @ или без — например, @ivanov или ivanov",
      "participate.hint.email": "Используем только для связи по эксперименту.",
      "participate.error.name": "Пожалуйста, укажите имя",
      "participate.error.phone": "Укажите корректный телефон (минимум 7 цифр)",
      "participate.error.telegram": "Имя пользователя Telegram должно содержать 3–32 символа: латиница, цифры или _",
      "participate.error.telegramRequired": "Укажите Telegram (@username)",
      "participate.error.email": "Укажите корректный email",
      "participate.error.emailRequired": "Укажите email",
      "participate.submit": "Отправить заявку",
      "participate.privacy": "Отправляя форму, вы соглашаетесь с тем, что мы используем эти данные только для связи по эксперименту.",
      "participate.status.sending": "Отправляем заявку…",
      "participate.status.success": "Спасибо! Мы получили вашу заявку и скоро свяжемся с вами.",
      "participate.status.error": "Не удалось отправить заявку. Попробуйте ещё раз.",
      "participate.status.network": "Ошибка сети. Проверьте соединение и повторите попытку.",
      "participate.status.invalid": "Проверьте правильность заполнения полей.",
      "participate.status.noUrl": "Форма ещё не настроена: укажите URL Google Apps Script.",

      "participate.survey.title": "Несколько коротких вопросов",
      "participate.survey.subtitle": "Ответы помогут нам лучше подготовить эксперимент под вас.",
      "participate.survey.error.required": "Пожалуйста, выберите вариант ответа",
      "participate.survey.q1.text": "Следите ли вы за своим состоянием или здоровьем?",
      "participate.survey.q1.opt.yes": "Да, регулярно",
      "participate.survey.q1.opt.sometimes": "Иногда",
      "participate.survey.q1.opt.no": "Нет",
      "participate.survey.q2.text": "Используете ли вы что-то для отслеживания: сна, тренировок, нагрузки, продуктивности, самочувствия?",
      "participate.survey.q2.opt.yes": "Да",
      "participate.survey.q2.opt.no": "Нет",
      "participate.survey.q3.text": "Насколько вам знакомы такие проблемы: перегруз, усталость к концу дня, сложности с планированием, переоценка своих сил?",
      "participate.survey.q3.opt.often": "Часто",
      "participate.survey.q3.opt.sometimes": "Иногда",
      "participate.survey.q3.opt.rarely": "Редко",
      "participate.survey.q3.opt.almostNever": "Практически нет",
      "participate.survey.q4.text": "Когда ты замечаешь, что нагрузка начинает влиять на твоё состояние?",
      "participate.survey.q4.opt.before": "До того, как это начинает мешать моим делам",
      "participate.survey.q4.opt.slight": "Когда это уже начинает немного мешать",
      "participate.survey.q4.opt.strong": "Когда это начинает сильно мешать",
      "participate.survey.q4.opt.after": "Только после того, как последствия уже проявились",
      "participate.survey.q4.opt.none": "Обычно не замечаю связи",
      "participate.survey.q4.opt.unsure": "Затрудняюсь ответить",
      "participate.survey.q5.text": "Что ты обычно делаешь, когда замечаешь, что текущая нагрузка влияет на твоё состояние?",
      "participate.survey.q5.opt.nothing": "Ничего не меняю",
      "participate.survey.q5.opt.postpone": "Переношу часть дел",
      "participate.survey.q5.opt.reduce": "Уменьшаю объём запланированного",
      "participate.survey.q5.opt.break": "Делаю перерыв / отдыхаю",
      "participate.survey.q5.opt.finish": "Пытаюсь закончить всё как запланировано",
      "participate.survey.q5.opt.other": "Другое: __",
      "participate.survey.q5.opt.none": "Обычно такого не происходит",

      "participate.id.assigned": "Ваш ID участника:",
      "participate.id.hint": "Сохраните этот ID — он понадобится в прототипе-планировщике.",

      "planner.id.label": "Мой ID",
      "planner.id.placeholder": "Например, UP-000001",
      "planner.id.save": "Сохранить",
      "planner.id.change": "Изменить ID",
      "planner.id.checking": "Проверяем ID…",
      "planner.id.saved": "ID сохранён. Данные синхронизируются под этим ID.",
      "planner.id.notFound": "Такой ID не найден в списке зарегистрированных участников.",
      "planner.id.empty": "Введите ID участника.",
      "planner.id.error": "Не удалось проверить ID. Попробуйте позже.",
      "planner.id.required": "Сохраните «Мой ID», чтобы данные попадали в основную таблицу.",
      "planner.id.locked": "ID зафиксирован. Нажмите «Изменить ID», чтобы поменять."
    },
    en: {
      "meta.landing.title": "Upeak — Productivity Research",
      "meta.landing.description": "A 7-day pilot of an adaptive planner for daily state and workload",
      "meta.planner.title": "PulseBurn Planner — Prototype",
      "meta.participate.title": "Upeak — Join the experiment",
      "meta.participate.description": "Sign up for Upeak's 7-day planner pilot",

      "nav.research": "Research",
      "nav.experiment": "Experiment",
      "nav.join": "Join",
      "nav.lang.aria": "Interface language",

      "hero.eyebrow": "Research prototype",
      "hero.brand": "Upeak",
      "hero.title.line1": "Why don't you keep up,",
      "hero.title.line2": "even when you plan well?",
      "hero.subtitle": "We are running a 7-day pilot of an adaptive planner that accounts for your state, workload, and task completion",
      "hero.cta.join": "Join the experiment",
      "hero.cta.more": "Learn more",
      "hero.logo.alt": "Upeak logo",

      "problem.title.line1": "People plan their days the same way,",
      "problem.title.line2": "but their state changes constantly",
      "problem.plan.title": "Plan",
      "problem.plan.desc": "Same every day",
      "problem.real.title": "Reality",
      "problem.real.desc": "Different energy and stress",
      "problem.result.title": "Result",
      "problem.result.desc": "Overload and fatigue",
      "problem.gap": "This creates a gap between the plan and what you can actually do",
      "problem.aim": "We want to understand this mechanism",

      "research.title": "What we research",
      "research.sleep": "Sleep",
      "research.sleep.arrow": "→ Productivity",
      "research.stress": "Stress",
      "research.stress.arrow": "→ Overload",
      "research.energy": "Energy",
      "research.energy.arrow": "→ Task completion",
      "research.plan": "Plan",
      "research.plan.arrow": "→ Reality of execution",

      "experiment.title": "How the experiment works",
      "experiment.duration": "7 days",
      "experiment.duration.note": "two short check-ins per day",
      "experiment.daily.title": "Every day",
      "experiment.daily.head": "A plan matched to your state",
      "experiment.daily.desc": "In the morning you assess your state and distribute tasks; in the evening you close the day and receive a recommendation",
      "experiment.finish.title": "After 7 days",
      "experiment.finish.head": "A short final survey",
      "experiment.finish.desc": "Tell us what helped, what got in the way, and whether you would keep using the planner",
      "experiment.note": "We are looking for early signals of usefulness, not promising a proven effect",

      "disclaimer.title": "Important note",
      "disclaimer.text1": "This is not a finished product that solves everything.",
      "disclaimer.text2": "It is a study that helps us understand behavior and build a more accurate system in the future.",

      "cta.title": "Join the study",
      "cta.subtitle": "Help us understand how people actually work",

      "planner.eyebrow": "Research prototype",
      "planner.title": "State-aware task planner",
      "planner.home": "Back to landing",

      "planner.morning.title": "1) Morning state check-in",
      "planner.morning.sleepHours": "How many hours did you sleep today?",
      "planner.morning.sleepQuality": "How would you rate your sleep quality today?",
      "planner.morning.energy": "This morning: how much fatigue and low energy did you feel?",
      "planner.morning.stress": "This morning: how much tension or stress did you feel?",
      "planner.morning.sleepHoursPh": "For example, 7.5 h",
      "planner.morning.sleepQualityPh": "1–5 (1 poor, 5 excellent)",
      "planner.morning.energyPh": "1–5 (1 energized, 5 very drained)",
      "planner.morning.stressPh": "1–5 (1 calm, 5 high stress)",
      "planner.scale.hours": "0–14 h",
      "planner.scale.oneToFive": "1–5",
      "planner.scale.minutes": "5–360 min",
      "planner.morning.note": "Comment",
      "planner.morning.notePh": "Briefly: how do you feel",
      "planner.morning.save": "Save check-in",
      "planner.readiness": "State",

      "planner.tasks.title": "2) Tasks for today",
      "planner.tasks.task": "Task",
      "planner.tasks.taskPh": "E.g., prepare a presentation",
      "planner.tasks.difficulty": "Difficulty",
      "planner.tasks.urgency": "Urgency",
      "planner.tasks.difficultyPh": "1–5 (difficulty)",
      "planner.tasks.urgencyPh": "1–5 (urgency)",
      "planner.tasks.duration": "Time estimate",
      "planner.tasks.routine": "Routine (baseline daily task)",
      "planner.tasks.add": "Add task",
      "planner.tasks.saveEdit": "Save changes",
      "planner.tasks.cancelEdit": "Cancel editing",
      "planner.tasks.distribute": "Distribute by state",
      "planner.tasks.scaleInvalid": "Enter difficulty and urgency from 1 to 5.",

      "planner.tasks.col.order": "#",
      "planner.tasks.col.status": "Status",
      "planner.tasks.col.title": "Task",
      "planner.tasks.col.diff": "Diff.",
      "planner.tasks.col.urg": "Urg.",
      "planner.tasks.col.min": "Min",
      "planner.tasks.col.slot": "Recommended slot",
      "planner.tasks.col.actions": "Actions",
      "planner.tasks.empty": "No tasks for today yet",
      "planner.tasks.menu": "Task menu",
      "planner.tasks.edit": "Edit",
      "planner.tasks.delete": "Delete",
      "planner.tasks.postpone": "Move to tomorrow",
      "planner.tasks.routineChip": "routine",
      "planner.tasks.dragHandle": "Drag to reorder",
      "planner.tasks.subtaskPh": "Subtask…",
      "planner.tasks.subtaskDelete": "Remove subtask",
      "planner.tasks.subtasks": "Subtasks",
      "planner.tasks.subtaskAdd": "Add subtask",
      "planner.tasks.subtasksToggle": "Toggle subtasks",
      "planner.tasks.reorderHint": "Drag tasks by the ⋮⋮ handle. Add subtasks via ··· → Add subtask.",
      "planner.scheduled.title": "3) Scheduled for tomorrow",
      "planner.scheduled.hint": "Tasks marked as “move to tomorrow” after state-based distribution. They return to the main list automatically the next morning.",
      "planner.scheduled.col.title": "Task",
      "planner.scheduled.col.diff": "Diff.",
      "planner.scheduled.col.urg": "Urg.",
      "planner.scheduled.col.min": "Min",
      "planner.scheduled.col.date": "Return date",
      "planner.scheduled.col.actions": "Actions",
      "planner.scheduled.empty": "Nothing scheduled yet",
      "planner.scheduled.restore": "Bring to today",
      "planner.scheduled.delete": "Remove",

      "planner.evening.title": "4) Evening summary",
      "planner.evening.fatigue": "This evening: how tired are you?",
      "planner.evening.taskStart": "Today: how often was it hard to start certain tasks?",
      "planner.evening.planOverload": "How strongly did you feel today that there were more tasks than you could realistically complete?",
      "planner.evening.detachment": "Today: how well were you able to disconnect from work this evening?",
      "planner.evening.fatiguePh": "1 — not tired at all, 5 — very tired",
      "planner.evening.taskStartPh": "1 — never, 5 — very often",
      "planner.evening.planOverloadPh": "1 — not at all, 5 — very strongly",
      "planner.evening.detachmentPh": "1 — not at all, 5 — completely",
      "planner.evening.note": "Comment",
      "planner.evening.notePh": "What helped / hindered",

      "planner.onboarding.open": "Instructions",
      "planner.onboarding.title": "How the product works",
      "planner.onboarding.p1": "This tool helps you plan your day around your current state.",
      "planner.onboarding.p2": "First, assess your state — the system will estimate your current resource level and recommend an optimal workload.",
      "planner.onboarding.p3": "Then you add tasks and estimate their difficulty and duration. Based on your state and tasks, the system helps distribute the workload.",
      "planner.onboarding.p4": "At the end of the day you evaluate the result — this helps you see how well the plan matched your actual state.",
      "planner.onboarding.howTitle": "How to use:",
      "planner.onboarding.step1.title": "Assess your state",
      "planner.onboarding.step1.desc": "Answer questions about sleep, energy, stress, and how you feel.",
      "planner.onboarding.step2.title": "Get a recommendation",
      "planner.onboarding.step2.desc": "The system will suggest a suitable workload level.",
      "planner.onboarding.step3.title": "Add tasks",
      "planner.onboarding.step3.desc": "Specify importance, difficulty, and estimated time. For a required daily task, select “Routine” — it is not moved automatically.",
      "planner.onboarding.step4.title": "Distribute the workload",
      "planner.onboarding.step4.desc": "Click “Distribute by state”. The system will place tasks into a suitable workload and time slot.",
      "planner.onboarding.step5.title": "Manage your tasks",
      "planner.onboarding.step5.desc": "Tick the checkbox when a task is done. Use “⋮” to edit, delete, or move a task to tomorrow.",
      "planner.onboarding.step6.title": "Check postponed tasks",
      "planner.onboarding.step6.desc": "Tasks that do not fit the workload appear under “Scheduled for tomorrow”. You can bring them back today or remove them.",
      "planner.onboarding.step7.title": "Evaluate the result in the evening",
      "planner.onboarding.step7.desc": "Answer questions about productivity, tiredness, and your state, then close the day.",
      "planner.onboarding.step8.title": "Complete the final feedback",
      "planner.onboarding.step8.desc": "After the third completed day, a short survey about your experience will appear.",
      "planner.onboarding.close": "Got it, let's start",

      "planner.feedback.title": "5) Final feedback",
      "planner.feedback.hint": "This survey becomes available after you complete day three. Answer about your experience using the product.",
      "planner.feedback.usefulness": "How would you rate your experience using the product?",
      "planner.feedback.usefulnessPh": "1 — very negative, 5 — very positive",
      "planner.feedback.stateHelp": "How would you rate the change in your understanding of your state?",
      "planner.feedback.planningHelp": "How would you rate the change in how you distribute your workload?",
      "planner.feedback.continue": "Do you plan to continue using the product?",
      "planner.feedback.yes": "Yes",
      "planner.feedback.partially": "Partially",
      "planner.feedback.no": "No",
      "planner.feedback.mostUseful": "If anything in the product was useful, what was it?",
      "planner.feedback.improvements": "What changes would you suggest?",
      "planner.feedback.missing": "Is there anything you would miss without this product? If yes, what?",
      "planner.feedback.textPh": "Free-form answer",
      "planner.feedback.submit": "Send feedback",
      "planner.feedback.thanks": "Thank you! Feedback saved.",
      "planner.feedback.scaleInvalid": "Enter a value from 1 to 5 for the usefulness rating.",
      "planner.morning.scaleInvalid": "Enter sleep quality, energy, and stress from 1 to 5.",
      "planner.callInvite.title": "Conversation after 7 days",
      "planner.callInvite.text": "You have completed seven days. If you would like, you can have a call with the researcher and share what the experience was like: what was convenient, what got in the way, and what you would change.",
      "planner.evening.save": "Close the day",
      "planner.evening.fact": "Fact",
      "planner.evening.completed": "completed",
      "planner.evening.dayClosed": "Day closed",
      "planner.evening.dayOpen": "Day not closed",

      "planner.sync.syncing": "Syncing…",
      "planner.sync.success": "Saved",
      "planner.sync.error": "Sync error",

      "planner.alerts.titleRequired": "Please enter a task title",

      "planner.slot.morningRoutine": "Morning (routine)",
      "planner.slot.morningFocus": "Morning (focus)",
      "planner.slot.dayOps": "Day (operations)",
      "planner.slot.eveningLight": "Evening (light)",
      "planner.slot.none": "Unscheduled",
      "planner.slot.postpone": "Postpone to tomorrow",
      "planner.slot.simplify": "Postpone or simplify",

      "participate.back": "← Back to home",
      "participate.title": "Join the experiment",
      "participate.subtitle": "Leave your contact details — we'll reach out and share the 7-day pilot details",
      "participate.field.name": "Name",
      "participate.field.phone": "Phone",
      "participate.field.telegram": "Telegram",
      "participate.field.email": "Email",
      "participate.optional": "(optional)",
      "participate.placeholder.name": "e.g., Anna",
      "participate.placeholder.phone": "+1 555 123-4567",
      "participate.placeholder.telegram": "@username",
      "participate.placeholder.email": "you@example.com",
      "participate.hint.telegram": "With or without @ — e.g., @ivanov or ivanov",
      "participate.hint.email": "We'll only use it to send you the experiment details.",
      "participate.error.name": "Please enter your name",
      "participate.error.phone": "Please enter a valid phone (at least 7 digits)",
      "participate.error.telegram": "Telegram username must be 3–32 chars: letters, digits or underscore",
      "participate.error.telegramRequired": "Please enter your Telegram (@username)",
      "participate.error.email": "Please enter a valid email address",
      "participate.error.emailRequired": "Please enter your email",
      "participate.submit": "Send request",
      "participate.privacy": "By submitting this form you agree we use these details only to contact you about the experiment.",
      "participate.status.sending": "Sending your request…",
      "participate.status.success": "Thanks! We received your request and will be in touch soon.",
      "participate.status.error": "Couldn't submit your request. Please try again.",
      "participate.status.network": "Network error. Check your connection and try again.",
      "participate.status.invalid": "Please double-check the form fields.",
      "participate.status.noUrl": "The form isn't configured yet: please set the Google Apps Script URL.",

      "participate.survey.title": "A few short questions",
      "participate.survey.subtitle": "Your answers help us tailor the experiment to you.",
      "participate.survey.error.required": "Please choose an answer",
      "participate.survey.q1.text": "Do you track your state or health?",
      "participate.survey.q1.opt.yes": "Yes, regularly",
      "participate.survey.q1.opt.sometimes": "Sometimes",
      "participate.survey.q1.opt.no": "No",
      "participate.survey.q2.text": "Do you use anything to track sleep, workouts, workload, productivity, or wellbeing?",
      "participate.survey.q2.opt.yes": "Yes",
      "participate.survey.q2.opt.no": "No",
      "participate.survey.q3.text": "How familiar are these problems: overload, end-of-day fatigue, planning difficulties, overestimating your capacity?",
      "participate.survey.q3.opt.often": "Often",
      "participate.survey.q3.opt.sometimes": "Sometimes",
      "participate.survey.q3.opt.rarely": "Rarely",
      "participate.survey.q3.opt.almostNever": "Almost never",
      "participate.survey.q4.text": "When do you notice that workload starts affecting your state?",
      "participate.survey.q4.opt.before": "Before it starts interfering with my activities",
      "participate.survey.q4.opt.slight": "When it starts interfering a little",
      "participate.survey.q4.opt.strong": "When it starts interfering a lot",
      "participate.survey.q4.opt.after": "Only after the consequences have already appeared",
      "participate.survey.q4.opt.none": "I usually do not notice a connection",
      "participate.survey.q4.opt.unsure": "Not sure",
      "participate.survey.q5.text": "What do you usually do when you notice that your current workload affects your state?",
      "participate.survey.q5.opt.nothing": "I do not change anything",
      "participate.survey.q5.opt.postpone": "Postpone some tasks",
      "participate.survey.q5.opt.reduce": "Reduce the planned workload",
      "participate.survey.q5.opt.break": "Take a break / rest",
      "participate.survey.q5.opt.finish": "Try to finish everything as planned",
      "participate.survey.q5.opt.other": "Other: __",
      "participate.survey.q5.opt.none": "This usually does not happen",

      "participate.id.assigned": "Your participant ID:",
      "participate.id.hint": "Save this ID — you'll need it in the planner prototype.",

      "planner.id.label": "My ID",
      "planner.id.placeholder": "e.g., UP-000001",
      "planner.id.save": "Save",
      "planner.id.change": "Change ID",
      "planner.id.checking": "Checking ID…",
      "planner.id.saved": "ID saved. Data syncs under this ID.",
      "planner.id.notFound": "This ID was not found among registered participants.",
      "planner.id.empty": "Enter a participant ID.",
      "planner.id.error": "Could not verify the ID. Try again later.",
      "planner.id.required": "Save \"My ID\" so your data reaches the main data sheet.",
      "planner.id.locked": "ID is locked. Click \"Change ID\" to edit it."
    }
  };

  function detectInitial() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "ru" || saved === "en") return saved;
    } catch (e) {}
    var nav = (navigator.language || navigator.userLanguage || "").toLowerCase();
    if (nav.indexOf("ru") === 0) return "ru";
    if (nav.indexOf("en") === 0) return "en";
    return DEFAULT_LANG;
  }

  var current = detectInitial();
  var listeners = [];

  function t(key) {
    var dict = DICT[current] || DICT[DEFAULT_LANG];
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    var fallback = DICT[DEFAULT_LANG];
    return Object.prototype.hasOwnProperty.call(fallback, key) ? fallback[key] : key;
  }

  function applyDom(root) {
    var scope = root || document;

    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });

    scope.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      el.setAttribute("placeholder", t(key));
    });

    scope.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria-label");
      el.setAttribute("aria-label", t(key));
    });

    scope.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-alt");
      el.setAttribute("alt", t(key));
    });

    scope.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-title");
      el.setAttribute("title", t(key));
    });

    var titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) document.title = t(titleEl.getAttribute("data-i18n"));

    var descEl = document.querySelector('meta[name="description"][data-i18n]');
    if (descEl) descEl.setAttribute("content", t(descEl.getAttribute("data-i18n")));

    document.documentElement.setAttribute("lang", current);
  }

  function setLang(lang) {
    if (lang !== "ru" && lang !== "en") return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    applyDom();
    listeners.forEach(function (cb) { try { cb(lang); } catch (e) {} });
    var toggles = document.querySelectorAll("[data-lang-toggle]");
    toggles.forEach(function (btn) {
      var btnLang = btn.getAttribute("data-lang-toggle");
      btn.setAttribute("aria-pressed", btnLang === current ? "true" : "false");
      if (btnLang === current) btn.classList.add("is-active");
      else btn.classList.remove("is-active");
    });
  }

  function getLang() { return current; }

  function onChange(cb) { if (typeof cb === "function") listeners.push(cb); }

  function init() {
    document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLang(btn.getAttribute("data-lang-toggle"));
      });
    });
    setLang(current);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.UpeakI18n = {
    t: t,
    setLang: setLang,
    getLang: getLang,
    onChange: onChange,
    apply: applyDom
  };
})();