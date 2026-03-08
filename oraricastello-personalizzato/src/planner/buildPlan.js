const { programData } = require("../data/program");
const FINAL_BOLD_NOTE =
  "Durante la giornata puoi ritirare presso la postazione del fotografo - all'interno del Castello - una copia stampata della tua foto di famiglia in omaggio (servizio offerto dal fotografo)";

function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function fmtTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function getStayDurationMinutes(stayDuration, availableMins) {
  const bounded = Math.max(0, availableMins);
  if (stayDuration === "over_4h") return Math.min(300, bounded);
  if (stayDuration === "between_2_5h_4h") return Math.min(240, bounded);
  return Math.min(150, bounded);
}

function normalizeInterests(inputInterests = []) {
  const m = {
    principesse: "principesse",
    huntrix: "huntrix",
    maghi: "maghi",
    natura: "natura",
    benessere: "benessere",
    passeggiate: "passeggiate",
    "pic-nic": "pic-nic",
    "punti ristoro": "pic-nic",
    ristorante: "pic-nic",
  };
  return inputInterests.map((i) => m[i.toLowerCase()] || i.toLowerCase());
}

function getActivity(id) {
  return programData.activities.find((a) => a.id === id);
}

function getTimeConstraintDuration(name, fallback) {
  const c = (programData.recommendationRules?.time_constraints || []).find((t) => t.name === name);
  return Number(c?.duration_min || fallback);
}

function evaluateRuleCondition(condition, context) {
  const c = String(condition || "").toLowerCase();
  if (!c || c === "any_user") return true;
  if (c.includes("children_present") && !context.hasChildren) return false;
  if (c.includes("adults_present") && !context.adultsPresent) return false;
  if (c.includes("children_age_max>=7") && !(context.maxChildAge !== null && context.maxChildAge >= 7)) return false;
  if (c.includes("children_age_max<=8") && !(context.maxChildAge !== null && context.maxChildAge <= 8)) return false;
  if (c.includes("children_age_max<=7") && !(context.maxChildAge !== null && context.maxChildAge <= 7)) return false;
  return true;
}

function getAlwaysIncludeSet(context) {
  const set = new Set();
  const rules = programData.recommendationRules?.always_include || [];
  rules.forEach((r) => {
    if (evaluateRuleCondition(r.condition, context)) {
      (r.include || []).forEach((id) => set.add(id));
    }
  });
  return set;
}

function getPreferenceMustIncludeSet(context) {
  const set = new Set();
  const reqs = programData.recommendationRules?.preference_requirements || [];
  reqs.forEach((r) => {
    if (context.interests.includes(String(r.preference || "").toLowerCase())) {
      (r.must_include || []).forEach((id) => set.add(id));
    }
  });
  return set;
}

function scoreActivity(activity, context) {
  let score = 10;
  const interestSet = new Set(context.interests);
  if (activity.interests?.some((i) => interestSet.has(i))) score += 35;
  if (context.hasChildren && activity.childFriendly) score += 12;
  if (!context.hasChildren && activity.adultsOnly) score += 12;
  if (context.minChildAge !== null && activity.maxAge && context.minChildAge > activity.maxAge) score -= 100;
  if (activity.adultsOnly && context.hasChildren) score -= 15;
  return score;
}

function hasOverlap(selected, start, end) {
  return selected.some((s) => start < s.end && end > s.time);
}

function addBlock(selected, block) {
  if (block.time >= block.end) return false;
  const overlaps = selected.filter((s) => block.time < s.end && block.end > s.time);
  if (overlaps.length) {
    const blockPriority = block.priority || 0;
    const canReplace = overlaps.every((o) => (o.priority || 0) < blockPriority);
    if (!canReplace) return false;
    overlaps.forEach((o) => {
      const idx = selected.indexOf(o);
      if (idx >= 0) selected.splice(idx, 1);
    });
  }
  selected.push(block);
  return true;
}

function findFixedStart(starts, durationMins, notBefore, selected, endLimit = Number.POSITIVE_INFINITY) {
  const ordered = starts.map(toMinutes).sort((a, b) => a - b);
  for (const start of ordered) {
    if (start < notBefore) continue;
    const end = start + durationMins;
    if (end > endLimit) continue;
    if (!hasOverlap(selected, start, end)) return { time: start, end };
  }
  return null;
}

function findRangeSlot(activity, durationMins, notBefore, selected, endLimit = Number.POSITIVE_INFINITY) {
  const ranges = (activity.openRanges || []).map(([s, e]) => ({ start: toMinutes(s), end: toMinutes(e) }));
  for (const range of ranges) {
    let candidate = Math.max(range.start, notBefore);
    const cappedEnd = Math.min(range.end, endLimit);
    while (candidate + durationMins <= cappedEnd) {
      if (!hasOverlap(selected, candidate, candidate + durationMins)) {
        return { time: candidate, end: candidate + durationMins };
      }
      candidate += 5;
    }
  }
  return null;
}

function scheduleAlwaysSentiero(selected, arrivalMins, endLimit, mandatorySet) {
  if (!mandatorySet.has("sentiero_incantato")) return;
  const sentiero = getActivity("sentiero_incantato");
  const minDuration = getTimeConstraintDuration("sentiero_block", 60);
  const slot = findRangeSlot(sentiero, minDuration, arrivalMins, selected, endLimit);
  if (!slot) return;
  addBlock(selected, {
    time: slot.time,
    end: slot.end,
    title: sentiero.name,
    location: sentiero.location,
    reason: "tappa obbligatoria (almeno 1 ora)",
      score: 1000,
      priority: 700,
  });
}

function scheduleChildrenRules(selected, context, arrivalMins, endLimit, mandatorySet) {
  if (mandatorySet.has("kpop")) {
    const kpop = getActivity("kpop");
    const slot = findFixedStart(kpop.starts, 40, arrivalMins, selected, endLimit);
    if (slot) {
      addBlock(selected, {
        time: slot.time,
        end: slot.end,
        title: kpop.name,
        location: kpop.location,
        reason: "obbligatoria: bambini da 7 anni in su",
        score: 1000,
        priority: 1000,
      });
    }
  }

  if (mandatorySet.has("bee_dance")) {
    const bee = getActivity("bee_dance");
    const slot = findRangeSlot(bee, 30, arrivalMins, selected, endLimit);
    if (slot) {
      addBlock(selected, {
        time: slot.time,
        end: slot.end,
        title: bee.name,
        location: bee.location,
        reason: "obbligatoria: bambini fino a 8 anni (presenza 30 min)",
        score: 1000,
        priority: 1000,
      });
    }
  }

  if (mandatorySet.has("snoezelen")) {
    const snoezelen = getActivity("snoezelen");
    const slot = findFixedStart(snoezelen.starts, 20, arrivalMins, selected, endLimit);
    if (slot) {
      addBlock(selected, {
        time: slot.time,
        end: slot.end,
        title: snoezelen.name,
        location: snoezelen.location,
        reason: "obbligatoria: bambini 0-7 anni",
        score: 1000,
        priority: 1000,
      });
    }
  }
}

function scheduleAdultsWellness(selected, context, arrivalMins, endLimit, mandatorySet) {
  if (context.hasChildren) return;
  const targetIds = ["yin_yoga", "meditazione_cuore"].filter((id) => mandatorySet.has(id));
  if (!targetIds.length) return;
  targetIds.forEach((id) => {
    const a = getActivity(id);
    const slot = findFixedStart(a.starts, 30, arrivalMins, selected, endLimit);
    if (slot) {
      addBlock(selected, {
        time: slot.time,
        end: slot.end,
        title: a.name,
        location: a.location,
        reason: "obbligatoria adulti: benessere",
        score: 950,
        priority: 800,
      });
    }
  });
}

function schedulePrincessRules(selected, arrivalMins, endLimit, preferenceMustSet) {
  const targetIds = ["principesse", "ballo_castello"].filter((id) => preferenceMustSet.has(id));
  if (!targetIds.length) return;
  targetIds.map(getActivity).forEach((a) => {
    const slot = findRangeSlot(a, 30, arrivalMins, selected, endLimit);
    if (slot) {
      addBlock(selected, {
        time: slot.time,
        end: slot.end,
        title: a.name,
        location: a.location,
        reason: "preferenza principesse",
        score: 900,
        priority: 820,
      });
    }
  });
}

function scheduleMaghiRules(selected, context, arrivalMins, endLimit, preferenceMustSet) {
  if (!preferenceMustSet.has("scuola_magia") && !preferenceMustSet.has("stanza_segreti_mago") && !preferenceMustSet.has("mago_merlino")) return;
  const scuola = getActivity("scuola_magia");
  const stanza = getActivity("stanza_segreti_mago");
  const merlino = getActivity("mago_merlino");

  const maghiSessions = [];
  (scuola.subActivities || []).forEach((sub) => {
    sub.starts.forEach((s) => {
      maghiSessions.push({
        time: toMinutes(s),
        end: toMinutes(s) + (sub.durationMins || 15),
        title: `${sub.name} (${scuola.name})`,
        location: scuola.location,
        reason: "preferenza maghi: lezione",
        score: 850,
        priority: 900,
      });
    });
  });
  (stanza.subActivities || []).forEach((sub) => {
    sub.starts.forEach((s) => {
      maghiSessions.push({
        time: toMinutes(s),
        end: toMinutes(s) + (sub.durationMins || 20),
        title: `${sub.name} (${stanza.name})`,
        location: stanza.location,
        reason: "preferenza maghi: appuntamento speciale",
        score: 840,
        priority: 900,
      });
    });
  });

  maghiSessions
    .filter((m) => m.time >= arrivalMins && m.end <= endLimit)
    .sort((a, b) => a.time - b.time)
    .forEach((m) => addBlock(selected, m));

  const merlinoSlot = findRangeSlot(merlino, 30, arrivalMins, selected, endLimit);
  if (merlinoSlot) {
    addBlock(selected, {
      time: merlinoSlot.time,
      end: merlinoSlot.end,
      title: merlino.name,
      location: merlino.location,
      reason: "preferenza maghi: incontro con Merlino",
      score: 830,
      priority: 890,
    });
  }
}

function buildCandidateBlocks(arrivalMins, endLimit, context, selected) {
  const blocks = [];
  programData.activities.forEach((a) => {
    // Attivita con inizio preciso
    if (a.starts?.length) {
      a.starts.forEach((s) => {
        const t = toMinutes(s);
        if (t < arrivalMins) return;
        const duration = a.id === "kpop" ? 40 : a.id === "bee_dance" ? 30 : 30;
        if (t + duration > endLimit) return;
        blocks.push({
          time: t,
          end: t + duration,
          title: a.name,
          location: a.location,
          reason: "attivita consigliata",
          score: scoreActivity(a, context),
        priority: 100,
        });
      });
      return;
    }

    // Attivita in range senza start fisso
    const slot = findRangeSlot(a, 30, arrivalMins, selected, endLimit);
    if (!slot) return;
    blocks.push({
      time: slot.time,
      end: slot.end,
      title: a.name,
      location: a.location,
      reason: "attivita consigliata",
      score: scoreActivity(a, context),
      priority: 100,
    });
  });

  return blocks.sort((a, b) => b.score - a.score || a.time - b.time);
}

function buildPersonalPlan(payload) {
  const hasChildren = payload.hasChildren === true;
  const childrenAges = (payload.childrenAges || []).map((n) => Number(n)).filter((n) => !Number.isNaN(n));
  const minChildAge = childrenAges.length ? Math.min(...childrenAges) : null;
  const maxChildAge = childrenAges.length ? Math.max(...childrenAges) : null;
  const arrivalTime = payload.arrivalTime || "10:00";
  const arrivalMins = toMinutes(arrivalTime);
  const parkCloseMins = toMinutes(programData.gates.parkClose || "17:30");
  const availableMins = Math.max(0, parkCloseMins - arrivalMins);
  const requestedMins = getStayDurationMinutes(payload.stayDuration, availableMins);
  const endLimit = arrivalMins + requestedMins;
  const interests = normalizeInterests(payload.interests || []);

  const context = { hasChildren, adultsPresent: true, minChildAge, maxChildAge, interests };
  const selected = [];
  const mandatorySet = getAlwaysIncludeSet(context);
  const preferenceMustSet = getPreferenceMustIncludeSet(context);

  // 1) Regole obbligatorie
  scheduleChildrenRules(selected, context, arrivalMins, endLimit, mandatorySet);
  scheduleAdultsWellness(selected, context, arrivalMins, endLimit, mandatorySet);
  schedulePrincessRules(selected, arrivalMins, endLimit, preferenceMustSet);
  scheduleMaghiRules(selected, context, arrivalMins, endLimit, preferenceMustSet);
  scheduleAlwaysSentiero(selected, arrivalMins, endLimit, mandatorySet);

  // 2) Riempimento intelligente
  const candidates = buildCandidateBlocks(arrivalMins, endLimit, context, selected);
  candidates.forEach((item) => {
    if (selected.length >= 10) return;
    if (item.time >= toMinutes(programData.gates.activitiesEnd)) return;
    addBlock(selected, item);
  });

  if (!selected.length) {
    selected.push({
      time: arrivalMins,
      end: Math.min(arrivalMins + 60, endLimit),
      title: "Sentiero Incantato del Castello",
      location: "Parco",
      reason: "proposta jolly",
      priority: 50,
    });
  }

  const itinerary = selected
    .sort((a, b) => a.time - b.time)
    .map((s) => ({
    start: fmtTime(s.time),
    end: fmtTime(s.end),
    activity: s.title,
    location: s.location,
    note: s.reason,
    }));

  const summary = `Arrivo previsto alle ${arrivalTime}. Durata richiesta: ${Math.round(requestedMins / 10) * 10} minuti. Itinerario ottimizzato su ${itinerary.length} tappe in base alle preferenze indicate.`;
  return {
    event: programData.eventName,
    metadata: {
      hasChildren,
      childrenAges,
      interests,
      arrivalTime,
      stayDuration: payload.stayDuration,
    },
    summary,
    itinerary,
    finalNote: FINAL_BOLD_NOTE,
  };
}

module.exports = { buildPersonalPlan };
