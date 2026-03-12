export type SenseiCompanionVariant =
  | "stressed"
  | "scholar"
  | "victory"
  | "neutral"
  | "anchor"
  | "bowed"
  | "meditate"
  | "rest"
  | "wave"
  | "applause";

export type SenseiRelationshipStage =
  | "newcomer"
  | "apprentice"
  | "steady"
  | "trusted"
  | "guardian";

export type SenseiVoiceMode = "calm" | "firm" | "proud" | "concerned" | "playful";
export type SenseiHeroTone = "steady" | "nudge" | "momentum" | "milestone";
export type SenseiCompanionStyle = "gentle" | "balanced" | "strict";
export type SenseiRitual =
  | "arrival"
  | "morning-brief"
  | "midday-rescue"
  | "streak-guard"
  | "deep-work"
  | "evening-reflection"
  | "weekly-reset";

export type SenseiAppTab =
  | "today"
  | "calendar"
  | "notes"
  | "insights"
  | "history"
  | "reports"
  | "settings";

type CompanionEngineInput = {
  now: Date;
  activeTab: SenseiAppTab;
  totalSessions: number;
  totalMinutes: number;
  todaySessions: number;
  todayMinutes: number;
  weekMinutes: number;
  streak: number;
  dueReminders: number;
  plannedTodayCount: number;
  notesCount: number;
  notesUpdated7d: number;
  nextMilestone: number | null;
  nextMilestoneRemaining: number;
  averageStartHour: number | null;
  lastSessionHoursAgo: number | null;
  comebackDaysAway: number;
  missedYesterday: boolean;
  companionStyle: SenseiCompanionStyle;
};

type HeroGuidance = {
  tone: SenseiHeroTone;
  variant: SenseiCompanionVariant;
  eyebrow: string;
  title: string;
  body: string;
  ritual: SenseiRitual;
  voiceMode: SenseiVoiceMode;
  signatureLine: string;
  actionLabel: string;
  actionTab: SenseiAppTab;
};

type CompanionPulse = {
  eyebrow: string;
  title: string;
  body: string;
  variant: SenseiCompanionVariant;
};

export type SenseiCompanionState = {
  stage: SenseiRelationshipStage;
  hero: HeroGuidance;
  pulses: Record<Exclude<SenseiAppTab, "today">, CompanionPulse>;
};

function stageLabel(stage: SenseiRelationshipStage) {
  switch (stage) {
    case "newcomer":
      return "First Contact";
    case "apprentice":
      return "Training Rhythm";
    case "steady":
      return "Steady Form";
    case "trusted":
      return "Trusted Discipline";
    case "guardian":
      return "Guardian State";
  }
}

function ritualLabel(ritual: SenseiRitual) {
  switch (ritual) {
    case "arrival":
      return "Arrival";
    case "morning-brief":
      return "Morning Brief";
    case "midday-rescue":
      return "Midday Rescue";
    case "streak-guard":
      return "Streak Guard";
    case "deep-work":
      return "Deep Work";
    case "evening-reflection":
      return "Evening Reflection";
    case "weekly-reset":
      return "Weekly Reset";
  }
}

function relationshipStage(totalSessions: number, streak: number, totalMinutes: number) {
  if (totalSessions < 3) return "newcomer";
  if (totalSessions < 15 || streak < 3) return "apprentice";
  if (totalSessions < 45 || totalMinutes < 1200) return "steady";
  if (streak < 30) return "trusted";
  return "guardian";
}

function signatureLine(mode: SenseiVoiceMode, style: SenseiCompanionStyle) {
  const byMode: Record<SenseiVoiceMode, Record<SenseiCompanionStyle, string>> = {
    calm: {
      gentle: "Laozi: quiet order is stronger than noisy strain.",
      balanced: "Marcus Aurelius: clarity first, then action.",
      strict: "Aristotle: steady form beats emotional noise.",
    },
    firm: {
      gentle: "Confucius: correct the step before you force the pace.",
      balanced: "Seneca: protect time with action, not negotiation.",
      strict: "Epictetus: discipline begins where excuses lose power.",
    },
    proud: {
      gentle: "Mencius: growth comes from what you keep tending.",
      balanced: "Aristotle: the work is starting to look like character.",
      strict: "Sun Tzu: hold the ground you have taken.",
    },
    concerned: {
      gentle: "Laozi: return quietly and continue.",
      balanced: "Seneca: reduce the problem and move.",
      strict: "Confucius: restore the next right action before the day hardens.",
    },
    playful: {
      gentle: "Zhuangzi: a small movement still belongs to the Way.",
      balanced: "Epictetus: begin with what is still in your power.",
      strict: "Marcus Aurelius: stop circling and begin.",
    },
  };

  return byMode[mode][style];
}

function averageStartHour(totalSessions: number, averageStartHourValue: number | null) {
  if (totalSessions < 4 || averageStartHourValue === null) return null;
  return averageStartHourValue;
}

function buildHero(input: CompanionEngineInput, stage: SenseiRelationshipStage): HeroGuidance {
  const hour = input.now.getHours();
  const weekday = input.now.getDay();
  const avgStartHour = averageStartHour(input.totalSessions, input.averageStartHour);
  const startedLate =
    avgStartHour !== null &&
    hour >= Math.round(avgStartHour + 1.5) &&
    input.todaySessions === 0;

  if (weekday === 0 && hour < 15) {
    return {
      tone: "steady",
      variant: "scholar",
      eyebrow: ritualLabel("weekly-reset"),
      title: "Build the week before the week gets loud.",
      body:
        input.plannedTodayCount > 0
          ? `You already placed ${input.plannedTodayCount} block${input.plannedTodayCount === 1 ? "" : "s"} for today. Keep the opening clean and protect the shape of the week.`
          : "Set one anchor block, one recovery window, and one promise you will actually keep.",
      ritual: "weekly-reset",
      voiceMode: "calm",
      signatureLine: signatureLine("calm", input.companionStyle),
      actionLabel: input.plannedTodayCount > 0 ? "Open Calendar" : "Plan the Week",
      actionTab: "calendar",
    };
  }

  if (input.nextMilestone && input.nextMilestoneRemaining <= 1 && input.streak > 0) {
    return {
      tone: "milestone",
      variant: "applause",
      eyebrow: ritualLabel("streak-guard"),
      title: `One more day to reach ${input.nextMilestone}.`,
      body: "Do not ask for inspiration. Protect the streak with one deliberate block and leave the day with certainty.",
      ritual: "streak-guard",
      voiceMode: "firm",
      signatureLine: signatureLine("firm", input.companionStyle),
      actionLabel: "Protect the Streak",
      actionTab: "today",
    };
  }

  if (input.comebackDaysAway >= 2 && input.todaySessions > 0) {
    return {
      tone: "momentum",
      variant: "anchor",
      eyebrow: ritualLabel("arrival"),
      title: "That return mattered.",
      body: `You came back after ${input.comebackDaysAway} quieter day${input.comebackDaysAway === 1 ? "" : "s"}. The comeback matters more than the gap right now.`,
      ritual: "arrival",
      voiceMode: "proud",
      signatureLine: signatureLine("proud", input.companionStyle),
      actionLabel: "Review the Log",
      actionTab: "history",
    };
  }

  if (input.todaySessions === 0 && (startedLate || hour >= 17)) {
    return {
      tone: "nudge",
      variant: "stressed",
      eyebrow: ritualLabel("midday-rescue"),
      title: "The day can still be recovered.",
      body:
        input.plannedTodayCount > 0
          ? `You already told me what matters: ${input.plannedTodayCount} block${input.plannedTodayCount === 1 ? "" : "s"} are waiting. Start with the smallest one and let action cut through the noise.`
          : "You do not need a perfect restart. You need one honest block that proves the day is still yours.",
      ritual: "midday-rescue",
      voiceMode: "concerned",
      signatureLine: signatureLine("concerned", input.companionStyle),
      actionLabel: input.plannedTodayCount > 0 ? "Open Calendar" : "Open Today",
      actionTab: input.plannedTodayCount > 0 ? "calendar" : "today",
    };
  }

  if (input.todaySessions >= 3 || input.todayMinutes >= 90) {
    if (hour >= 20) {
      return {
        tone: "momentum",
        variant: "rest",
        eyebrow: ritualLabel("evening-reflection"),
        title: "You have earned a quiet ending.",
        body:
          input.dueReminders > 0
          ? `Clear ${input.dueReminders} reminder${input.dueReminders === 1 ? "" : "s"} cleanly, then shut the gates. Discipline also means knowing when to stop.`
          : "The work already landed. Leave a little energy untouched so tomorrow does not begin in debt.",
        ritual: "evening-reflection",
        voiceMode: "calm",
        signatureLine: signatureLine("calm", input.companionStyle),
        actionLabel: input.dueReminders > 0 ? "Open Notes" : "Check Reports",
        actionTab: input.dueReminders > 0 ? "notes" : "reports",
      };
    }

    return {
      tone: "momentum",
      variant: "victory",
      eyebrow: ritualLabel("deep-work"),
      title: "Your focus has weight today.",
      body:
        input.lastSessionHoursAgo !== null && input.lastSessionHoursAgo < 2
          ? "That last session still counts in the room. Protect the standard and avoid leaking the momentum."
          : "You already proved discipline today. Finish with intention instead of drifting into careless effort.",
      ritual: "deep-work",
      voiceMode: "proud",
      signatureLine: signatureLine("proud", input.companionStyle),
      actionLabel: input.dueReminders > 0 ? "Clear Reminders" : "Review Progress",
      actionTab: input.dueReminders > 0 ? "notes" : "reports",
    };
  }

  if (input.todaySessions === 0) {
    return {
      tone: "nudge",
      variant: hour < 12 ? "wave" : "anchor",
      eyebrow: ritualLabel(hour < 12 ? "morning-brief" : "arrival"),
      title: hour < 12 ? "Start before the day starts deciding for you." : "Return cleanly.",
      body:
        input.plannedTodayCount > 0
          ? `You already have ${input.plannedTodayCount} planned block${input.plannedTodayCount === 1 ? "" : "s"}. Begin with the first one and let the rest follow.`
          : "Momentum does not need drama. One focused block is enough to change the shape of the day.",
      ritual: hour < 12 ? "morning-brief" : "arrival",
      voiceMode: stage === "newcomer" ? "playful" : "firm",
      signatureLine: signatureLine(stage === "newcomer" ? "playful" : "firm", input.companionStyle),
      actionLabel: input.plannedTodayCount > 0 ? "Open Calendar" : "Start Today",
      actionTab: input.plannedTodayCount > 0 ? "calendar" : "today",
    };
  }

  return {
    tone: "steady",
    variant: hour < 11 ? "scholar" : "anchor",
    eyebrow: ritualLabel(hour < 12 ? "morning-brief" : "arrival"),
    title: "You are in motion. Stay deliberate.",
    body:
      input.streak > 0
        ? `Your ${input.streak}-day streak is alive. Add one more intentional block and keep the relationship with yourself clean.`
        : "You have started. Now make the second action easier than the first.",
    ritual: hour < 12 ? "morning-brief" : "arrival",
    voiceMode: "calm",
    signatureLine: signatureLine("calm", input.companionStyle),
    actionLabel: input.notesCount === 0 ? "Open Notes" : "Review Calendar",
    actionTab: input.notesCount === 0 ? "notes" : "calendar",
  };
}

function buildPulseCalendar(input: CompanionEngineInput): CompanionPulse {
  if (input.todaySessions === 0 && input.plannedTodayCount === 0) {
    return {
      eyebrow: "Whelm Read",
      title: "Seneca would not mistake blank space for intention.",
      body: "Place one block where your energy is most likely to survive contact with reality. A named hour resists drift better than a wish.",
      variant: "meditate",
    };
  }

  return {
    eyebrow: "Whelm Read",
    title: "Sun Tzu would secure the ground before the contest.",
    body: "Use the calendar to reduce negotiation. A scheduled block is easier to obey than a vague promise.",
    variant: "scholar",
  };
}

function buildPulseNotes(input: CompanionEngineInput): CompanionPulse {
  if (input.notesCount === 0) {
    return {
      eyebrow: "Writing Studio",
      title: "Confucius would write the matter clearly before judging it.",
      body: "Whelm is strongest when your plans and reflections are written where you can meet them again.",
      variant: "scholar",
    };
  }

  if (input.notesUpdated7d === 0) {
    return {
      eyebrow: "Writing Studio",
      title: "Montaigne would return to the page, not merely to the mood.",
      body: "Revive one page today. Whelm becomes more useful when your written world stays current.",
      variant: "bowed",
    };
  }

  return {
    eyebrow: "Writing Studio",
    title: "Marcus Aurelius treated writing like a private correction.",
    body: "Write what matters, what changed, and what the next move is. That is how Whelm becomes an accountability partner.",
    variant: "anchor",
  };
}

function buildPulseInsights(input: CompanionEngineInput): CompanionPulse {
  if (input.totalSessions < 3) {
    return {
      eyebrow: "Pattern Read",
      title: "Aristotle would ask for repeated action before theory.",
      body: "Do not chase perfect analytics first. Give Whelm enough honest reps to read your rhythm.",
      variant: "neutral",
    };
  }

  return {
    eyebrow: "Pattern Read",
    title: "Aristotle looked for habits, not wishes.",
    body: "The insight tab should tell you where discipline is leaking and where effort is actually compounding.",
    variant: "scholar",
  };
}

function buildPulseHistory(input: CompanionEngineInput): CompanionPulse {
  if (input.totalSessions === 0) {
    return {
      eyebrow: "Proof Log",
      title: "Heraclitus would trust the record of motion over intention.",
      body: "Once the log starts, the relationship becomes specific. Until then, everything is guesswork.",
      variant: "wave",
    };
  }

  return {
    eyebrow: "Proof Log",
    title: "History is where action stops pretending.",
    body: "Whelm should remember what you actually did, not just what you meant to do.",
    variant: input.streak >= 7 ? "applause" : "neutral",
  };
}

function buildPulseReports(input: CompanionEngineInput): CompanionPulse {
  return {
    eyebrow: "Weekly Read",
    title: input.weekMinutes >= 420 ? "Aristotle would say repetition is turning into character." : "The report is a mirror, not a verdict.",
    body:
      input.weekMinutes >= 420
        ? "Strong weeks deserve recognition. Now preserve the standard without turning it into theater."
        : "Use reports to adjust the system, not to punish yourself. Seneca would shorten the lesson to one corrected behavior.",
    variant: input.weekMinutes >= 420 ? "victory" : "scholar",
  };
}

function buildPulseSettings(input: CompanionEngineInput, stage: SenseiRelationshipStage): CompanionPulse {
  return {
    eyebrow: "Companion Protocol",
    title: `${stageLabel(stage)} is active.`,
    body:
      input.streak > 0
        ? `Whelm is most useful when the system stays reliable. Confucius would keep the ritual clean so your ${input.streak}-day streak has a proper home.`
        : "A strong guide needs a strong system. Keep setup clean so encouragement never replaces structure.",
    variant: "anchor",
  };
}

export function buildSenseiCompanionState(input: CompanionEngineInput): SenseiCompanionState {
  const stage = relationshipStage(input.totalSessions, input.streak, input.totalMinutes);

  return {
    stage,
    hero: buildHero(input, stage),
    pulses: {
      calendar: buildPulseCalendar(input),
      notes: buildPulseNotes(input),
      insights: buildPulseInsights(input),
      history: buildPulseHistory(input),
      reports: buildPulseReports(input),
      settings: buildPulseSettings(input, stage),
    },
  };
}
