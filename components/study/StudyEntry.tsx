"use client";

import dynamic from "next/dynamic";

// The session lives in sessionStorage and IndexedDB, so there is nothing useful to render on the server.
export const StudyEntry = dynamic(() => import("./StudyApp.tsx").then((m) => m.StudyApp), { ssr: false });
