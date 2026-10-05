"use client";

import { Fragment, type ReactNode } from "react";
import { formatMeeting, type Course } from "@/lib/catalog/courses.ts";
import type { Spec } from "@/lib/study/dimensions.ts";
import { QUANTITY_LABEL, Quantity, type QuantityKind } from "./Quantity.tsx";
import type { SortKey } from "./filters.ts";

export type ItemHandlers = {
  onClick?: (e: React.MouseEvent) => void;
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
};

type Props = {
  courses: Course[];
  spec: Spec;
  plan: string[];
  openId: string | null;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  handlersFor: (course: Course) => ItemHandlers;
  onOpenTitle: (course: Course) => void;
  onToggle: (course: Course, add: boolean) => void;
  renderInline: (course: Course) => ReactNode;
};

const KINDS: QuantityKind[] = ["rating", "workload", "seats"];

function Title({ course, onOpen }: { course: Course; onOpen: () => void }) {
  return (
    <button type="button" className="ov-title" data-ev="item.title" onClick={(e) => (e.stopPropagation(), onOpen())}>
      {course.title}
    </button>
  );
}

function AddToggle({ course, inPlan, onToggle }: { course: Course; inPlan: boolean; onToggle: Props["onToggle"] }) {
  return (
    <button
      type="button"
      className="ov-add"
      aria-pressed={inPlan}
      aria-label={inPlan ? `Remove ${course.code} from plan` : `Add ${course.code} to plan`}
      data-ev={inPlan ? "plan.remove" : "plan.add"}
      onClick={(e) => (e.stopPropagation(), onToggle(course, !inPlan))}
    >
      {inPlan ? "In plan" : "Add"}
    </button>
  );
}

function Quantities({ course, mode }: { course: Course; mode: string }) {
  return (
    <dl className="ov-q">
      {KINDS.map((k) => (
        <div key={k} className="ov-q-row">
          <dt>{QUANTITY_LABEL[k]}</dt>
          <dd>
            <Quantity kind={k} course={course} mode={mode} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function meta(course: Course): string {
  const counts = course.requirements.length ? ` Counts for ${course.requirements.join(", ")}.` : "";
  return `${formatMeeting(course)}. ${course.credits} credits, ${course.format.toLowerCase()}.${counts}`;
}

export function Overview(props: Props) {
  const { courses, spec, plan, openId, handlersFor, onOpenTitle, onToggle, renderInline } = props;
  const inline = spec.openIn === "inplace";

  if (spec.overviewType === "table") {
    return <TableOverview {...props} />;
  }

  return (
    <ul className={spec.overviewType === "grid" ? "ov-grid" : "ov-list"} data-invocation={spec.invocation}>
      {courses.map((c) => {
        const open = openId === c.id;
        return (
          <li
            key={c.id}
            className="ov-item"
            data-course={c.id}
            data-open={open || undefined}
            data-expanded={(inline && open) || undefined}
            {...handlersFor(c)}
          >
            <div className="ov-main">
              <h3 className="ov-heading">
                <span className="ov-code">{c.code}</span> <Title course={c} onOpen={() => onOpenTitle(c)} />
              </h3>
              {spec.overviewType === "list" && <p className="ov-blurb">{c.blurb}</p>}
              <p className="ov-meta">{meta(c)}</p>
            </div>
            <Quantities course={c} mode={spec.abstraction} />
            <AddToggle course={c} inPlan={plan.includes(c.id)} onToggle={onToggle} />
            {inline && open && <div className="ov-inline">{renderInline(c)}</div>}
          </li>
        );
      })}
    </ul>
  );
}

const COLUMNS: { kind: QuantityKind; sort: SortKey }[] = [
  { kind: "rating", sort: "rating" },
  { kind: "workload", sort: "workload" },
  { kind: "seats", sort: "seats" },
];

function TableOverview({ courses, spec, plan, openId, sort, onSort, handlersFor, onOpenTitle, onToggle, renderInline }: Props) {
  const inline = spec.openIn === "inplace";
  const sortHeader = (key: SortKey, label: string, numeric = false) => (
    <th scope="col" className={numeric ? "num" : undefined} aria-sort={sort === key ? (key === "workload" || key === "code" || key === "start" ? "ascending" : "descending") : undefined}>
      <button type="button" className="th-sort" data-ev={`sort.${key}`} onClick={() => onSort(key)}>
        {label}
      </button>
    </th>
  );
  return (
    <table className="ov-table" data-invocation={spec.invocation}>
      <thead>
        <tr>
          {sortHeader("code", "Course")}
          {sortHeader("credits", "Credits", true)}
          {sortHeader("start", "Meets")}
          {COLUMNS.map((col) => (
            <Fragment key={col.kind}>{sortHeader(col.sort, QUANTITY_LABEL[col.kind], spec.abstraction === "number")}</Fragment>
          ))}
          <th scope="col">Counts for</th>
          <th scope="col">
            <span className="visually-hidden">Plan</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {courses.map((c) => {
          const open = openId === c.id;
          return (
            <Fragment key={c.id}>
              <tr className="ov-item" data-course={c.id} data-open={open || undefined} {...handlersFor(c)}>
                <th scope="row">
                  <span className="ov-code">{c.code}</span> <Title course={c} onOpen={() => onOpenTitle(c)} />
                </th>
                <td className="num">{c.credits}</td>
                <td className="ov-meets">{c.start === null ? "Online" : formatMeeting(c)}</td>
                {COLUMNS.map((col) => (
                  <td key={col.kind} className={spec.abstraction === "number" ? "num" : undefined}>
                    <Quantity kind={col.kind} course={c} mode={spec.abstraction} />
                  </td>
                ))}
                <td className="ov-reqs-cell">{c.requirements.join(", ")}</td>
                <td>
                  <AddToggle course={c} inPlan={plan.includes(c.id)} onToggle={onToggle} />
                </td>
              </tr>
              {inline && open && (
                <tr className="ov-inline-row">
                  <td colSpan={9}>
                    <div className="ov-inline">{renderInline(c)}</div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
