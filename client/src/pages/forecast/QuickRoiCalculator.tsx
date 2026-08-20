import { useMemo, useState, useEffect, useRef } from "react";
import { ArrowRight, ChevronDown, Download } from "lucide-react";
import { QUICK_ROI_PDF_STORAGE_KEY } from "@/components/forecast/QuickRoiEditorialPdf";
import { FormattedNumberInput } from "@/components/FormattedNumberInput";
import { UnifiedHeader, UnifiedHeaderSpacer } from "@/components/UnifiedHeader";
import {
  type SettingKey,
  type RoiDriver,
  type RoiField,
  type RoiAccount,
  type Domain,
  SETTING_META,
  DRIVERS,
  DOMAIN_ORDER,
  DOMAIN_GOALS,
  type PayerModel,
  defaultVals,
  defaultEnabled,
  runRoi,
  withFullRealization,
} from "./roiEngine";

/**
 * ROI Calculator — the whole of the Self Service ROI Tool.
 *
 * A guided, editorial flow that a practice drives on its own, with no Abridge
 * rep in the room and no impact-analysis data pull to read from. It asks four
 * things: which setting, how big the practice is, what they believe would
 * change, and what Abridge would cost. Out comes a defensible annual figure.
 *
 * Because the practice is evaluating rather than measuring, "adoption" here
 * means the rollout they are planning, not a live go-live count, and every
 * before/after is a number they set themselves rather than one read off a pull.
 * The arithmetic is unchanged either way.
 *
 * Every dollar is produced by the SAME canonical Explore engine
 * (`computeAllDriverValues`) — see `roiEngine.ts`. The "how the number is built"
 * line is the engine's own calc-summary string, so the number and its arithmetic
 * can never disagree.
 *
 * Design rules this screen must never break:
 *   - every input is editable, including realization / attribution — no locked
 *     numbers, ever;
 *   - nothing is pre-filled with invented data: a blank field stays blank and
 *     the benchmark shows as a ghost placeholder;
 *   - nothing counts until the practice switches it on;
 *   - the drivers are the real per-setting drivers (the ED has LWBS and
 *     admission capture, not HCC) — nothing invented;
 *   - reclaimed documentation time is shown as a COUNT of clinician hours, never
 *     dollarized on its own.
 *
 * The headline figure runs the engine on the encounters their planned rollout
 * would cover (clinicians using it × their visits × the share documented). The
 * upside re-runs the same engine with the adoption and usage dials turned up.
 * Volume scales, the per-encounter effect never does.
 */

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtShort = (n: number) => {
  const a = Math.abs(n);
  // sign outside the symbol: "-$120K", never "$-120K"
  const sign = n < 0 ? "-" : "";
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
  return `${sign}$${Math.round(a)}`;
};

function useCountUp(value: number, ms = 550): number {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number>();
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (value - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, ms]);
  return shown;
}

const EYEBROW = "text-[10.5px] font-extrabold tracking-[0.14em] uppercase text-[#A69A88]";
const STEPS = ["Your goals", "Your numbers", "What changes", "Your number"];

interface Props { onBack: () => void; onHome: () => void; }

export default function QuickRoiCalculator({ onBack, onHome }: Props) {
  const [setting, setSetting] = useState<SettingKey | null>(null);
  const [step, setStep] = useState(0); // 0 = goals, 1 = account, 2 = lift, 3 = answer
  const inPicker = setting === null;
  // Every step change starts a new screen — always open it at the top. Without
  // this, advancing while scrolled down (e.g. Lift -> Answer) opens the next
  // screen mid-page. App-level scroll reset only fires on view changes, not on
  // these in-flow step changes.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [step, setting]);
  const goBack = () => {
    if (inPicker) onBack();
    else if (step > 0) setStep(step - 1);
    else { setSetting(null); setStep(0); }
  };

  const onStepClick = (n: number) => {
    if (n === 1) { setSetting(null); setStep(0); }
    else setStep(n - 2);
  };
  return (
    <div className="min-h-screen bg-[#FDFCFA] text-[#5E534A] antialiased">
      <UnifiedHeader
        pathType="forecast"
        pathLabel=""
        currentStep={inPicker ? 1 : step + 2}
        totalSteps={5}
        stepName={inPicker ? "Care setting" : STEPS[step]}
        onBack={goBack}
        onHome={onHome}
        onStepClick={onStepClick}
        stepLabels={["Care setting", "Your goals", "Your numbers", "What changes", "Your number"]}
      />
      <style>{SLIDER_CSS}</style>
      <UnifiedHeaderSpacer />
      <div className="max-w-[760px] mx-auto px-5 sm:px-8">
        {inPicker
          ? <SettingPicker onPick={(s) => { setSetting(s); setStep(0); }} />
          : <Wizard key={setting} setting={setting} step={step} setStep={setStep} onChangeSetting={() => { setSetting(null); setStep(0); }} />}
      </div>
    </div>
  );
}

function SettingPicker({ onPick }: { onPick: (s: SettingKey) => void }) {
  return (
    <div className="pt-12 sm:pt-16 pb-24">
      <div className={EYEBROW}>ROI Calculator</div>
      <h1 className="font-abridge text-[28px] sm:text-[34px] leading-[1.12] text-[#4A3F35] mt-4 max-w-[640px]">Where does most of your documentation happen?</h1>
      <p className="mt-5 text-[16px] leading-[1.55] text-[#8C8073] max-w-[520px]">
        Pick one to start. Each setting is scored on its own drivers, so the questions after this are the ones that fit how you actually work.
      </p>
      <div className="mt-12 border-t border-[#E8E2DA] max-w-[680px]">
        {(Object.keys(SETTING_META) as SettingKey[]).map((k) => (
          <button key={k} onClick={() => onPick(k)}
            className="group w-full text-left flex items-center justify-between gap-6 py-[22px] border-b border-[#E8E2DA] hover:pl-2 transition-all">
            <div>
              <div className="font-abridge text-[24px] text-[#1A1A1A] group-hover:text-[#EA2C00] transition-colors leading-tight">{SETTING_META[k].label}</div>
              <div className="text-[13.5px] text-[#A69A88] mt-[3px]">{SETTING_META[k].blurb}</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[#C9BDAD] group-hover:text-[#EA2C00] group-hover:translate-x-1 transition-all flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Wizard({ setting, step, setStep, onChangeSetting }: { setting: SettingKey; step: number; setStep: (n: number) => void; onChangeSetting: () => void }) {
  const meta = SETTING_META[setting];
  const d = meta.defaults;
  const isNursing = !!meta.isNursing;
  // Everything is scoped to THIS care setting, not the whole system.
  const scopeWord = isNursing ? "nurses" : `${meta.label.toLowerCase()} clinicians`;
  const settingWord = meta.label.toLowerCase();
  const orgWord = meta.orgWord;

  // ── account ──────────────────────────────────────────────────────────────
  const [practice, setPractice] = useState("");
  const [totalProviders, setTotalProviders] = useState(d.totalProviders);
  const [onAbridge, setOnAbridge] = useState(d.onAbridge);
  const [encPerProvider, setEncPerProvider] = useState(d.encPerProvider);
  const [utilNow, setUtilNow] = useState(d.utilNow);
  const [staffedBeds, setStaffedBeds] = useState(d.staffedBeds ?? 0);
  // You cannot roll Abridge out to more clinicians than you employ. The input
  // caps while typing, but the total can be lowered AFTER the subset is set,
  // which would leave a stale value above it: adoption over 100%, and an upside
  // slider whose floor sits above its own ceiling. Pull it back down.
  // Depend on the TOTAL only, and use the functional updater so the current
  // subset is read at commit time. The first version listed onAbridge in its
  // deps and also set it, which is a feedback loop: it could fire on a render
  // where the comparison was momentarily true and stamp the total over a value
  // the user had just typed, then blank the field after it. React bails out
  // when the updater returns the same value, so this cannot re-enter.
  useEffect(() => {
    if (totalProviders > 0) setOnAbridge((cur) => (cur > totalProviders ? totalProviders : cur));
  }, [totalProviders]);
  const [occupancy, setOccupancy] = useState(d.occupancy ?? 0);
  // Documentation minutes in notes (before -> after). Feeds Patient Access
  // dollars (outpatient) and the reclaimed-hours proof (all physician settings).
  // Blank by default: the practice sets its own before and after. The setting's
  // benchmark shows only as a ghost placeholder, never as a pre-filled value we
  // pretend is theirs.
  const [timeBefore, setTimeBefore] = useState(0);
  const [timeAfter, setTimeAfter] = useState(0);

  // ── drivers ──────────────────────────────────────────────────────────────
  const [vals, setVals] = useState<Record<string, number>>(() => defaultVals(setting));
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => defaultEnabled(setting));
  const setVal = (k: string, v: number) => setVals((p) => ({ ...p, [k]: v }));
  const toggle = (id: string) => setEnabled((prev) => {
    const next = { ...prev, [id]: !prev[id] };
    // turning a parent off takes its dependants with it
    if (!next[id]) {
      for (const d of DRIVERS[setting]) if (d.dependsOn === id) next[d.id] = false;
    }
    return next;
  });

  // ── headroom dials ────────────────────────────────────────────────────────
  const adoptionNow = totalProviders > 0 ? (onAbridge / totalProviders) * 100 : 0;
  // Default the upside to a reachable stretch: a step up in adoption from where
  // they are today (floored at 70%), at full utilization. Always shows real
  // headroom, never claims 100% of providers. The rep dials it to reality.
  const [targetAdoptionPct, setTargetAdoptionPct] = useState(() => {
    const now = d.totalProviders > 0 ? (d.onAbridge / d.totalProviders) * 100 : 0;
    return Math.min(100, Math.max(Math.round(now) + 15, 70));
  });
  // The account starts blank (the practice types its own facts in), so the
  // stretch target has to recompute once the real adoption is in — otherwise it
  // stays frozen at the blank-state 70% and can sit BELOW today's adoption (a
  // regressive "upside"). Re-derive a reachable stretch whenever adoption changes;
  // it never lands below where they are today.
  useEffect(() => {
    setTargetAdoptionPct(Math.min(100, Math.max(Math.round(adoptionNow) + 15, 70)));
  }, [adoptionNow]);
  // Utilization stretch: a credible ceiling, never a literal 100% of every note.
  // Caps at 90% and never sits below where they are today (recomputes with utilNow).
  const utilStretch = (u: number) => Math.max(Math.round(u), Math.min(90, Math.round(u) + 12));
  const [targetUtilPct, setTargetUtilPct] = useState(() => utilStretch(d.utilNow));
  useEffect(() => {
    setTargetUtilPct(utilStretch(utilNow));
  }, [utilNow]);
  const [price, setPrice] = useState(0);

  // HCC panel size is account-specific (the MA / risk-adjusted membership from the
  // practice's own risk-adjustment pull), so we never fabricate it from provider
  // count. It stays blank until the practice enters the real number; the driver reads
  // $0 until then rather than inflating off a guessed panel.

  const account: RoiAccount = useMemo(() => ({
    totalProviders, onAbridge, encPerProvider, utilNow,
    minutesSaved: isNursing ? 0 : Math.max(0, timeBefore - timeAfter),
    staffedBeds: isNursing ? staffedBeds : undefined,
    occupancy: isNursing ? occupancy : undefined,
  }), [totalProviders, onAbridge, encPerProvider, utilNow, isNursing, timeBefore, timeAfter, staffedBeds, occupancy]);

  // Both runs come straight from the canonical engine.
  const today = useMemo(() => runRoi(setting, account, vals, enabled), [setting, account, vals, enabled]);
  const potential = useMemo(
    () => runRoi(setting, account, vals, enabled, { adoptionPct: targetAdoptionPct, utilPct: targetUtilPct }),
    [setting, account, vals, enabled, targetAdoptionPct, targetUtilPct],
  );
  // Top of the range: the same plan with none of the "how much of this sticks"
  // haircuts applied. The practice is never asked to set those, so the honest
  // way to show them is as the gap between a cautious and an optimistic read.
  const todayFull = useMemo(
    () => runRoi(setting, account, withFullRealization(vals), enabled),
    [setting, account, vals, enabled],
  );
  // The rollout figure has to be on the same basis as the headline, or the top
  // of the headline range can read higher than the "if you expand" number.
  const potentialFull = useMemo(
    () => runRoi(setting, account, withFullRealization(vals), enabled, { adoptionPct: targetAdoptionPct, utilPct: targetUtilPct }),
    [setting, account, vals, enabled, targetAdoptionPct, targetUtilPct],
  );

  const encToday = onAbridge * encPerProvider * (utilNow / 100);
  const hoursReclaimed = isNursing ? 0 : today.totalHoursSaved;
  const practiceName = practice.trim() || `your ${orgWord}`;

  const todayValue = today.total;
  const todayValueFull = Math.max(todayFull.total, todayValue);
  const potentialValue = Math.max(potential.total, todayValue);
  const potentialValueFull = Math.max(potentialFull.total, todayValueFull, potentialValue);
  const headroom = Math.max(0, potentialValue - todayValue);

  const breakdown = DRIVERS[setting]
    .filter((dr) => enabled[dr.id] && (today.valueById[dr.id] ?? 0) > 0)
    .map((dr) => ({ title: dr.title, value: today.valueById[dr.id] }));

  // ── lift-step domain tabs ──────────────────────────────────────────────────
  const [liftTab, setLiftTab] = useState(0);
  // Every domain this setting could speak to.
  const availableDomains = useMemo(() => DOMAIN_ORDER.filter((dom) => {
    const hasDrivers = DRIVERS[setting].some((dr) => dr.domain === dom);
    const capacityTime = dom === "Capacity" && !isNursing; // reclaimed-hours proof lives here
    return (hasDrivers || capacityTime) && !!DOMAIN_GOALS[setting][dom];
  }), [setting, isNursing]);
  // What they said they were actually trying to fix. That choice, not the
  // catalogue, decides how many sections the next step has.
  const [goals, setGoals] = useState<Domain[]>([]);
  // Only ask how they are paid when the setting actually has both kinds of
  // revenue driver. An ED has no risk-capture card, so the question would be
  // a dead end there.
  const hasPayerSplit = useMemo(
    () => DRIVERS[setting].some((d) => d.payerModel === "vbc") && DRIVERS[setting].some((d) => d.payerModel === "ffs"),
    [setting],
  );
  const [payerModel, setPayerModel] = useState<PayerModel | "both" | null>(null);
  const revenuePicked = goals.includes("Revenue");
  // Switching the payer answer must also switch OFF anything it hides, or a
  // driver the practice can no longer see keeps contributing to their total.
  useEffect(() => {
    if (!hasPayerSplit) return;
    setEnabled((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const d of DRIVERS[setting]) {
        const hidden = !!d.payerModel && payerModel !== null && payerModel !== "both" && d.payerModel !== payerModel;
        if (hidden && next[d.id]) { next[d.id] = false; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [payerModel, hasPayerSplit, setting]);
  const needsPayerModel = hasPayerSplit && revenuePicked && payerModel === null;
  const toggleGoal = (d: Domain) => setGoals((g) => (g.includes(d) ? g.filter((x) => x !== d) : [...g, d]));
  const domains = useMemo(
    () => availableDomains.filter((d) => goals.includes(d)),
    [availableDomains, goals],
  );
  useEffect(() => { setLiftTab(0); }, [goals.length]);
  const tabSummary = (dom: Domain): string => {
    const dollar = DRIVERS[setting]
      .filter((dr) => dr.domain === dom && enabled[dr.id])
      .reduce((s, dr) => s + (today.valueById[dr.id] ?? 0), 0);
    if (dollar > 0) return fmtShort(dollar);
    // Capacity is a signal, never a toggle: it shows hours, or says it is waiting
    // on the minutes. Everything else says how many cards are still off. One
    // vocabulary, so two null states are never ambiguous side by side.
    if (dom === "Capacity" && !isNursing) return hoursReclaimed > 0 ? `${fmtInt(hoursReclaimed)} hrs` : "Add minutes";
    const cards = DRIVERS[setting].filter((dr) => dr.domain === dom).length;
    return cards > 0 ? `${cards} to switch on` : "Nothing on";
  };
  const activeDomain = domains[Math.min(liftTab, Math.max(0, domains.length - 1))];

  // Export the one-pager: stash a snapshot of the inputs and open the HTML print
  // route (?quickroipdf=1&print=1). The PDF recomputes from these same inputs
  // through runRoi, so it reconciles with this screen by construction.
  const onExportPdf = () => {
    const data = {
      orgName: practice.trim() || "Your practice",
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      setting, account, vals, enabled, price, targetAdoptionPct, targetUtilPct,
    };
    try { localStorage.setItem(QUICK_ROI_PDF_STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    window.open(`${window.location.pathname}?quickroipdf=1&print=1`, "_blank", "noopener");
  };

  return (
    <div className="pt-10 pb-28">
      <div className="mb-7 text-[11px] font-extrabold tracking-[0.14em] uppercase text-[#A69A88]">
        {meta.label} <button onClick={onChangeSetting} className="text-[#B4A896] hover:text-[#EA2C00] transition-colors">· change</button>
      </div>

      {step === 0 && (
        <StepShell
          title="What are you hoping Abridge fixes?"
          sub="Pick everything that matters to you, one or more. Only what you choose gets asked about, and only what you choose can add to the number.">
          <div className="border-t border-[#E8E2DA]">
            {availableDomains.map((dom) => {
              const goal = DOMAIN_GOALS[setting][dom]!;
              const on = goals.includes(dom);
              return (
                <button
                  key={dom}
                  type="button"
                  onClick={() => toggleGoal(dom)}
                  aria-pressed={on}
                  data-testid={`goal-${dom.toLowerCase()}`}
                  className={`group w-full text-left flex items-start justify-between gap-6 px-4 sm:px-5 py-6 border-b border-[#E8E2DA] border-l-[3px] transition-colors ${on ? "border-l-[#EA2C00] bg-[#FDFBF8]" : "border-l-transparent hover:bg-[#FBF8F4]"}`}
                >
                  <div className="min-w-0">
                    <div className={`text-[10.5px] font-extrabold tracking-[0.14em] uppercase ${on ? "text-[#EA2C00]" : "text-[#B4A896]"}`}>{dom}</div>
                    <div className={`font-abridge text-[21px] leading-tight mt-2 ${on ? "text-[#1A1A1A]" : "text-[#4A3F35] group-hover:text-[#1A1A1A]"}`}>{goal.title}</div>
                    <div className="text-[13.5px] leading-[1.5] text-[#8C8073] mt-1.5 max-w-[460px]">{goal.blurb}</div>
                  </div>
                  <span
                    aria-hidden="true"
                    className={`mt-1 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors ${on ? "border-[#EA2C00] bg-[#EA2C00]" : "border-[#D8CFC2] group-hover:border-[#B4A896]"}`}
                  >
                    {on && (
                      <svg viewBox="0 0 12 10" className="h-[11px] w-[11px]" fill="none">
                        <path d="M1 5l3.2 3.2L11 1.4" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {hasPayerSplit && revenuePicked && (
            <div className="mt-8 rounded-xl border border-[#EAE3D9] bg-[#FDFBF8] px-5 sm:px-6 py-6">
              <div className="text-[10.5px] font-extrabold tracking-[0.14em] uppercase text-[#A69A88]">One follow-up on revenue</div>
              <div className="font-abridge text-[20px] leading-tight text-[#1A1A1A] mt-2">How are you paid for this work?</div>
              <p className="text-[13.5px] leading-[1.5] text-[#8C8073] mt-1.5 max-w-[460px]">
                It decides which revenue questions are worth your time. There is no
                point asking a fee-for-service practice about risk capture.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {([
                  { k: "ffs", label: "Fee for service", sub: "you bill per visit" },
                  { k: "vbc", label: "Value based", sub: "you are paid on the panel" },
                  { k: "both", label: "Both", sub: "a mix of the two" },
                ] as const).map((opt) => {
                  const on = payerModel === opt.k;
                  return (
                    <button
                      key={opt.k}
                      type="button"
                      onClick={() => setPayerModel(opt.k)}
                      aria-pressed={on}
                      data-testid={`payer-${opt.k}`}
                      className={`text-left rounded-lg border px-4 py-3 transition-colors ${on ? "border-[#EA2C00] bg-white" : "border-[#E0D9CE] bg-white hover:border-[#B4A896]"}`}
                    >
                      <div className={`text-[14.5px] font-bold ${on ? "text-[#EA2C00]" : "text-[#1A1A1A]"}`}>{opt.label}</div>
                      <div className="text-[12px] text-[#A69A88] mt-0.5">{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="mt-7 text-[15px] leading-[1.6] text-[#5E534A]">
            {needsPayerModel ? (
              <span className="text-[#A69A88]">Answer the revenue question above to carry on.</span>
            ) : goals.length > 0 ? (
              <>You picked <span className="font-abridge text-[#1A1A1A]">{goals.length}</span> of {availableDomains.length}. The next steps will only ask about {goals.length === 1 ? "that one" : "those"}.</>
            ) : (
              <span className="text-[#A69A88]">Pick at least one to carry on.</span>
            )}
          </p>
          <NavRow onNext={() => setStep(1)} nextLabel="Next: your numbers" disabled={goals.length === 0 || needsPayerModel} />
        </StepShell>
      )}

      {step === 1 && (
        <StepShell title={`Now, how big is your ${orgWord}?`} sub="Rough numbers are fine. Nothing here is locked, and you can come back and change any of it.">
          <div className="border-t border-[#E8E2DA]">
            <Row label={`${orgWord.charAt(0).toUpperCase()}${orgWord.slice(1)} name`} hint="only used to label your summary" grow>
              <TextInput value={practice} onChange={setPractice} placeholder={meta.namePlaceholder ?? `e.g., your ${orgWord}`} />
            </Row>
            <Row label={`How many ${scopeWord} are in your ${orgWord}?`} hint={`everyone doing ${settingWord} documentation today`}>
              <NumInput value={totalProviders} onChange={setTotalProviders} placeholder="e.g., 90" />
            </Row>
            <Row label="How many of them would use Abridge?" hint={totalProviders > 0 ? `of your ${fmtInt(totalProviders)} ${scopeWord}. Starting with a subset is normal` : "starting with a subset is normal, you can raise this later"}>
              <NumInput value={onAbridge} onChange={setOnAbridge} placeholder="e.g., 60"
                max={totalProviders > 0 ? totalProviders : undefined} />
            </Row>
            <Row
              label={`About how many ${meta.encWord} does each ${meta.providerWord.replace(/s$/, "")} ${meta.volumeVerb ?? "see"} in a year?`}
              hint={meta.volumeHint ?? "a normal full year, not a busy month scaled up"}>
              <NumInput value={encPerProvider} onChange={setEncPerProvider} placeholder={`e.g., ${meta.volumePlaceholder ?? "2,500"}`} />
            </Row>
            <Row label={`What share of those ${meta.encWord} would you document with Abridge?`} hint={`not every ${meta.encWord.replace(/s$/, "")} suits ambient capture, so this is rarely 100%`}>
              <NumInput value={utilNow} onChange={setUtilNow} suffix="%" placeholder="e.g., 68" />
            </Row>
            {isNursing && (
              <>
                <Row label="How many staffed beds?" hint="beds and occupancy give us the patient-days everything below is counted on">
                  <NumInput value={staffedBeds} onChange={setStaffedBeds} placeholder="e.g., 300" />
                </Row>
                <Row label="Average occupancy?" hint="how full the unit typically runs">
                  <NumInput value={occupancy} onChange={setOccupancy} suffix="%" placeholder="e.g., 85" />
                </Row>
              </>
            )}
          </div>
          <p className="mt-7 text-[15px] leading-[1.6] text-[#5E534A]">
            {encToday > 0 ? (
              <>That puts Abridge on about <span className="font-abridge text-[#1A1A1A]">{fmtInt(encToday)}</span> {meta.encWord} a year: {Math.round(adoptionNow)}% of your {scopeWord}, on {Math.round(utilNow)}% of their {meta.encWord}. Everything from here is calculated on that number.</>
            ) : (
              <span className="text-[#A69A88]">Fill in the numbers above and we'll show how many {meta.encWord} your figure will be built on.</span>
            )}
          </p>
          <NavRow onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Next: what changes" disabled={encToday <= 0} />
        </StepShell>
      )}

      {step === 2 && (
        <StepShell title="So, what would actually change?" sub={`Turn on only the things you believe would move in your ${orgWord}, and set each one yourself. Anything left off counts as zero.`}>
          {/* section tabs — navigate between the domains */}
          <div className="flex items-center gap-7 border-b border-[#E8E2DA] flex-wrap">
            {domains.map((dom, i) => {
              const sum = tabSummary(dom);
              const isNull = sum === "Off" || sum === "—";
              return (
              <button key={dom} onClick={() => setLiftTab(i)} className="relative flex items-baseline gap-2 pb-3 -mb-px outline-none group">
                <span className={`text-[13px] font-bold tracking-[0.01em] transition-colors ${i === liftTab ? "text-[#1A1A1A]" : "text-[#A69A88] group-hover:text-[#5E534A]"}`}>{dom}</span>
                <span className={`font-abridge text-[14px] transition-colors ${i === liftTab && !isNull ? "text-[#EA2C00]" : "text-[#C9BDAD]"}`}>{sum}</span>
                {i === liftTab && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-[#EA2C00]" />}
              </button>
              );
            })}
          </div>

          <div className="pt-6 space-y-4">
            {activeDomain === "Capacity" && !isNursing && meta.timeMetric && (
              <TimeBackBlock table={meta.timeMetric.table} encWord={meta.encWord} before={timeBefore} after={timeAfter}
                onBefore={setTimeBefore} onAfter={setTimeAfter} encToday={encToday} hours={hoursReclaimed}
                dollarized={setting === "outpatient"}
                placeholderBefore={String(meta.timeMetric.before)} placeholderAfter={String(meta.timeMetric.after)} />
            )}
            {DRIVERS[setting].filter((dr) => dr.domain === activeDomain).filter((dr) => {
              // a purely fee-for-service practice never sees the risk-capture
              // card, and vice versa; untagged drivers apply either way
              if (!dr.payerModel || !hasPayerSplit) return true;
              if (payerModel === "both" || payerModel === null) return true;
              return dr.payerModel === payerModel;
            }).map((dr) => (
              <DriverCard key={dr.id} driver={dr} vals={vals} setVal={setVal}
                blockedBy={dr.dependsOn && !enabled[dr.dependsOn]
                  ? (DRIVERS[setting].find((d) => d.id === dr.dependsOn)?.title ?? null)
                  : null}
                on={!!enabled[dr.id]} onToggle={() => toggle(dr.id)} eligibleEncounters={Math.round(encToday)}
                hoursReclaimed={hoursReclaimed} providersOnAbridge={onAbridge}
                value={today.valueById[dr.id] ?? 0} summary={today.summaryById[dr.id] ?? ""} />
            ))}
          </div>
          <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="See my number" />
        </StepShell>
      )}

      {step === 3 && (
        <AnswerStep practiceName={practiceName} encWord={meta.encWord} breakdown={breakdown} todayValue={todayValue} todayValueFull={todayValueFull} potentialValueFull={potentialValueFull} providerWord={meta.providerWord}
          potentialValue={potentialValue} headroom={headroom} hoursReclaimed={hoursReclaimed}
          adoptionNow={adoptionNow} utilNow={utilNow} totalProviders={totalProviders}
          targetAdoptionPct={targetAdoptionPct} setTargetAdoptionPct={setTargetAdoptionPct}
          targetUtilPct={targetUtilPct} setTargetUtilPct={setTargetUtilPct} showUtilDial={!isNursing}
          price={price} setPrice={setPrice} onBack={() => setStep(2)} onExport={onExportPdf} />
      )}
    </div>
  );
}

function StepShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-abridge text-[26px] sm:text-[32px] leading-[1.14] text-[#4A3F35] max-w-[600px]">{title}</h1>
      <p className="mt-3 mb-9 text-[15px] leading-[1.55] text-[#8C8073] max-w-[560px]">{sub}</p>
      {children}
    </div>
  );
}

function Row({ label, hint, grow, children }: { label: string; hint?: string; grow?: boolean; children: React.ReactNode }) {
  return (
    // Below sm every row stacks: label and hint first, then the control on its
    // own line. Side by side, a label that wraps to three lines pushed the input
    // to the vertical middle and left the hint sitting UNDER the input's
    // underline, which reads as a broken layout rather than a dense one.
    <div className="flex flex-col items-stretch gap-y-3 sm:flex-row sm:items-center sm:justify-between sm:gap-x-6 py-5 border-b border-[#E8E2DA]">
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-[#1A1A1A] leading-snug">{label}</div>
        {hint && <div className="text-[12.5px] text-[#A69A88] mt-1 leading-snug">{hint}</div>}
      </div>
      {/* grow: free text has no natural width, so a box sized for a number cuts
          real names off mid-word. Give it the rest of the row on desktop. */}
      <div className={`flex w-full justify-start sm:w-auto sm:justify-end ${grow ? "sm:flex-1 sm:min-w-0" : "sm:flex-shrink-0"}`}>{children}</div>
    </div>
  );
}

// Underlined editorial inputs
// NOTE: the md: duplicates are load-bearing. The shared <Input> ships
// `md:text-sm`; without a same-variant override it beats a base text-[Npx]
// from the md breakpoint up, which is every desktop.
const UINPUT_CLASS = "flex-1 min-w-0 h-auto border-0 rounded-none bg-transparent p-0 shadow-none text-right text-[19px] md:text-[19px] font-bold text-[#1A1A1A] tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:not-italic placeholder:font-normal placeholder:text-[15px] placeholder:text-[#C9BDAD]";
function NumInput({ value, onChange, suffix, prefix, step = 1, w = "w-[168px]", placeholder, max }: { value: number; onChange: (n: number) => void; suffix?: string; prefix?: string; step?: number; w?: string; placeholder?: string; max?: number }) {
  // A field measured in "%" is a share of something: 100 is the ceiling.
  const cap = max ?? (suffix === "%" ? 100 : undefined);
  return (
    <div className={`${w} inline-flex items-baseline gap-1.5 border-b-2 border-[#E0D9CE] focus-within:border-[#EA2C00] transition-colors pb-1`}>
      {prefix && <span className="text-[14px] text-[#A69A88]">{prefix}</span>}
      <FormattedNumberInput value={value} onChange={onChange} step={step} max={cap} className={UINPUT_CLASS} placeholder={placeholder} />
      {suffix && <span className={`text-[14px] text-[#A69A88] ${suffix === "%" ? "-ml-1" : ""}`}>{suffix}</span>}
    </div>
  );
}

function NumInputAccent({ value, onChange, suffix, step = 0.01, w = "w-[96px]", placeholder }: { value: number; onChange: (n: number) => void; suffix?: string; step?: number; w?: string; placeholder?: string }) {
  const cap = suffix === "%" ? 100 : undefined;
  return (
    <div className={`${w} inline-flex items-baseline gap-1.5 border-b-2 border-[#EA2C00] pb-1`}>
      <FormattedNumberInput value={value} onChange={onChange} step={step} max={cap} className={UINPUT_CLASS} placeholder={placeholder} />
      {suffix && <span className="text-[14px] text-[#A69A88]">{suffix}</span>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  return (
    <div className="w-full sm:w-[340px] inline-flex border-b-2 border-[#E0D9CE] focus-within:border-[#EA2C00] transition-colors pb-1">
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-transparent outline-none text-right text-[16px] font-bold text-[#1A1A1A] placeholder:font-normal placeholder:text-[14px] placeholder:text-[#C9BDAD]" />
    </div>
  );
}

function BeforeAfter({ label, table, unit, before, after, onBefore, onAfter, step = 0.01, lowerIsBetter, placeholderBefore, placeholderAfter }: {
  label: string; table?: string; unit?: string; before: number; after: number; onBefore: (n: number) => void; onAfter: (n: number) => void; step?: number; lowerIsBetter?: boolean; placeholderBefore?: string; placeholderAfter?: string;
}) {
  const delta = lowerIsBetter ? before - after : after - before;
  const good = delta > 0;
  const decimals = unit === "min" ? 1 : 2;
  const bothEntered = before > 0 && after > 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[14px] font-medium text-[#1A1A1A]">{label}</span>
        {table && <span className="text-[12px] text-[#A69A88]">from {table}</span>}
      </div>
      <div className="flex items-baseline gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.1em] uppercase text-[#A69A88] mb-1">Today</div>
          <NumInput value={before} onChange={onBefore} step={step} suffix={unit} w="w-[96px]" placeholder={placeholderBefore} />
        </div>
        <ArrowRight className="w-4 h-4 text-[#C9BDAD] self-end mb-2.5" />
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.1em] uppercase text-[#EA2C00] mb-1">With Abridge</div>
          <NumInputAccent value={after} onChange={onAfter} step={step} suffix={unit} w="w-[96px]" placeholder={placeholderAfter} />
        </div>
        {bothEntered && (
          <span className={`self-end mb-2.5 ml-1 text-[14px] font-bold whitespace-nowrap ${good ? "text-[#B02200]" : "text-[#B4A896]"}`}>
            {good ? (lowerIsBetter ? "−" : "+") : ""}{Math.abs(delta).toFixed(decimals)} {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-bold text-[#443A32] tabular-nums">{children}</span>;
}

/** The engine's own multiplicand formula string + the engine's value. */
function WorkedMath({ summary, value, reason }: { summary: string; value: number; reason?: string }) {
  return (
    <div className="mt-7 pt-6 border-t border-[#EFE9E0]">
      <div className="text-[10.5px] font-extrabold tracking-[0.14em] uppercase text-[#A69A88] mb-3">How the number is built</div>
      <div className="text-[15px] leading-[1.9] text-[#5E534A]">{summary || "Set the numbers above and the math builds here."}</div>
      {/* The "x N% counted" factor is the one a sceptic stops on. Say why in
          plain words rather than making them learn which kind of haircut it is. */}
      {reason && summary && (
        <div className="mt-3 text-[13px] leading-[1.55] text-[#8C8073] max-w-[560px]">
          <span className="font-semibold text-[#5E534A]">Why not all of it: </span>{reason}
        </div>
      )}
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-[13px] text-[#A69A88]">equals</span>
        <span className={`font-abridge text-[34px] leading-none ${value > 0 ? "text-[#EA2C00]" : "text-[#C9BDAD]"}`}>{fmtShort(value)}<span className="text-[15px] text-[#9A8C7A]"> a year</span></span>
      </div>
    </div>
  );
}

/** The universal on/off switch that lives in every driver card's header. */
function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle}
      className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#EA2C00] focus-visible:ring-offset-2 ${on ? "bg-[#EA2C00]" : "bg-[#E0D9CE] hover:bg-[#D2C8B8]"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

/**
 * Every driver is its own card with a switch, so any driver can be turned off,
 * and the boundary between one driver and the next is unmistakable. The card's
 * own annual total sits in the header so the list is scannable.
 */
function DriverShell({ title, on, onToggle, value, children, awaiting }: {
  title: string; on: boolean; onToggle: () => void; value: number; children: React.ReactNode; awaiting?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`rounded-xl border transition-colors ${on ? "border-[#EAE3D9] bg-[#FDFBF8]" : "border-[#EFE9E0] bg-transparent"}`}>
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <span className={`text-[17px] font-bold ${on ? "text-[#1A1A1A]" : "text-[#B4A896]"}`}>{title}</span>
        <div className="flex items-center gap-4">
          {!on
            ? <span className="text-[12px] font-semibold text-[#B4A896] whitespace-nowrap">Not counted</span>
            : awaiting
              ? <span className="text-[12px] font-semibold text-[#B4776A] whitespace-nowrap">{awaiting}</span>
              : <span className={`font-abridge text-[18px] tabular-nums ${value > 0 ? "text-[#EA2C00]" : "text-[#C9BDAD]"}`}>{fmtShort(value)}</span>}
          <Toggle on={on} onToggle={onToggle} label={`Include ${title}`} />
        </div>
      </div>
      {on && (
        <div className="px-6 pb-7 border-t border-[#EFE9E0] pt-5">
          <button type="button" onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[0.14em] uppercase text-[#A69A88] mb-4 outline-none focus-visible:ring-2 focus-visible:ring-[#EA2C00] focus-visible:ring-offset-2 rounded">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "" : "-rotate-90"}`} /> The math
          </button>
          {open && children}
        </div>
      )}
    </div>
  );
}

/** Renders one engine driver: before/after (if any) + its editable fields + the worked math. */
function DriverCard({ driver, vals, setVal, on, onToggle, value, summary, eligibleEncounters, hoursReclaimed, providersOnAbridge, blockedBy }: {
  driver: RoiDriver; vals: Record<string, number>; setVal: (k: string, v: number) => void;
  on: boolean; onToggle: () => void; value: number; summary: string; eligibleEncounters: number;
  hoursReclaimed: number; providersOnAbridge: number; blockedBy?: string | null;
}) {
  // This driver is valued off another driver's pool. With the parent off there
  // is no pool, so the card says so instead of offering a switch that would
  // book a dollar against a population the practice just ruled out.
  if (blockedBy) {
    return (
      <div className="rounded-xl border border-[#EFE9E0] px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[17px] font-bold text-[#B4A896]">{driver.title}</span>
          <span className="text-[12px] font-semibold text-[#B4A896] whitespace-nowrap">Needs {blockedBy}</span>
        </div>
        <p className="text-[13px] leading-[1.55] text-[#A69A88] mt-2 max-w-[560px]">
          This is valued from the patients {blockedBy.toLowerCase()} brings back, so switch that on first.
        </p>
      </div>
    );
  }
  if (driver.kind === "hcc") {
    return <HccDriverCard driver={driver} vals={vals} setVal={setVal} on={on} onToggle={onToggle} value={value} summary={summary} />;
  }
  if (driver.id === "drgAccuracy") {
    return <DrgFunnelCard vals={vals} setVal={setVal} on={on} onToggle={onToggle} value={value} discharges={eligibleEncounters} />;
  }
  if (driver.id === "patientAccess") {
    return <PatientAccessCard driver={driver} vals={vals} setVal={setVal} on={on} onToggle={onToggle} value={value} summary={summary} hoursReclaimed={hoursReclaimed} providersOnAbridge={providersOnAbridge} />;
  }
  const workStr = driver.work ? driver.work(vals, eligibleEncounters) : summary;
  const ba = driver.beforeAfter;
  return (
    <DriverShell title={driver.title} on={on} onToggle={onToggle} value={value}>
      {driver.note && <p className="text-[13px] leading-[1.55] text-[#8C8073] max-w-[560px] mb-1">{driver.note}</p>}
      {ba && (
        <div className={driver.note ? "mt-5" : ""}>
          <BeforeAfter label={ba.label} table={ba.table} unit={ba.unit} step={ba.step ?? 0.01}
            before={vals[ba.beforeK]} after={vals[ba.afterK]}
            onBefore={(v) => setVal(ba.beforeK, v)} onAfter={(v) => setVal(ba.afterK, v)}
            lowerIsBetter={ba.lowerIsBetter} />
        </div>
      )}
      {driver.fields.filter((f) => !f.realization).map((f) => (
        <FieldRow key={f.k} field={f} value={vals[f.k]} onChange={(v) => setVal(f.k, v)} />
      ))}
      <WorkedMath summary={workStr} value={value} reason={driver.haircutReason} />
    </DriverShell>
  );
}

function FieldRow({ field, value, onChange }: { field: RoiField; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-6 mt-5">
      <div className="min-w-0">
        <div className="text-[14px] text-[#5E534A]">{field.label}</div>
        {field.hint && <div className="text-[12px] text-[#A69A88] mt-0.5">{field.hint}</div>}
      </div>
      <NumInput value={value} onChange={onChange} prefix={field.prefix} suffix={field.suffix} step={field.step ?? 1} w="w-[120px]" />
    </div>
  );
}

/** Risk capture (HCC) — valued on the panel, once per member per year, never per visit. */
function HccDriverCard({ driver, vals, setVal, on, onToggle, value, summary }: {
  driver: RoiDriver; vals: Record<string, number>; setVal: (k: string, v: number) => void;
  on: boolean; onToggle: () => void; value: number; summary: string;
}) {
  const pops = driver.populations ?? [];
  const [popIdx, setPopIdx] = useState(0);
  // The panel size is the one figure we cannot infer or seed, and without it the
  // card renders a dead $0 with "0 members" in its own worked math, which reads
  // as broken. Say what is needed instead.
  const needsPanel = on && !(vals.hccMembers > 0);
  return (
    <DriverShell title={driver.title} on={on} onToggle={onToggle} value={value} awaiting={needsPanel ? "Add your panel size" : undefined}>
      <p className="text-[13px] leading-[1.55] text-[#8C8073] max-w-[540px] mb-1">Risk capture is valued on the panel, once per member per year, never per visit. Abridge lifts the recapture rate on the conditions a member already carries.</p>

      {pops.length > 0 && (
        <div className="mt-5 flex items-center gap-2 flex-wrap">
          {pops.map((p, i) => (
            <button key={p.label} onClick={() => { setPopIdx(i); setVal("hccPerHcc", p.perHcc); }}
              className={`text-[12px] font-bold rounded-full px-3.5 py-1.5 transition-colors ${i === popIdx ? "bg-[#1A1A1A] text-white" : "border border-[#E8E2DA] text-[#8C8073] hover:border-[#1A1A1A] hover:text-[#1A1A1A]"}`}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-6 mt-6">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-[#1A1A1A]">Risk-adjusted members Abridge covers</div>
          <div className="text-[12.5px] text-[#A69A88] mt-1">the {pops[popIdx]?.label ?? ""} panel your providers see</div>
        </div>
        <NumInput value={vals.hccMembers} onChange={(v) => setVal("hccMembers", v)} placeholder="e.g., 45,000" w="w-[128px]" />
      </div>

      {driver.fields.filter((f) => f.k !== "hccMembers" && !f.realization).map((f) => (
        <FieldRow key={f.k} field={f} value={vals[f.k]} onChange={(v) => setVal(f.k, v)} />
      ))}

      <WorkedMath summary={summary} value={value} reason={driver.haircutReason} />
    </DriverShell>
  );
}

/**
 * Patient access — anchored on the OBSERVED added visits a live practice already
 * sees, not an assumed reinvest %. The read-back shows what share of the
 * reclaimed hours those visits use, so the number stays tied to the time proof.
 */
function PatientAccessCard({ driver, vals, setVal, on, onToggle, value, summary, hoursReclaimed, providersOnAbridge }: {
  driver: RoiDriver; vals: Record<string, number>; setVal: (k: string, v: number) => void;
  on: boolean; onToggle: () => void; value: number; summary: string; hoursReclaimed: number; providersOnAbridge: number;
}) {
  const V = vals.accessVisitsPerProvWk || 0;
  const dur = vals.visitDuration || 30;
  const addedVisits = V * providersOnAbridge * 48;
  const hoursConsumed = addedVisits * (dur / 60);
  const pct = hoursReclaimed > 0 ? Math.round((hoursConsumed / hoursReclaimed) * 100) : 0;
  return (
    <DriverShell title={driver.title} on={on} onToggle={onToggle} value={value}>
      {driver.note && <p className="text-[13px] leading-[1.55] text-[#8C8073] max-w-[560px] mb-1">{driver.note}</p>}
      {driver.fields.filter((f) => !f.realization).map((f) => (
        <FieldRow key={f.k} field={f} value={vals[f.k]} onChange={(v) => setVal(f.k, v)} />
      ))}
      {V > 0 && hoursReclaimed > 0 && (
        <div className="mt-6 rounded-lg bg-[#F3EEE7] px-4 py-3.5 text-[13px] leading-[1.6] text-[#5E534A]">
          That is about <span className="font-bold text-[#443A32]">{fmtInt(addedVisits)}</span> more visits a year, which uses <span className="font-bold text-[#443A32]">{pct}%</span> of the <span className="font-bold text-[#443A32]">{fmtInt(hoursReclaimed)}</span> clinician hours Abridge reclaimed.{" "}
          {pct > 100
            ? "That is more than the reclaimed time alone, so lean on the observed visits and treat the rest as other workflow gains."
            : "The rest of that time stays as capacity."}
        </div>
      )}
      <WorkedMath summary={summary} value={value} reason={driver.haircutReason} />
    </DriverShell>
  );
}

/** Centered, coral, editable rate/number for the DRG funnel table. */
function PctEdit({ value, onChange, suffix = "%", prefix, step = 1 }: { value: number; onChange: (n: number) => void; suffix?: string; prefix?: string; step?: number }) {
  return (
    <span className="inline-flex items-baseline justify-center gap-1 border-b-2 border-[#F3C9BC] pb-0.5 w-[72px]">
      {prefix && <span className="text-[12px] text-[#A69A88]">{prefix}</span>}
      <FormattedNumberInput value={value} onChange={onChange} step={step}
        className="h-auto border-0 rounded-none bg-transparent p-0 shadow-none text-center text-[15px] font-bold text-[#EA2C00] tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0"
        style={{ width: `${String(value).length + 2}ch` }} />
      {suffix && <span className="text-[12px] text-[#A69A88]">{suffix}</span>}
    </span>
  );
}

/**
 * DRG accuracy, modeled as the CDI query funnel. The funnel is the CDI program's
 * baseline (theirs). Abridge's value is the DELTA on the discharges the funnel
 * misses — the leak — netted for audit survival. No attribution/defensible haircut.
 */
function DrgFunnelCard({ vals, setVal, on, onToggle, value, discharges }: {
  vals: Record<string, number>; setVal: (k: string, v: number) => void;
  on: boolean; onToggle: () => void; value: number; discharges: number;
}) {
  const reviewed = discharges * (vals.ipDrgCdiReviewRate / 100);
  const queried = reviewed * (vals.ipDrgQueryRate / 100);
  const responded = queried * (vals.ipDrgResponseRate / 100);
  const changed = responded * (vals.ipDrgChangeRate / 100);
  const cdiRevenue = changed * vals.ipDrgWeightGain * vals.ipDrgBaseRate;
  const lost = Math.max(0, queried - changed); // flagged gaps that die in the funnel
  const abridgeCases = lost * (vals.ipDrgUpfrontCapture / 100);
  const GRID = "grid grid-cols-[1fr_84px_96px] items-baseline";

  const FRow = ({ step, rateK, prefix, suffix, cases, bold }: { step: string; rateK?: string; prefix?: string; suffix?: string; cases: string; bold?: boolean }) => (
    <div className={`${GRID} py-[11px] border-t border-[#EFE9E0]`}>
      <span className={`text-[15px] text-[#1A1A1A] ${bold ? "font-bold" : ""}`}>{step}</span>
      <span className="text-right">{rateK ? <PctEdit value={vals[rateK]} onChange={(v) => setVal(rateK, v)} prefix={prefix} suffix={suffix ?? "%"} step={suffix === "" ? 0.05 : 1} /> : <span className="text-[14px] text-[#A69A88]">—</span>}</span>
      <span className={`text-right tabular-nums ${bold ? "font-abridge text-[19px] text-[#EA2C00]" : "text-[15px] text-[#1A1A1A]"}`}>{cases}</span>
    </div>
  );

  return (
    <DriverShell title="DRG accuracy (CMI)" on={on} onToggle={onToggle} value={value}>
      <p className="text-[13px] leading-[1.55] text-[#8C8073] max-w-[560px] mb-1">DRG revenue moves through the CDI query funnel. This is what it catches today; Abridge is the delta on the gaps your team flags but loses.</p>

      <div className={`${GRID} mt-6 text-[10px] font-extrabold tracking-[0.1em] uppercase text-[#A69A88]`}>
        <span>What the CDI funnel catches today</span><span className="text-right">Rate</span><span className="text-right">Cases</span>
      </div>
      <FRow step="Annual discharges" cases={fmtInt(discharges)} />
      <FRow step="Reviewed by CDI" rateK="ipDrgCdiReviewRate" cases={fmtInt(reviewed)} />
      <FRow step="Query issued" rateK="ipDrgQueryRate" cases={fmtInt(queried)} />
      <FRow step="Physician responds" rateK="ipDrgResponseRate" cases={fmtInt(responded)} />
      <FRow step="Response changes the DRG" rateK="ipDrgChangeRate" cases={fmtInt(changed)} bold />
      <div className="flex items-baseline justify-between gap-3 py-[11px] border-t border-[#EFE9E0] text-[13px] text-[#8C8073]">
        <span className="italic flex items-baseline gap-1.5 flex-wrap">Each moves ~<PctEdit value={vals.ipDrgWeightGain} onChange={(v) => setVal("ipDrgWeightGain", v)} suffix="" step={0.05} /> weight, at <PctEdit value={vals.ipDrgBaseRate} onChange={(v) => setVal("ipDrgBaseRate", v)} prefix="$" suffix="" step={250} />/weight</span>
        <span className="whitespace-nowrap">= {fmtShort(cdiRevenue)} <span className="text-[#A69A88]">to CDI</span></span>
      </div>

      <div className="mt-6 rounded-xl px-5 py-4 bg-[#FBF3EE] border border-[#F3DDD2]">
        <p className="text-[14.5px] leading-[1.5] text-[#1A1A1A]">Of the <b>{fmtInt(queried)}</b> gaps your CDI team flags, only <b>{fmtInt(changed)}</b> get corrected. The other <b className="text-[#EA2C00]">{fmtInt(lost)}</b> die in the query process, with no response or one that doesn't stick. Abridge captures the acuity up front, so those land at the right DRG without a query.</p>
      </div>

      <div className={`${GRID} mt-6 text-[10px] font-extrabold tracking-[0.1em] uppercase text-[#A69A88]`}>
        <span>What Abridge adds, on top</span><span className="text-right">Rate</span><span className="text-right">Cases</span>
      </div>
      <FRow step="Flagged but lost" cases={fmtInt(lost)} />
      <FRow step="Captured by Abridge" rateK="ipDrgUpfrontCapture" cases={fmtInt(abridgeCases)} bold />

      <WorkedMath summary={`${fmtInt(lost)} flagged-but-lost × ${vals.ipDrgUpfrontCapture}% captured by Abridge (${fmtInt(abridgeCases)} cases) × ${vals.ipDrgWeightGain} weight × $${fmtInt(vals.ipDrgBaseRate)}/weight`} value={value} />
    </DriverShell>
  );
}

/** Reclaimed documentation time, shown as a COUNT of clinician hours, never dollarized here. */
function TimeBackBlock({ table, encWord, before, after, onBefore, onAfter, encToday, hours, dollarized, placeholderBefore, placeholderAfter }: {
  table: string; encWord: string; before: number; after: number; onBefore: (n: number) => void; onAfter: (n: number) => void;
  encToday: number; hours: number; dollarized: boolean; placeholderBefore?: string; placeholderAfter?: string;
}) {
  const hasNumbers = encToday > 0 && hours > 0;
  const fte = hours / 2080; // 2,080 = one clinician's paid hours a year
  return (
    <div className="rounded-xl border border-[#EAE3D9] bg-[#FDFBF8] px-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[17px] font-bold text-[#1A1A1A]">Time back in the day</span>
        <span className="rounded-full bg-[#F2ECE2] px-3 py-1 text-[10px] font-extrabold tracking-[0.12em] uppercase text-[#8C7F6D] whitespace-nowrap">{dollarized ? "Counted as time, not dollars" : "Counted as time, not dollars"}</span>
      </div>
      <div className="mt-5">
        <BeforeAfter label="Minutes in notes per encounter" table={table} unit="min" step={0.1}
          before={before} after={after} onBefore={onBefore} onAfter={onAfter} lowerIsBetter
          placeholderBefore={placeholderBefore} placeholderAfter={placeholderAfter} />
      </div>
      <div className="mt-7 pt-6 border-t border-[#EFE9E0]">
        <div className="text-[10.5px] font-extrabold tracking-[0.14em] uppercase text-[#A69A88] mb-3">How the number is built</div>
        {hasNumbers ? (
          <>
            <div className="text-[15px] leading-[1.9] text-[#5E534A]">
              <Mono>{Math.max(0, before - after).toFixed(1)} min</Mono> saved × <Mono>{fmtInt(encToday)}</Mono> Abridge {encWord} ÷ 60
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-[13px] text-[#A69A88]">equals</span>
              <span className="font-abridge text-[34px] leading-none text-[#1A1A1A]">{fmtInt(hours)}<span className="text-[15px] text-[#9A8C7A]"> clinician hours a year</span></span>
            </div>
            <div className="mt-2.5 text-right text-[13px] text-[#8C8073]">
              about <span className="font-bold text-[#443A32]">{fte.toFixed(1)}</span> full-time clinicians' worth of documentation time, back on the floor
            </div>
            <p className="mt-5 text-[13px] leading-[1.55] text-[#8C8073]">
              {dollarized
                ? "Shown as time given back. The share reinvested into visits is valued below, in Patient access."
                : "Shown as time given back, never converted to a made-up dollar."}
            </p>
          </>
        ) : (
          <p className="text-[14px] leading-[1.55] italic text-[#A69A88]">
            Fill in the minutes above, and your numbers on the first step, to see the hours you would get back.
          </p>
        )}
      </div>
    </div>
  );
}

function NavRow({ onBack, onNext, nextLabel, disabled }: { onBack?: () => void; onNext: () => void; nextLabel: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between mt-10">
      {onBack ? <button onClick={onBack} className="text-[14px] font-semibold text-[#A69A88] hover:text-[#1A1A1A] transition-colors">Back</button> : <span />}
      <button onClick={onNext} disabled={disabled}
        className={`inline-flex items-center gap-2 rounded-full text-[14px] font-bold px-7 py-3.5 transition-colors ${disabled ? "bg-[#E5DDD2] text-[#AFA394] cursor-not-allowed" : "bg-[#EA2C00] text-white hover:bg-[#d12800]"}`}>
        {nextLabel} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function AnswerStep(p: {
  practiceName: string; encWord: string; providerWord: string; breakdown: { title: string; value: number }[];
  todayValue: number; todayValueFull: number; potentialValueFull: number; potentialValue: number; headroom: number; hoursReclaimed: number;
  adoptionNow: number; utilNow: number; totalProviders: number;
  targetAdoptionPct: number; setTargetAdoptionPct: (n: number) => void; targetUtilPct: number; setTargetUtilPct: (n: number) => void;
  showUtilDial: boolean; price: number; setPrice: (n: number) => void; onBack: () => void; onExport: () => void;
}) {
  const todayShown = useCountUp(p.todayValue);
  const todayFullShown = useCountUp(p.todayValueFull);
  const hasRange = p.todayValueFull > p.todayValue * 1.01;
  const potentialShown = useCountUp(p.potentialValue);
  const potentialFullShown = useCountUp(p.potentialValueFull);
  const roi = p.price > 0 ? p.todayValue / p.price : 0;
  const todayPct = p.potentialValue > 0 ? (p.todayValue / p.potentialValue) * 100 : 0;
  const headroomPct = Math.max(0, 100 - todayPct);
  const dollarLevers = p.breakdown;
  const listOf = (xs: string[]) =>
    xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
  const makeup = [
    listOf(dollarLevers.map((r) => r.title.toLowerCase())),
    p.hoursReclaimed > 0 ? `${fmtInt(p.hoursReclaimed)} clinician hours back` : "",
  ].filter(Boolean).join(", plus ");

  // Nothing is on: show an intentional empty state, not "$0" + a stray meter.
  if (p.todayValue <= 0 && p.potentialValue <= 0) {
    return (
      <div>
        <div className={EYEBROW}>The answer</div>
        <h1 className="font-abridge text-[30px] sm:text-[36px] leading-[1.12] text-[#1A1A1A] mt-4 max-w-[540px]">Nothing is switched on yet</h1>
        <p className="mt-5 text-[16px] leading-[1.6] text-[#5E534A] max-w-[520px]">Go back and switch on the changes you believe you would see. Each one you turn on adds to the number here.</p>
        <button onClick={p.onBack} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#EA2C00] text-white text-[14px] font-bold px-7 py-3.5 hover:bg-[#d12800] transition-colors">
          Back to what changes <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Beat 1 — what it's worth today */}
      <h1 className="font-abridge text-[26px] sm:text-[32px] leading-[1.14] text-[#4A3F35] mt-4">For {p.practiceName}, Abridge could be worth</h1>
      <div className="font-abridge text-[66px] sm:text-[92px] leading-[0.88] text-[#EA2C00] mt-3 flex flex-wrap items-baseline gap-x-4">
        <span>{fmtShort(todayShown)}</span>
        {hasRange && (
          <span className="text-[34px] sm:text-[46px] text-[#1A1A1A]">
            <span className="text-[22px] sm:text-[26px] text-[#9A8C7A] font-normal">to </span>{fmtShort(todayFullShown)}
          </span>
        )}
        <span className="text-[26px] text-[#9A8C7A] font-normal">a year</span>
      </div>
      <p className="mt-5 text-[16px] leading-[1.6] text-[#5E534A] max-w-[560px]">
        {makeup ? <>From {makeup}, at the {Math.round(p.adoptionNow)}% rollout and {Math.round(p.utilNow)}% usage you set. Change either one and this moves.</> : "Switch on the changes you expect and the number builds here."}
      </p>
      {hasRange && (
        <p className="mt-3 text-[14px] leading-[1.6] text-[#8C8073] max-w-[560px]">
          The lower figure assumes a share of this never lands: claims downcoded,
          denials that stay denied, coding that does not survive an audit. The
          higher figure assumes all of it lands. Most practices sit in between,
          which is why we show both rather than pick one for you.
        </p>
      )}

      {/* Beat 2 — the upside */}
      <div className="mt-14 pt-1">
        <div className={EYEBROW}>If you rolled it out further</div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="font-abridge text-[44px] sm:text-[56px] leading-[0.9] text-[#1A1A1A]">
            {fmtShort(potentialShown)}
            {hasRange && <span className="text-[26px] sm:text-[32px]"><span className="text-[18px] text-[#9A8C7A] font-normal"> to </span>{fmtShort(potentialFullShown)}</span>}
            <span className="text-[20px] text-[#9A8C7A] font-normal"> a year</span>
          </span>
          <span className="font-abridge text-[22px] text-[#EA2C00]">+{fmtShort(p.headroom)} not yet counted</span>
        </div>

        {/* the meter: solid coral = already made, light = reachable headroom */}
        <div className="mt-7">
          <div className="h-3 rounded-full bg-[#EDE5D8] overflow-hidden flex">
            <div className="h-full bg-[#EA2C00] transition-all duration-500" style={{ width: `${todayPct}%` }} />
            <div className="h-full bg-[#F6B7A6] transition-all duration-500" style={{ width: `${headroomPct}%` }} />
          </div>
          <div className="flex justify-between mt-2.5 text-[12.5px]">
            <span className="flex items-center gap-1.5 text-[#8C8073]"><span className="w-2 h-2 rounded-full bg-[#EA2C00]" /> At your plan {fmtShort(p.todayValue)}</span>
            <span className="flex items-center gap-1.5 text-[#8C8073]"><span className="w-2 h-2 rounded-full bg-[#F6B7A6]" /> Not yet counted {fmtShort(p.headroom)}</span>
          </div>
        </div>

        {/* the dials */}
        <div className={`mt-9 grid grid-cols-1 ${p.showUtilDial ? "sm:grid-cols-2" : ""} gap-x-10 gap-y-6`}>
          <Slider label={`More of your ${p.providerWord} using it`} value={p.targetAdoptionPct} min={Math.round(p.adoptionNow)} onChange={p.setTargetAdoptionPct} right={`${fmtInt(Math.round(p.totalProviders * p.targetAdoptionPct / 100))} of ${fmtInt(p.totalProviders)}`} />
          {p.showUtilDial && (
            <Slider label={`Using it on more of their ${p.encWord}`} value={p.targetUtilPct} min={Math.round(p.utilNow)} onChange={p.setTargetUtilPct} right={`${p.targetUtilPct}%`} />
          )}
        </div>
        <p className="mt-6 text-[13.5px] leading-[1.6] text-[#8C8073] max-w-[560px]">
          The per-{p.encWord.replace(/s$/, "")} effect stays exactly where you set it. The only thing growing here is how many {p.encWord} it runs on.
        </p>
      </div>

      {/* THE RETURN — the one thing they still have to type. Before a price is
          in, this is an unanswered question, so it is styled as a prompt (tinted
          card, coral rule, a caret) rather than a quiet row that reads optional. */}
      <div className="mt-16">
        <div className={`rounded-2xl border transition-colors ${p.price > 0 ? "border-[#EAE3D9] bg-[#FDFBF8]" : "border-[#EA2C00]/35 bg-[#FFF7F4]"}`}>
          <div className="px-7 sm:px-9 py-8">
            <div className={EYEBROW}>The return</div>
            {p.price > 0 ? (
              <>
                <h2 className="font-abridge text-[22px] sm:text-[26px] leading-[1.2] text-[#1A1A1A] mt-3">
                  What you keep, after paying for it
                </h2>
                <div className="mt-7 flex flex-wrap items-end gap-x-12 gap-y-6">
                  <div>
                    <div className="text-[12.5px] text-[#8C8073] mb-2">What Abridge would cost you</div>
                    <div className="w-[190px] inline-flex items-baseline gap-1.5 border-b-2 border-[#E0D9CE] focus-within:border-[#EA2C00] transition-colors pb-1">
                      <span className="text-[16px] text-[#A69A88]">$</span>
                      <FormattedNumberInput value={p.price} onChange={p.setPrice}
                        className="flex-1 min-w-0 h-auto border-0 rounded-none bg-transparent p-0 shadow-none text-[24px] md:text-[24px] font-bold text-[#1A1A1A] tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="a year, all in" />
                    </div>
                  </div>
                  <div>
                    <div className="font-abridge text-[46px] sm:text-[56px] leading-none text-[#EA2C00]">{roi.toFixed(1)}×</div>
                    <div className="text-[12.5px] text-[#8C8073] mt-2">back for every dollar spent</div>
                  </div>
                  <div>
                    <div className="font-abridge text-[46px] sm:text-[56px] leading-none text-[#1A1A1A]">{fmtShort(p.todayValue - p.price)}</div>
                    <div className="text-[12.5px] text-[#8C8073] mt-2">left over each year, after paying for it</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-abridge text-[24px] sm:text-[30px] leading-[1.16] text-[#1A1A1A] mt-3 max-w-[520px]">
                  One more number: what would Abridge cost you?
                </h2>
                <p className="mt-3 text-[15px] leading-[1.6] text-[#8C8073] max-w-[500px]">
                  Put in the annual price you have been quoted and we will show what
                  is left after paying for it, and how many times over it pays back.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <div className="w-[250px] inline-flex items-baseline gap-2 border-b-[3px] border-[#EA2C00] pb-1.5">
                    <span className="text-[22px] text-[#EA2C00] font-bold">$</span>
                    <FormattedNumberInput value={p.price} onChange={p.setPrice}
                      className="flex-1 min-w-0 h-auto border-0 rounded-none bg-transparent p-0 shadow-none text-[30px] md:text-[30px] font-bold text-[#1A1A1A] tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:not-italic placeholder:font-normal placeholder:text-[17px] placeholder:text-[#C0A79C]"
                      placeholder="a year, all in" />
                  </div>

                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* quiet breakdown of where the value came from */}
      <div className="mt-10 pt-5 border-t border-[#E8E2DA]">
        <div className={EYEBROW}>Where it comes from</div>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        {dollarLevers.map((r) => (
          <span key={r.title} className="text-[13px] text-[#8C8073]">{r.title} <span className="font-abridge text-[15px] text-[#1A1A1A]">{fmtShort(r.value)}</span></span>
        ))}
        {p.hoursReclaimed > 0 && <span className="text-[13px] text-[#8C8073]">Hours back <span className="font-abridge text-[15px] text-[#1A1A1A]">{fmtInt(p.hoursReclaimed)}</span></span>}
      </div>

      <div className="mt-10 pt-7 border-t border-[#E8E2DA] flex items-center justify-between gap-4 flex-wrap">
        <button onClick={p.onBack} className="text-[14px] font-semibold text-[#A69A88] hover:text-[#1A1A1A] transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-[#EA2C00] focus-visible:ring-offset-2">Back to what changes</button>
        <button onClick={p.onExport} className="inline-flex items-center gap-2 rounded-full bg-[#EA2C00] text-white text-[14px] font-bold px-7 py-3.5 hover:bg-[#d12800] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#EA2C00] focus-visible:ring-offset-2">
          <Download className="w-4 h-4" /> Save my summary
        </button>
      </div>
    </div>
  );
}

function Slider({ label, value, min, onChange, right }: { label: string; value: number; min: number; onChange: (n: number) => void; right: string }) {
  const lo = Math.max(0, Math.floor(min));
  const pct = 100 - lo > 0 ? ((value - lo) / (100 - lo)) * 100 : 0;
  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2 min-h-[38px]">
        <span className="text-[14px] font-medium text-[#1A1A1A] min-w-0 leading-snug">{label}</span>
        <span className="font-abridge text-[15px] text-[#EA2C00] whitespace-nowrap flex-shrink-0">{right}</span>
      </div>
      {/* Browser-default range controls read as unstyled next to the bespoke
          two-tone meter directly above them. Draw the track fill so the part
          already dialled in reads coral, like everything else that is counted. */}
      <input
        type="range" step={1} min={lo} max={100} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="roi-slider w-full cursor-pointer"
        style={{ ["--roi-fill" as string]: `${pct}%` }}
      />
    </div>
  );
}

const SLIDER_CSS = `
/* index.css carries a global input[type="range"] block (monochrome, black fill)
   whose element+attribute selector outranks a bare class, so these have to be
   qualified the same way to win. Without the qualifier the rules load and do
   nothing, which is exactly how this looked unstyled the first time. */
input[type="range"].roi-slider { -webkit-appearance: none; appearance: none; background: transparent; height: 22px; padding: 0; }
input[type="range"].roi-slider::-webkit-slider-runnable-track {
  height: 4px; border-radius: 999px; border: 0;
  background: linear-gradient(to right, #EA2C00 0%, #EA2C00 var(--roi-fill), #EDE5D8 var(--roi-fill), #EDE5D8 100%);
}
input[type="range"].roi-slider::-moz-range-track { height: 4px; border-radius: 999px; background: #EDE5D8; border: 0; }
input[type="range"].roi-slider::-moz-range-progress { height: 4px; border-radius: 999px; background: #EA2C00; }
input[type="range"].roi-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 18px; height: 18px; margin-top: -7px; border-radius: 999px;
  background: #EA2C00; border: 3px solid #FFFFFF; box-shadow: 0 1px 3px rgba(74,63,53,0.30);
  cursor: pointer;
}
input[type="range"].roi-slider::-moz-range-thumb {
  width: 18px; height: 18px; border-radius: 999px;
  background: #EA2C00; border: 3px solid #FFFFFF; box-shadow: 0 1px 3px rgba(74,63,53,0.30);
  cursor: pointer;
}
input[type="range"].roi-slider:focus-visible::-webkit-slider-thumb { outline: 2px solid #EA2C00; outline-offset: 2px; }
`;
