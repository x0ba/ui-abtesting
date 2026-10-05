"use client";

import { FOCUS_OPTIONS, type Task } from "@/lib/study/tasks.ts";

type Props = {
  task: Task;
  taskIndex: number;
  taskCount: number;
  stepIndex: number;
  objective: string | null;
  planSize: number;
  onObjective: (id: string) => void;
  onNextStep: () => void;
  onSubmit: () => void;
};

export function TaskSlip({ task, taskIndex, taskCount, stepIndex, objective, planSize, onObjective, onNextStep, onSubmit }: Props) {
  const last = stepIndex === task.steps.length - 1;
  return (
    <header className="slip" aria-label="Your task">
      <div className="slip-task">
        <h2 className="slip-title">{task.title}</h2>
        <p className="slip-brief">{task.brief}</p>
      </div>

      <ol className="slip-steps">
        {task.steps.map((s, i) => (
          <li key={s.id} aria-current={i === stepIndex ? "step" : undefined} data-done={i < stepIndex || undefined}>
            {s.instruction}
          </li>
        ))}
      </ol>

      <div className="slip-side">
        <fieldset className="focus">
          <legend>What matters most right now?</legend>
          <div className="focus-options">
            {FOCUS_OPTIONS.map((f) => (
              <label key={f.id} className="focus-option">
                <input type="radio" name="focus" value={f.id} checked={objective === f.id} onChange={() => onObjective(f.id)} />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="slip-actions">
          {last ? (
            <button type="button" className="btn btn-slip" data-ev="task.submit" disabled={planSize === 0} onClick={onSubmit}>
              Submit plan
            </button>
          ) : (
            <button type="button" className="btn btn-slip" data-ev="step.done" onClick={onNextStep}>
              Done with this step
            </button>
          )}
          <p className="slip-progress">
            Task {taskIndex + 1} of {taskCount}, step {stepIndex + 1} of {task.steps.length}
            {last && planSize === 0 && <span className="slip-note">Add a course to submit.</span>}
          </p>
        </div>
      </div>
    </header>
  );
}
