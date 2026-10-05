"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatTime, overlaps, type Course, type Dataset } from "@/lib/catalog/courses.ts";
import type { Recorder } from "@/lib/client/recorder.ts";
import { STUDY } from "@/lib/study/config.ts";
import type { Spec } from "@/lib/study/dimensions.ts";
import { DetailBody, DetailDialog } from "./Detail.tsx";
import { DAYS, EMPTY_FILTERS, REQUIREMENTS, SORTS, applyFilters, type Filters, type SortKey } from "./filters.ts";
import { Overview, type ItemHandlers } from "./Overview.tsx";

type Props = {
  dataset: Dataset;
  spec: Spec;
  plan: string[];
  onToggle: (courseId: string, add: boolean, source: string) => void;
  rec: Recorder;
  tools: ReactNode;
  banner?: ReactNode;
  // Increments whenever the system changes the interface, to mark the change.
  systemChange: number;
};

type Open = { id: string; via: string; at: number };

const EMPTY_DETAIL: Record<string, string> = {
  "click-item": "Click a course to see its details here.",
  "click-title": "Click a course title to see its details here.",
  hover: "Rest the pointer on a course to see its details here.",
};

export function Planner({ dataset, spec, plan, onToggle, rec, tools, banner, systemChange }: Props) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("code");
  const [open, setOpen] = useState<Open | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellStart = useRef<Map<string, number>>(new Map());
  const lastScroll = useRef(0);

  const courses = useMemo(() => applyFilters(dataset.courses, filters, sort), [dataset, filters, sort]);
  const byId = useMemo(() => new Map(dataset.courses.map((c) => [c.id, c])), [dataset]);
  const openCourse = open ? byId.get(open.id) ?? null : null;
  const planCourses = plan.map((id) => byId.get(id)).filter((c): c is Course => Boolean(c));

  useEffect(() => {
    if (!filters.query) return;
    const t = setTimeout(() => rec.emit("search.change", { query: filters.query, results: courses.length }), 600);
    return () => clearTimeout(t);
  }, [filters.query, courses.length, rec]);

  function updateFilter<K extends keyof Filters>(name: K, value: Filters[K]) {
    const next = { ...filters, [name]: value };
    setFilters(next);
    if (name !== "query") rec.emit("filter.change", { name, value, results: applyFilters(dataset.courses, next, sort).length });
  }

  function changeSort(next: SortKey, source: string) {
    setSort(next);
    rec.emit("sort.change", { sort: next, source });
  }

  function openDetail(course: Course, via: string) {
    if (open?.id === course.id) return;
    if (open) rec.emit("detail.close", { courseId: open.id, reason: "replaced", ms: Math.round(rec.now() - open.at) });
    rec.emit("detail.open", { courseId: course.id, via, openIn: spec.openIn });
    setOpen({ id: course.id, via, at: rec.now() });
  }

  function closeDetail(reason: string) {
    if (!open) return;
    rec.emit("detail.close", { courseId: open.id, reason, ms: Math.round(rec.now() - open.at) });
    setOpen(null);
  }

  function handlersFor(course: Course): ItemHandlers {
    return {
      onClick:
        spec.invocation === "click-title"
          ? undefined
          : (e) => {
              if ((e.target as HTMLElement).closest("button, a, input, select")) return;
              openDetail(course, "click");
            },
      onPointerEnter: () => {
        dwellStart.current.set(course.id, rec.now());
        if (spec.invocation !== "hover") return;
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => openDetail(course, "hover"), STUDY.hoverOpenDelayMs);
      },
      onPointerLeave: () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        const start = dwellStart.current.get(course.id);
        dwellStart.current.delete(course.id);
        if (start !== undefined && rec.now() - start >= 300) {
          rec.emit("item.dwell", { courseId: course.id, ms: Math.round(rec.now() - start) });
        }
      },
    };
  }

  function toggle(course: Course, add: boolean, source: string) {
    onToggle(course.id, add, source);
  }

  const detail = (c: Course, inline = false) => (
    <DetailBody
      course={c}
      inPlan={plan.includes(c.id)}
      onToggle={(add) => toggle(c, add, "detail")}
      onClose={() => closeDetail("button")}
      inline={inline}
    />
  );

  const depts = [...new Set(dataset.courses.map((c) => c.dept))];
  const clashes = planCourses.flatMap((a, i) => planCourses.slice(i + 1).filter((b) => overlaps(a, b)).map((b) => [a, b] as const));
  const credits = planCourses.reduce((s, c) => s + c.credits, 0);

  return (
    <div
      className="planner"
      data-open-in={spec.openIn}
      onClickCapture={(e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>("[data-ev]");
        const item = (e.target as HTMLElement).closest<HTMLElement>("[data-course]");
        rec.emit("pointer.click", { target: el?.dataset.ev ?? (e.target as HTMLElement).tagName.toLowerCase(), courseId: item?.dataset.course ?? null });
      }}
    >
      <header className="planner-head">
        <p className="brand">Halden College</p>
        <h1 className="planner-title">
          Spring 2027 courses in {dataset.name.toLowerCase()}
        </h1>
        <label className="search">
          <span className="visually-hidden">Search courses</span>
          <input
            type="search"
            placeholder="Search by title, code or instructor"
            value={filters.query}
            onChange={(e) => updateFilter("query", e.target.value)}
          />
        </label>
      </header>

      <aside className="filters" aria-label="Filters">
        <label className="field">
          <span>Department</span>
          <select value={filters.dept} onChange={(e) => updateFilter("dept", e.target.value)}>
            <option value="any">All departments</option>
            {depts.map((d) => (
              <option key={d} value={d}>
                {dataset.courses.find((c) => c.dept === d)?.deptName}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="field">
          <legend>Days you can attend</legend>
          <div className="chips">
            {DAYS.map((d) => (
              <label key={d} className="chip">
                <input
                  type="checkbox"
                  checked={filters.days.includes(d)}
                  onChange={(e) => updateFilter("days", e.target.checked ? DAYS.filter((x) => x === d || filters.days.includes(x)) : filters.days.filter((x) => x !== d))}
                />
                <span>{d}</span>
              </label>
            ))}
          </div>
          <p className="field-help">Online courses with no set time always show.</p>
        </fieldset>

        <label className="field">
          <span>Starts at or after</span>
          <select value={filters.startsAfter ?? ""} onChange={(e) => updateFilter("startsAfter", e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">Any time</option>
            {[9 * 60, 11 * 60, 13 * 60, 15 * 60, 17 * 60].map((m) => (
              <option key={m} value={m}>
                {formatTime(m)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Format</span>
          <select value={filters.format} onChange={(e) => updateFilter("format", e.target.value as Filters["format"])}>
            <option value="any">Any format</option>
            <option>In person</option>
            <option>Hybrid</option>
            <option>Online</option>
          </select>
        </label>

        <fieldset className="field">
          <legend>Counts for</legend>
          <div className="chips">
            {REQUIREMENTS.map((r) => (
              <label key={r} className="chip">
                <input
                  type="checkbox"
                  checked={filters.requirements.includes(r)}
                  onChange={(e) => updateFilter("requirements", e.target.checked ? [...filters.requirements, r] : filters.requirements.filter((x) => x !== r))}
                />
                <span>{r}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="visually-hidden">Availability</legend>
          <label className="check">
            <input type="checkbox" checked={filters.openOnly} onChange={(e) => updateFilter("openOnly", e.target.checked)} />
            <span>Has open seats</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={filters.noPrereqs} onChange={(e) => updateFilter("noPrereqs", e.target.checked)} />
            <span>No prerequisites</span>
          </label>
        </fieldset>
      </aside>

      {/* Alternating the value swaps the animation name, which replays the mark on every change. */}
      <main className="results" data-system-mark={systemChange === 0 ? undefined : systemChange % 2 ? "odd" : "even"}>
        <div className="results-bar">
          <p className="results-count" aria-live="polite">
            {courses.length === dataset.courses.length ? `${courses.length} courses` : `${courses.length} of ${dataset.courses.length} courses`}
          </p>
          <label className="sort">
            <span>Sort by</span>
            <select value={sort} onChange={(e) => changeSort(e.target.value as SortKey, "menu")}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="results-tools">{tools}</div>
        </div>
        {banner}
        <div
          className="results-scroll"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (rec.now() - lastScroll.current < 1000) return;
            lastScroll.current = rec.now();
            rec.emit("scroll", { region: "overview", top: Math.round(el.scrollTop), max: el.scrollHeight - el.clientHeight });
          }}
        >
          {courses.length === 0 ? (
            <div className="empty">
              <p>No courses match these filters.</p>
              <button type="button" className="btn btn-secondary" data-ev="filters.clear" onClick={() => (setFilters(EMPTY_FILTERS), rec.emit("filter.change", { name: "all", value: "cleared" }))}>
                Clear all filters
              </button>
            </div>
          ) : (
            <Overview
              courses={courses}
              spec={spec}
              plan={plan}
              openId={open?.id ?? null}
              sort={sort}
              onSort={(s) => changeSort(s, "header")}
              handlersFor={handlersFor}
              onOpenTitle={(c) => openDetail(c, "title")}
              onToggle={(c, add) => toggle(c, add, "overview")}
              renderInline={(c) => detail(c, true)}
            />
          )}
        </div>
      </main>

      {spec.openIn === "side" && (
        <aside className="side-detail" aria-label="Course details">
          {openCourse ? detail(openCourse) : <p className="side-empty">{EMPTY_DETAIL[spec.invocation]}</p>}
        </aside>
      )}
      {spec.openIn === "popup" && openCourse && (
        <DetailDialog
          key={openCourse.id}
          course={openCourse}
          inPlan={plan.includes(openCourse.id)}
          onToggle={(add) => toggle(openCourse, add, "detail")}
          onClose={() => closeDetail("dismiss")}
        />
      )}

      <section className="plan" aria-label="Your plan">
        <h2 className="plan-title">Your plan</h2>
        {planCourses.length === 0 ? (
          <p className="plan-empty">Nothing yet. Add courses from the list.</p>
        ) : (
          <ul className="plan-list">
            {planCourses.map((c) => (
              <li key={c.id}>
                <span className="plan-code">{c.code}</span> {c.title}
                <button type="button" className="btn-quiet" data-ev="plan.remove" aria-label={`Remove ${c.code}`} onClick={() => toggle(c, false, "plan")}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="plan-credits">{credits} credits</p>
        {clashes.length > 0 && (
          <p className="plan-clash" role="status">
            {clashes.map(([a, b]) => `${a.code} and ${b.code} meet at the same time.`).join(" ")}
          </p>
        )}
      </section>
    </div>
  );
}
