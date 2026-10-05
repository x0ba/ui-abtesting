export function Done({ sessionNumber, totalSessions, finishedAll }: { sessionNumber?: number; totalSessions: number; finishedAll?: boolean }) {
  const all = finishedAll || sessionNumber === totalSessions;
  return (
    <main className="page">
      <div className="page-col prose">
        <h1 className="page-title">{all ? "You've finished the study" : `Session ${sessionNumber} of ${totalSessions} is done`}</h1>
        <p className="lede">
          {all
            ? "Thank you for taking part. Your answers and choices are saved, and there's nothing more to do."
            : "Thank you. Your answers and choices are saved. Come back for the next session with the same code when the research team asks you to."}
        </p>
        <p>You can close this page.</p>
      </div>
    </main>
  );
}
