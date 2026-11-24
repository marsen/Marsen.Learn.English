"use client";

import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import type { ReviewView } from "@/application/examSet/reviewView";
import type { ReviewFormState } from "@/presentation/components/formStates";
import { Alert } from "@/presentation/components/ui/Alert";
import { Button } from "@/presentation/components/ui/Button";
import { reviewErrorText } from "@/presentation/lib/errorMessages";
import { questionAt, stackCards, turnAt } from "@/presentation/lib/reviewTime";
import {
  NoteCard,
  type DraftAiAction,
  type DraftNote,
  type Editing,
} from "./review/NoteCard";
import { browserStorage } from "@/presentation/lib/examDraft";
import {
  checkReviewDraft,
  clearReviewDraft,
  contentKey,
  isoOf,
  loadReviewDraft,
  draftStep,
  releaseGuardAfter,
  saveReviewDraft,
  withSubmitFallback,
  type ReviewContent,
} from "@/presentation/lib/reviewDraft";
import { installLeaveGuard } from "@/presentation/lib/leaveGuard";
import {
  canComplete,
  isJudged,
  missingOf,
  nextPending as nextPendingOf,
  openAiCount,
  questionsIn,
  sectionAt,
  sectionOfQuestion,
  sectionProgress,
  sectionStart,
  sectionsOf,
  signature,
  type SectionState,
} from "@/presentation/lib/reviewSections";
import { ReviewPaper } from "./review/ReviewPaper";
import { StepBar, type ReviewTab } from "./review/StepBar";
import { SectionSummary } from "./review/SectionSummary";
import { SectionFooter } from "./review/SectionFooter";
import { ReviewSummaryTab, type OpenAiNote } from "./review/ReviewSummaryTab";
import { FullReviewPaper } from "./review/FullReviewPaper";
import { Transcript, type TranscriptFocus } from "./review/Transcript";

type Props = {
  view: ReviewView;
  audioUrl: string;
  /** 暫存的鍵帶老師的帳號：同一台電腦換人登入不會拿到別人的暫存 */
  accountId: string;
  action: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
};

/** 整套／錄音的批註卡代號（考卷上拉線到標題） */
const SET = "set";
/** 寬螢幕才把批註排在考卷旁邊、拉線；窄的排在考卷下面 */
const SIDE_BY_SIDE = "(min-width: 1280px)";

let nextKey = 0;
const newKey = () => `n${(nextKey += 1)}`;

/**
 * 網站上的審稿算出來的畫面內容（沒有暫存時的樣子）。
 * 判定預設：上次審過就沿用；舊審稿沒有逐題判定時，合格的全部當 OK；
 * 其他情況 AI 沒提意見的題目預設 OK，整套和 AI 有提意見的題目要老師點
 */
function baseContentOf(view: ReviewView): ReviewContent {
  const prev = view.review;
  const all = [SET, ...view.questions.map((q) => q.questionId)];
  const verdicts: Record<string, boolean> =
    prev && prev.verdicts.length > 0
      ? Object.fromEntries(prev.verdicts.map((v) => [v.target ?? SET, v.ok]))
      : prev?.decision === "approved"
        ? Object.fromEntries(all.map((k) => [k, true]))
        : Object.fromEntries(
            view.questions
              .filter((q) => !view.aiNotes.some((n) => n.questionId === q.questionId))
              .map((q) => [q.questionId, true]),
          );
  const content: ReviewContent = {
    verdicts,
    aiActions: Object.fromEntries(
      (prev?.aiActions ?? []).map((a) => [
        a.ref,
        { action: a.action, text: a.text ?? "" },
      ]),
    ),
    notes: (prev?.notes ?? []).map((n) => ({ target: n.target, text: n.text })),
    comment: prev?.comment ?? "",
    confirmed: {},
    seen: [],
  };
  // 完整考卷：上次送出的審稿已判完（又沒暫存）時，全部當看過，判過的段落當已完成
  const judgedAll = prev !== null && all.every((k) => k in verdicts);
  if (!view.fullPaper || !judgedAll) return content;
  const seen = view.questions.map((q) => q.questionId);
  const st: SectionState = {
    verdicts: new Map(Object.entries(verdicts)),
    aiActions: new Map(Object.entries(content.aiActions)),
    seen: new Set(seen),
    confirmed: {},
  };
  const confirmed = Object.fromEntries(
    sectionsOf(view.questions)
      .filter((n) =>
        questionsIn(view.questions, n).every((id) => isJudged(view.aiNotes, st, id)),
      )
      .map((n) => [String(n), signature(view.questions, view.aiNotes, st, n)]),
  );
  return { ...content, seen, confirmed };
}

/**
 * 老師審稿：像批改考卷一樣，考卷填好標準答案，每題旁邊是 AI 的意見和老師的意見。
 * 老師可以保留、改寫、刪除 AI 的意見，替任何一題或整套加意見；每一題和整套都要判 OK 或有問題，
 * 全部 OK 才合格，全部判完才能送出。
 * 審到一半的內容暫存在老師的瀏覽器（reviewDraft），有暫存時要離開會先問。
 */
export function ReviewForm({ view, audioUrl, accountId, action }: Props) {
  const t = useTranslations();
  const r = (key: string, values?: Record<string, string | number>) =>
    t(`review.${key}`, values);
  // 連不到網站時 action 會丟例外，不接住的話整頁換成錯誤頁；改成一般的送出失敗，暫存和畫面都留著（AC-3）
  const submit = useMemo(
    () =>
      withSubmitFallback(
        action,
        { problems: [{ code: "submitFailed" as const }] },
        unstable_rethrow,
      ),
    [action],
  );
  const [state, formAction, isPending] = useActionState(submit, {});
  const prev = view.review;

  // ---------- 草稿 ----------
  // 基準每次 render 從網站資料算（送出成功 revalidate 後跟著更新，不會誤判成有改）
  const base = baseContentOf(view);
  const [notes, setNotes] = useState<DraftNote[]>(() =>
    base.notes.map((n) => ({ key: newKey(), target: n.target, text: n.text })),
  );
  const [aiActions, setAiActions] = useState<Map<string, DraftAiAction>>(
    () => new Map(Object.entries(base.aiActions)),
  );
  // 每一題、整套的判定（key：題號或 SET）：true＝OK，false＝有問題，沒有＝還沒判
  const [verdicts, setVerdicts] = useState<Map<string, boolean>>(
    () => new Map(Object.entries(base.verdicts)),
  );
  // 總評用受控元件：React 每次 form action 前會 reset 表單，非受控的在送出失敗時會被清掉
  const [comment, setComment] = useState(base.comment);
  const [confirmed, setConfirmed] = useState<Record<string, string>>(base.confirmed);
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(base.seen));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [active, setActive] = useState<string | null>(null);

  // ---------- 一段一段審（完整考卷） ----------
  // 完整考卷一段一段審（#288）：送出在總結頁；2.x 單段考卷照舊（送出在錄音列）
  const paged = view.fullPaper !== null;
  const sections = paged ? sectionsOf(view.questions) : [];
  const [tab, setTab] = useState<ReviewTab>(
    () => sectionsOf(view.questions)[0] ?? "summary",
  );
  const sState: SectionState = { verdicts, aiActions, seen, confirmed };

  /** 判一題（或整套）。一段一段審時記下看過；判過了就收起、展開這段下一題（AC-9） */
  const judge = (target: string, ok: boolean) => {
    const nextVerdicts = new Map(verdicts).set(target, ok);
    setVerdicts(nextVerdicts);
    if (!paged || target === SET) return;
    const nextSeen = new Set(seen).add(target);
    setSeen(nextSeen);
    const st = { ...sState, verdicts: nextVerdicts, seen: nextSeen };
    // 判 OK 但還有 AI 意見沒處理：不收起，卡上會寫還要處理幾則
    if (!isJudged(view.aiNotes, st, target)) return;
    if (editing !== null && hasUnsaved()) return;
    const sec = sectionOfQuestion(view.questions, target);
    const ids = sec === null ? [] : questionsIn(view.questions, sec);
    const i = ids.indexOf(target);
    const next = [...ids.slice(i + 1), ...ids.slice(0, i)].find(
      (id) => !isJudged(view.aiNotes, st, id),
    );
    if (next === undefined) {
      setActive(null);
      setEditing(null);
      return;
    }
    setActive(next);
    setEditing(
      notesOf(next).length === 0 && aiOf(next).length === 0
        ? { kind: "new", target: next }
        : null,
    );
    scrollTo.current = next;
  };

  const targetOf = (key: string) => (key === SET ? null : key);
  const saveNote = (key: string | null, target: string, text: string) => {
    setNotes((ns) =>
      key === null
        ? [...ns, { key: newKey(), target: targetOf(target), text }]
        : ns.map((n) => (n.key === key ? { ...n, text } : n)),
    );
    setEditing(null);
  };
  const setAi = (ref: string, a: DraftAiAction | null) => {
    setAiActions((m) => {
      const next = new Map(m);
      if (a) next.set(ref, a);
      else next.delete(ref);
      return next;
    });
    setEditing(null);
  };

  const payload = JSON.stringify({
    verdicts: [...verdicts].map(([key, ok]) => ({ target: targetOf(key), ok })),
    notes: notes.map((n) => ({ target: n.target, text: n.text })),
    aiActions: [...aiActions].map(([ref, a]) => ({
      ref,
      action: a.action,
      text: a.text || null,
    })),
  });

  // ---------- 暫存（瀏覽器）、離開提醒 ----------
  const setId = view.set.setId;
  const content: ReviewContent = {
    verdicts: Object.fromEntries(verdicts),
    aiActions: Object.fromEntries(aiActions),
    notes: notes.map((n) => ({ target: n.target, text: n.text })),
    comment,
    confirmed,
    seen: [...seen],
  };
  const key = contentKey(content);
  const baseReviewedAt = isoOf(prev?.reviewedAt);
  const uploadedAt = isoOf(view.set.uploadedAt) ?? "";
  // 掛載後才讀暫存（在 useState 初始值讀會和伺服器畫的不一樣）；讀完才開始存
  const [loaded, setLoaded] = useState(false);
  const [draftStale, setDraftStale] = useState(false);
  // 送出時的內容：送出成功後，網站存的寫法可能和畫面略有不同（例如去掉前後空白），和這個一樣也算沒改
  const [submittedKey, setSubmittedKey] = useState<string | null>(null);
  const step = draftStep({
    loaded,
    key,
    baseKey: contentKey(base),
    result: state,
    submittedKey,
  });
  const dirty = step === "save";

  // 讀瀏覽器暫存只能在掛載後做（伺服器沒有 localStorage），所以在 effect 裡 setState
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const storage = browserStorage();
    const draft = loadReviewDraft(storage, accountId, setId);
    if (draft) {
      const checked = checkReviewDraft(draft, {
        baseReviewedAt,
        uploadedAt,
        targets: new Set([SET, ...view.questions.map((q) => q.questionId)]),
        refs: new Set(view.aiNotes.map((n) => n.ref)),
      });
      if (!checked.ok) {
        clearReviewDraft(storage, accountId, setId);
        setDraftStale(true);
      } else {
        const c = checked.content;
        setVerdicts(new Map(Object.entries(c.verdicts)));
        setAiActions(new Map(Object.entries(c.aiActions)));
        setNotes(c.notes.map((n) => ({ key: newKey(), target: n.target, text: n.text })));
        setComment(c.comment);
        setConfirmed(c.confirmed);
        setSeen(new Set(c.seen));
      }
    }
    setLoaded(true);
    // 只在進來時讀一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 內容一改就存；和網站上的一樣就刪
  useEffect(() => {
    if (step === "wait") return;
    const storage = browserStorage();
    if (step === "clear") clearReviewDraft(storage, accountId, setId);
    else
      saveReviewDraft(storage, {
        setId,
        accountId,
        baseReviewedAt,
        uploadedAt,
        ...content,
      });
    // key 代表 content 的內容
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, key, accountId, setId, baseReviewedAt, uploadedAt]);

  // 第一次有暫存才裝離開提醒，裝了就不拆（到送出成功或離開這頁）；只在有暫存時才問
  const dirtyRef = useRef(false);
  const guardRef = useRef<(() => void) | null>(null);
  const leaveConfirm = r("leaveConfirm");
  const leaveConfirmRef = useRef(leaveConfirm);
  useEffect(() => {
    leaveConfirmRef.current = leaveConfirm;
    dirtyRef.current = dirty;
    if (dirty && !guardRef.current)
      guardRef.current = installLeaveGuard(() => leaveConfirmRef.current, undefined, {
        shouldAsk: () => dirtyRef.current,
        ignoreForm: (f) => f.hasAttribute("data-review-form"),
      });
  }, [dirty, leaveConfirm]);
  // 送出成功：拆掉提醒（之後若要換頁，也要先拆，不然會再問一次）
  useEffect(() => {
    if (!releaseGuardAfter(state)) return;
    guardRef.current?.();
    guardRef.current = null;
  }, [state]);
  useEffect(
    () => () => {
      guardRef.current?.();
      guardRef.current = null;
    },
    [],
  );
  // 刪除題組（確定離開後才會送出）：這份暫存也用不到了
  useEffect(() => {
    const onSubmit = (e: Event) => {
      if (e.target instanceof HTMLFormElement && e.target.hasAttribute("data-delete-set"))
        clearReviewDraft(browserStorage(), accountId, setId);
    };
    document.addEventListener("submit", onSubmit);
    return () => document.removeEventListener("submit", onSubmit);
  }, [accountId, setId]);

  // ---------- 錄音 ----------
  const audioRef = useRef<HTMLAudioElement>(null);
  const [now, setNow] = useState(0);
  // 錄音有沒有在播（步驟條只在播的時候標「正在播」）
  const [audioOn, setAudioOn] = useState(false);
  const seek = (seconds: number, play = false) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = seconds;
    setNow(seconds);
    if (play) el.play().catch(() => {});
  };
  const currentTime = () => audioRef.current?.currentTime ?? 0;
  // 從意見點句子編號：錄音跳過去，逐字稿那句捲進畫面、框起來
  const [focusTurn, setFocusTurn] = useState<TranscriptFocus | null>(null);
  const seekFromNote = (seconds: number, turn?: string) => {
    seek(seconds);
    if (turn) setFocusTurn((f) => ({ turn, n: (f?.n ?? 0) + 1 }));
  };

  const questions = useMemo(
    () => new Map(view.questions.map((q) => [q.questionId, q])),
    [view.questions],
  );
  const turnStarts = useMemo(
    () =>
      new Map(
        (view.turns ?? []).flatMap((x) => (x.start === null ? [] : [[x.id, x.start]])),
      ),
    [view.turns],
  );
  const ranges = view.questions.map((q) => ({
    questionId: q.questionId,
    start: q.evidence?.start ?? null,
    end: q.evidence?.end ?? null,
  }));
  const listening = questionAt(ranges, now);
  const currentTurn = view.turns ? turnAt(view.turns, now) : null;

  // ---------- 批註卡 ----------
  // 一段一段審：整段的 AI 意見放在那段的小結，整套卡只放不屬於任何一段的
  const aiOf = (target: string) =>
    view.aiNotes.filter(
      (n) =>
        n.questionId === targetOf(target) &&
        !(paged && target === SET && n.ieltsSection !== null),
    );
  const notesOf = (target: string) => notes.filter((n) => n.target === targetOf(target));
  const counts = new Map(
    view.questions.map((q) => [
      q.questionId,
      notesOf(q.questionId).length +
        aiOf(q.questionId).filter((n) => aiActions.get(n.ref)?.action !== "deleted")
          .length,
    ]),
  );
  // 整套一定有卡；題目有意見、正在看、正在新增意見的才出卡
  // 一段一段審：段落分頁只出這段的題目卡，整套卡在總結分頁
  const cards = [
    ...(!paged || tab === "summary" ? [SET] : []),
    ...(paged
      ? tab === "summary"
        ? []
        : questionsIn(view.questions, tab)
      : view.questions.map((q) => q.questionId)
    ).filter(
      (id) =>
        (counts.get(id) ?? 0) > 0 ||
        aiOf(id).length > 0 ||
        verdicts.get(id) !== true ||
        active === id ||
        (editing?.kind === "new" && editing.target === id),
    ),
  ];

  // ---------- 還沒按「好」的意見 ----------
  // 正在寫的意見框裡有改過、還沒存的字，就不能換去寫別的、也不能送出，免得字不見
  // 提醒只掛在當時打開的那個意見框；換了意見框（editing 換成新物件）提醒就自然消失
  const [hintFor, setHintFor] = useState<Editing | null>(null);
  const openEditor = () => document.querySelector<HTMLElement>("[data-editing] textarea");
  const hasUnsaved = () => {
    const el = openEditor() as HTMLTextAreaElement | null;
    return !!el && el.value.trim() !== "" && el.value !== el.defaultValue;
  };
  const showUnsaved = () => {
    setHintFor(editing);
    const el = openEditor();
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  };
  /** 換去寫別的；目前的意見框有沒存的字就擋下來 */
  const startEditing = (e: Editing | null) => {
    if (e !== null && editing !== null && hasUnsaved()) {
      showUnsaved();
      return false;
    }
    setEditing(e);
    return true;
  };

  /** 收起展開的卡（✕、再點一次同一題、Esc）；有沒存的意見就先擋下來 */
  const collapse = () => {
    if (active === null) return;
    if (hasUnsaved()) {
      showUnsaved();
      return;
    }
    setActive(null);
    setEditing(null);
  };

  /** 展開一題；再點一次同一題就收起。換題時有沒存的意見就先擋下來 */
  const select = (target: string) => {
    if (active === target) {
      collapse();
      return;
    }
    if (editing !== null && hasUnsaved()) {
      showUnsaved();
      return;
    }
    setActive(target);
    setEditing(
      target !== SET && notesOf(target).length === 0 && aiOf(target).length === 0
        ? { kind: "new", target }
        : null,
    );
  };

  // ---------- 判定的摘要、待處理 ----------
  const allTargets = [SET, ...view.questions.map((q) => q.questionId)];
  // 一段一段審：題目要「判過」（AI 意見處理、預設 OK 確認）才不算待處理
  const pending = allTargets.filter((k) =>
    paged && k !== SET ? !isJudged(view.aiNotes, sState, k) : !verdicts.has(k),
  );
  const okCount = allTargets.filter((k) => verdicts.get(k) === true).length;
  const badCount = allTargets.filter((k) => verdicts.get(k) === false).length;
  // 下一個還沒判的項目（從目前展開的那題往後找，繞回開頭）；按鈕上寫明是哪一項
  const from = active ? allTargets.indexOf(active) : -1;
  const order = [...allTargets.slice(from + 1), ...allTargets.slice(0, from + 1)];
  const nextTarget: string | null = paged
    ? nextPendingOf(view.questions, view.aiNotes, sState, active, SET)
    : (order.find((x) => !verdicts.has(x) && x !== active) ?? pending[0] ?? null);
  const targetName = (k: string) =>
    k === SET ? r("wholeSet") : r("questionN", { n: questions.get(k)?.number ?? k });
  // 跳過去的那張卡框起來一下，看得出到了哪裡
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (flash === null) return;
    const id = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(id);
  }, [flash]);
  /** 跳到一項：展開、捲過去、框起來。一段一段審時，在別的分頁就先切過去（AC-14） */
  const goTo = (k: string) => {
    if (editing !== null && hasUnsaved()) {
      showUnsaved();
      return;
    }
    if (paged) {
      const sec = k === SET ? "summary" : sectionOfQuestion(view.questions, k);
      if (sec !== null && sec !== tab) setTab(sec);
    }
    if (active !== k) select(k);
    // 寬螢幕捲到考卷上的空格（卡就在旁邊），窄的捲到卡
    scrollTo.current = k;
    setFlash(k);
  };
  /** 跳到下一個還沒判的項目 */
  const nextPending = () => {
    if (nextTarget !== null) goTo(nextTarget);
  };

  // ---------- 分頁（一段一段審） ----------
  const progress = sections.map((n) =>
    sectionProgress(view.questions, view.aiNotes, sState, n),
  );
  const allSectionsDone = progress.every((p) => p.status === "done");
  const events = view.set.timing.events;
  const playing = paged && audioOn ? sectionAt(events, sections, now) : null;
  const goTab = (next: ReviewTab) => {
    if (editing !== null && hasUnsaved()) {
      showUnsaved();
      return;
    }
    setTab(next);
    setActive(null);
    setEditing(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const sectionTab = paged && tab !== "summary" ? tab : null;
  const nextSection = (n: number) => sections[sections.indexOf(n) + 1] ?? null;
  const completeSection = (n: number) => {
    setConfirmed((c) => ({
      ...c,
      [String(n)]: signature(view.questions, view.aiNotes, sState, n),
    }));
    goTab(nextSection(n) ?? "summary");
  };
  const openAi: OpenAiNote[] = paged
    ? view.aiNotes
        .filter((n) => !aiActions.has(n.ref))
        .map((n) => ({
          ref: n.ref,
          section: n.ieltsSection,
          questionId: n.questionId,
          number: n.questionId ? (questions.get(n.questionId)?.number ?? null) : null,
          message: n.message,
        }))
    : [];
  const canSubmit = paged ? allSectionsDone && verdicts.has(SET) : pending.length === 0;

  // Esc 收起
  const collapseRef = useRef(collapse);
  useEffect(() => {
    collapseRef.current = collapse;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 窄螢幕：點空格後捲到那張卡
  const scrollTo = useRef<string | null>(null);
  const selectFromPaper = (target: string) => {
    select(target);
    scrollTo.current = target;
  };
  useEffect(() => {
    const target = scrollTo.current;
    scrollTo.current = null;
    if (!target) return;
    const wide = window.matchMedia(SIDE_BY_SIDE).matches;
    document
      .querySelector(wide ? `[data-anchor="${target}"]` : `[data-card="${target}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ---------- 排位置、拉線（寬螢幕） ----------
  const boardRef = useRef<HTMLDivElement>(null);
  const marginRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const layout = () => {
      const board = boardRef.current;
      const margin = marginRef.current;
      const svg = svgRef.current;
      if (!board || !margin || !svg) return;
      const cardEls = [...margin.querySelectorAll<HTMLElement>("[data-card]")];
      if (!window.matchMedia(SIDE_BY_SIDE).matches) {
        for (const el of cardEls) el.style.top = "";
        margin.style.height = "";
        svg.replaceChildren();
        return;
      }
      const B = board.getBoundingClientRect();
      const M = margin.getBoundingClientRect();
      const paperRight = board.firstElementChild?.getBoundingClientRect().right ?? M.left;
      const anchors = cardEls.map((el) =>
        board
          .querySelector(`[data-anchor="${el.dataset.card}"]`)
          ?.getBoundingClientRect(),
      );
      const tops = stackCards(
        cardEls.map((el, i) => ({
          want: anchors[i]
            ? anchors[i].top +
              anchors[i].height / 2 -
              M.top -
              Math.min(18, el.offsetHeight / 2)
            : 0,
          height: el.offsetHeight,
        })),
        6,
      );
      const ns = "http://www.w3.org/2000/svg";
      const shapes: SVGElement[] = [];
      cardEls.forEach((el, i) => {
        el.style.top = `${tops[i]}px`;
        const a = anchors[i];
        // 只畫展開中那張卡的線，其他卡不畫，免得線太多干擾閱讀
        if (!a || active !== el.dataset.card) return;
        // 從空格底線下方出發，走行距的空隙，不壓到字
        const x1 = a.right - B.left + 2;
        const y1 = a.bottom - B.top + 3;
        const xm = paperRight - B.left + 8;
        const x2 = M.left - B.left;
        const y2 = M.top - B.top + tops[i] + Math.min(18, el.offsetHeight / 2);
        const path = document.createElementNS(ns, "path");
        path.setAttribute(
          "d",
          `M${x1},${y1} H${xm} C${xm + 24},${y1} ${x2 - 24},${y2} ${x2},${y2}`,
        );
        path.setAttribute("class", "fill-none stroke-primary stroke-2");
        const dot = document.createElementNS(ns, "circle");
        dot.setAttribute("cx", String(x1));
        dot.setAttribute("cy", String(y1));
        dot.setAttribute("r", "3");
        dot.setAttribute("class", "fill-primary");
        shapes.push(path, dot);
      });
      const last = cardEls.at(-1);
      margin.style.height = last ? `${tops[tops.length - 1] + last.offsetHeight}px` : "";
      svg.replaceChildren(...shapes);
    };
    layout();
    const ro = new ResizeObserver(layout);
    if (marginRef.current) ro.observe(marginRef.current);
    if (boardRef.current) ro.observe(boardRef.current);
    window.addEventListener("resize", layout);
    marginRef.current?.addEventListener("toggle", layout, true);
    const margin = marginRef.current;
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", layout);
      margin?.removeEventListener("toggle", layout, true);
    };
  });

  // 送出的結果：一般在錄音列，一段一段審時在總結分頁的送出旁邊
  const submitAlerts = (
    <>
      {state.problems && state.problems.length > 0 && (
        <div className="mt-2 max-h-40 overflow-auto">
          <Alert tone="error" items={state.problems.map((p) => reviewErrorText(t, p))} />
        </div>
      )}
      {state.saved && (
        <div className="mt-2">
          <Alert>{r("saved")}</Alert>
        </div>
      )}
    </>
  );

  return (
    <form
      data-review-form
      action={formAction}
      onSubmit={(e) => {
        // 有沒按「好」的意見就先不送，提醒老師；意見框是空的或沒改過就直接關掉
        if (hasUnsaved()) {
          e.preventDefault();
          showUnsaved();
        } else {
          if (editing !== null) setEditing(null);
          setSubmittedKey(key);
        }
      }}
      className="grid gap-6"
    >
      <input type="hidden" name="payload" value={payload} />

      {/* 錄音列黏在頂端列下面：手機頂端列 61px（AppSidebar 上下 py-2＋選單按鈕 h-11＋底線），電腦 h-14 */}
      <div className="sticky top-[61px] z-10 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:top-14">
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={audioUrl}
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
          onSeeked={(e) => setNow(e.currentTarget.currentTime)}
          onPlay={() => setAudioOn(true)}
          onPause={() => setAudioOn(false)}
          className="w-full"
        />
        {!view.turns && (
          <p className="mt-1 text-xs text-muted-foreground">{r("noTranscript")}</p>
        )}
        {paged && (
          <StepBar
            progress={progress}
            tab={tab}
            playing={playing}
            setJudged={verdicts.has(SET)}
            onTab={goTab}
          />
        )}
        {/* 進度、下一個待處理、送出：捲到哪都看得到 */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span data-review-progress>
            {[
              r("summaryOk", { count: okCount }),
              r("summaryBad", { count: badCount }),
              r("pending", { count: pending.length }),
            ].join(r("summaryJoin"))}
          </span>
          {nextTarget !== null ? (
            <button
              type="button"
              onClick={nextPending}
              className="font-semibold text-primary-hover underline"
            >
              {r("nextPending", { target: targetName(nextTarget) })}
            </button>
          ) : (
            <span className="text-muted-foreground">
              {r("noPending")}
              <b className={`ml-2 ${badCount > 0 ? "text-destructive" : "text-accent"}`}>
                {badCount > 0 ? r("resultFail") : r("resultPass")}
              </b>
            </span>
          )}
          {!paged && (
            <Button
              type="submit"
              size="sm"
              className="ml-auto"
              disabled={isPending || !canSubmit}
            >
              {isPending ? t("common.saving") : prev ? r("update") : r("submit")}
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground" data-review-draft-hint>
          {r("draftHint")}
          {draftStale && <b className="ml-2 text-destructive">{r("draftStale")}</b>}
        </p>
        {!paged && submitAlerts}
      </div>

      <div
        ref={boardRef}
        className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-12"
      >
        {paged && tab === "summary" ? (
          <ReviewSummaryTab
            progress={progress}
            openAi={openAi}
            onSection={goTab}
            onNote={(n) => {
              if (n.questionId) goTo(n.questionId);
              else if (n.section === null) goTo(SET);
              else goTab(n.section);
            }}
          />
        ) : view.fullPaper && sectionTab !== null ? (
          <div className="grid min-w-0 gap-4">
            <SectionSummary
              key={sectionTab}
              progress={progress.find((p) => p.section === sectionTab)!}
              aiNotes={view.aiNotes.filter(
                (n) => n.questionId === null && n.ieltsSection === sectionTab,
              )}
              aiActions={aiActions}
              onHandle={(ref) => setAi(ref, { action: "deleted", text: "" })}
              onRestore={(ref) => setAi(ref, null)}
              start={sectionStart(events, sectionTab)}
              onPlayStart={() => {
                const start = sectionStart(events, sectionTab);
                if (start !== null) seek(start, true);
              }}
              turnStarts={turnStarts}
              onSeek={seekFromNote}
            />
            <FullReviewPaper
              section={sectionTab}
              paper={view.fullPaper}
              questions={questions}
              active={active}
              verdicts={verdicts}
              listening={listening}
              counts={counts}
              onSelect={selectFromPaper}
              onPlay={(id) => {
                const start = questions.get(id)?.evidence?.start;
                if (start != null) seek(start, true);
              }}
            />
          </div>
        ) : (
          <ReviewPaper
            paper={view.paper}
            questions={questions}
            active={active}
            verdicts={verdicts}
            listening={listening}
            counts={counts}
            onSelect={selectFromPaper}
            onPlay={(id) => {
              const start = questions.get(id)?.evidence?.start;
              if (start != null) seek(start, true);
            }}
          />
        )}
        <div ref={marginRef} className="relative grid min-w-0 gap-3 xl:block">
          {cards.map((target) => (
            <div
              key={target}
              data-card={target}
              className={`rounded-2xl transition-shadow xl:absolute xl:inset-x-0 ${flash === target ? "ring-2 ring-primary ring-offset-2" : ""}`}
            >
              <NoteCard
                target={target}
                question={target === SET ? null : (questions.get(target) ?? null)}
                aiNotes={aiOf(target)}
                aiActions={aiActions}
                notes={notesOf(target)}
                active={active === target}
                verdict={verdicts.get(target)}
                onVerdict={(ok) => judge(target, ok)}
                editing={editing}
                warnUnsaved={hintFor !== null && hintFor === editing}
                setEditing={(e) => {
                  if (startEditing(e)) setActive(target);
                }}
                onSaveNote={saveNote}
                onRemoveNote={(key) => setNotes((ns) => ns.filter((n) => n.key !== key))}
                onAiEdit={(ref, text) =>
                  setAi(ref, text === null ? null : { action: "edited", text })
                }
                onAiDelete={(ref, reason) =>
                  setAi(ref, { action: "deleted", text: reason })
                }
                onAiRestore={(ref) => setAi(ref, null)}
                onSelect={() => select(target)}
                onCollapse={collapse}
                currentTime={currentTime}
                turnStarts={turnStarts}
                onSeek={seekFromNote}
                flow={
                  paged && target !== SET
                    ? {
                        openAi: openAiCount(view.aiNotes, sState, target),
                        needsConfirm: verdicts.get(target) === true && !seen.has(target),
                      }
                    : undefined
                }
              />
            </div>
          ))}
        </div>
        <svg
          ref={svgRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible xl:block"
        />
      </div>

      {sectionTab !== null &&
        (() => {
          const check = canComplete(view.questions, view.aiNotes, sState, sectionTab);
          return (
            <SectionFooter
              key={sectionTab}
              progress={progress.find((p) => p.section === sectionTab)!}
              missing={questionsIn(view.questions, sectionTab).flatMap((id) => {
                const m = missingOf(view.aiNotes, sState, id);
                return m.length === 0
                  ? []
                  : [
                      {
                        questionId: id,
                        number: questions.get(id)?.number ?? 0,
                        missing: m,
                      },
                    ];
              })}
              waitFor={check.ok ? null : check.waitFor}
              next={nextSection(sectionTab)}
              onComplete={() => completeSection(sectionTab)}
              onJump={goTo}
            />
          );
        })()}

      {view.turns && !(paged && tab === "summary") && (
        <Transcript
          turns={
            sectionTab === null
              ? view.turns
              : view.turns.filter((x) => x.id.startsWith(`s${sectionTab}-`))
          }
          current={currentTurn}
          focus={focusTurn}
          onSeek={(s) => seek(s, true)}
        />
      )}

      {(!paged || tab === "summary") && (
        <section className="grid gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">{r("decision")}</h2>
          <label className="text-sm">
            <span className="mb-1 block font-medium">{r("comment")}</span>
            <textarea
              name="comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
          {paged ? (
            <div data-summary-submit>
              <div className="flex flex-wrap items-center gap-3">
                <b className={badCount > 0 ? "text-destructive" : "text-accent"}>
                  {badCount > 0 ? r("resultFail") : r("resultPass")}
                </b>
                <Button type="submit" size="sm" disabled={isPending || !canSubmit}>
                  {isPending ? t("common.saving") : prev ? r("update") : r("submit")}
                </Button>
                {!canSubmit && (
                  <span className="text-sm text-muted-foreground">
                    {r("flow.submitNeeds")}
                  </span>
                )}
              </div>
              {submitAlerts}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{r("submitAtTop")}</p>
          )}
        </section>
      )}
    </form>
  );
}
