import {
  SIGNIN_BASE_XP,
  SIGNIN_STREAK_XP_PER_DAY,
  SIGNIN_STREAK_XP_CAP,
  SIGNIN_MILESTONES,
} from "./config.js";
import { addGrowthXp } from "./adjust.js";
import { appDayKey, appYesterdayKey } from "./clock.js";

export function ensureCheckIn(save) {
  if (!save.checkIn) {
    save.checkIn = {
      streak: 0,
      maxStreak: 0,
      lastDay: null,
      totalDays: 0,
      history: {},
    };
  }
  if (!save.checkIn.history) save.checkIn.history = {};
  return save.checkIn;
}

export function hasCheckedInToday(save) {
  const ci = ensureCheckIn(save);
  return ci.lastDay === appDayKey();
}

function computeStreakBonus(streak) {
  const extra = Math.min(
    SIGNIN_STREAK_XP_CAP,
    Math.max(0, streak - 1) * SIGNIN_STREAK_XP_PER_DAY
  );
  return extra;
}

function getMilestoneBonus(streak) {
  const hit = SIGNIN_MILESTONES.find((m) => m.days === streak);
  return hit ? { xp: hit.xp, label: hit.label } : null;
}

function getNextMilestone(streak) {
  return SIGNIN_MILESTONES.find((m) => m.days > streak) ?? null;
}

export function getCheckInStatus(save) {
  const ci = ensureCheckIn(save);
  const today = appDayKey();
  const signedToday = ci.lastDay === today;
  const next = getNextMilestone(ci.streak);

  return {
    streak: ci.streak,
    maxStreak: ci.maxStreak,
    totalDays: ci.totalDays,
    signedToday,
    todayRecord: ci.history[today] ?? null,
    nextMilestone: next,
    daysUntilNext: next ? next.days - ci.streak : 0,
  };
}

export function performCheckIn(save) {
  if (hasCheckedInToday(save)) {
    return { ok: false, error: "今日已签到" };
  }

  const ci = ensureCheckIn(save);
  const today = appDayKey();
  const yesterday = appYesterdayKey();

  let newStreak = 1;
  if (ci.lastDay === yesterday) {
    newStreak = ci.streak + 1;
  }

  const streakBonus = computeStreakBonus(newStreak);
  const milestone = getMilestoneBonus(newStreak);
  const milestoneXp = milestone?.xp ?? 0;
  const totalXp = SIGNIN_BASE_XP + streakBonus + milestoneXp;

  const xpResult = addGrowthXp(save, totalXp);

  ci.streak = newStreak;
  ci.maxStreak = Math.max(ci.maxStreak, newStreak);
  ci.lastDay = today;
  ci.totalDays += 1;
  ci.history[today] = {
    at: Date.now(),
    streak: newStreak,
    baseXp: SIGNIN_BASE_XP,
    streakBonus,
    milestoneXp,
    milestoneLabel: milestone?.label ?? null,
    totalXp,
    levelUps: xpResult.levelUps,
  };

  const parts = [`+${SIGNIN_BASE_XP} 基础`];
  if (streakBonus > 0) parts.push(`+${streakBonus} 连续${newStreak}天`);
  if (milestone) parts.push(`🎉 ${milestone.label} +${milestoneXp}`);

  return {
    ok: true,
    streak: newStreak,
    totalXp,
    xpResult,
    milestone,
    message: parts.join(" · "),
  };
}

/** 最近 N 天签到状态（用于小日历） */
export function getRecentCheckInDays(save, count = 7) {
  const ci = ensureCheckIn(save);
  const days = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = appDayKey(d);
    days.push({
      key,
      label: d.getDate(),
      weekday: ["日", "一", "二", "三", "四", "五", "六"][d.getDay()],
      signed: Boolean(ci.history[key]),
      isToday: key === appDayKey(),
    });
  }
  return days;
}
