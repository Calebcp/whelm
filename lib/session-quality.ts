export type SessionQualityCompletionStatus = "completed" | "abandoned";
export type SessionQualityRating = "excellent" | "good" | "fair" | "weak";

export type SessionQualityInput = {
  plannedDurationMinutes?: number | null;
  actualDurationMinutes: number;
  completionStatus: SessionQualityCompletionStatus;
  earlyExit?: boolean;
  interruptionCount?: number | null;
  tasksCompletedCount?: number | null;
};

export type SessionQualityEvaluation = {
  score: number;
  rating: SessionQualityRating;
  breakdown: {
    completion: number;
    duration: number;
    interruptions: number;
    tasks: number;
  };
  explanation: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value);
}

function ratingForScore(score: number): SessionQualityRating {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 45) return "fair";
  return "weak";
}

export function evaluateSessionQuality(input: SessionQualityInput): SessionQualityEvaluation {
  const planned = input.plannedDurationMinutes ?? null;
  const actual = clamp(round(input.actualDurationMinutes), 0, 24 * 60);
  const interruptions =
    input.interruptionCount === undefined || input.interruptionCount === null
      ? null
      : clamp(round(input.interruptionCount), 0, 20);
  const tasksCompleted = clamp(round(input.tasksCompletedCount ?? 0), 0, 20);
  const earlyExit =
    input.earlyExit ?? (planned !== null && planned > 0 ? actual < planned : false);

  const completionScore =
    input.completionStatus === "completed" ? (earlyExit ? 20 : 30) : 5;

  let durationScore = 0;
  if (planned !== null && planned > 0) {
    const ratio = actual / planned;
    if (ratio >= 0.9) {
      durationScore = 35;
    } else if (ratio >= 0.75) {
      durationScore = 28;
    } else if (ratio >= 0.5) {
      durationScore = 18;
    } else if (ratio > 0) {
      durationScore = 8;
    }
  } else if (actual >= 45) {
    durationScore = 30;
  } else if (actual >= 25) {
    durationScore = 24;
  } else if (actual >= 10) {
    durationScore = 14;
  } else if (actual > 0) {
    durationScore = 6;
  }

  let interruptionScore = 10;
  if (interruptions !== null) {
    if (interruptions === 0) {
      interruptionScore = 15;
    } else if (interruptions === 1) {
      interruptionScore = 10;
    } else if (interruptions === 2) {
      interruptionScore = 5;
    } else {
      interruptionScore = 0;
    }
  }

  const taskScore = tasksCompleted > 0 ? 20 : 0;
  const score = clamp(completionScore + durationScore + interruptionScore + taskScore, 0, 100);

  const explanation: string[] = [];
  if (input.completionStatus === "completed" && !earlyExit) {
    explanation.push("Completed as intended.");
  } else if (input.completionStatus === "completed") {
    explanation.push("Completed, but ended earlier than planned.");
  } else {
    explanation.push("Did not reach a full completion.");
  }

  if (planned !== null && planned > 0) {
    explanation.push(`${actual}m done against a ${planned}m plan.`);
  } else {
    explanation.push(`${actual}m completed without a planned duration.`);
  }

  if (interruptions !== null) {
    explanation.push(
      interruptions === 0
        ? "No interruptions recorded."
        : `${interruptions} interruption${interruptions === 1 ? "" : "s"} recorded.`,
    );
  }

  if (tasksCompleted > 0) {
    explanation.push(
      `${tasksCompleted} task${tasksCompleted === 1 ? "" : "s"} completed from this session.`,
    );
  }

  return {
    score,
    rating: ratingForScore(score),
    breakdown: {
      completion: completionScore,
      duration: durationScore,
      interruptions: interruptionScore,
      tasks: taskScore,
    },
    explanation,
  };
}
