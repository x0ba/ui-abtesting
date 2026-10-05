"use client";

import { useEffect, useRef } from "react";
import { formatMeeting, type Course } from "@/lib/catalog/courses.ts";
import { exactQuantity } from "./Quantity.tsx";

type Props = {
  course: Course;
  inPlan: boolean;
  onToggle: (add: boolean) => void;
  onClose: () => void;
  inline?: boolean;
};

export function DetailBody({ course, inPlan, onToggle, onClose, inline = false }: Props) {
  return (
    <article className="detail" aria-label={`${course.code} details`}>
      <header className="detail-head">
        <div>
          {!inline && <h2 className="detail-title">{course.title}</h2>}
          <p className="detail-sub">
            {inline ? `${course.deptName}, taught by ${course.instructor}` : `${course.code} in ${course.deptName}, taught by ${course.instructor}`}
          </p>
        </div>
        <button type="button" className="btn-quiet" data-ev="detail.close" onClick={onClose}>
          Close
        </button>
      </header>
      {!inline && <p className="detail-blurb">{course.blurb}</p>}
      <dl className="facts">
        <dt>Meets</dt>
        <dd>{formatMeeting(course)}</dd>
        <dt>Where</dt>
        <dd>{course.room ?? "Online"}</dd>
        <dt>Format</dt>
        <dd>{course.format}</dd>
        <dt>Credits</dt>
        <dd>{course.credits}</dd>
        <dt>Rating</dt>
        <dd>
          {exactQuantity("rating", course)}, from {course.reviews} reviews
        </dd>
        <dt>Workload</dt>
        <dd>{exactQuantity("workload", course)} outside class</dd>
        <dt>Seats</dt>
        <dd>{exactQuantity("seats", course)}</dd>
        <dt>Prerequisites</dt>
        <dd>{course.prereqs.length ? course.prereqs.join(", ") : "None"}</dd>
        <dt>Counts for</dt>
        <dd>{course.requirements.length ? course.requirements.join(", ") : "No requirement"}</dd>
      </dl>
      <button
        type="button"
        className={inPlan ? "btn btn-secondary" : "btn btn-primary"}
        data-ev={inPlan ? "plan.remove" : "plan.add"}
        onClick={() => onToggle(!inPlan)}
      >
        {inPlan ? "Remove from plan" : "Add to plan"}
      </button>
    </article>
  );
}

export function DetailDialog(props: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const { onClose } = props;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="detail-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <DetailBody {...props} />
    </dialog>
  );
}
