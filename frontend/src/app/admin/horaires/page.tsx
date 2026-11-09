import type { Metadata } from "next";

import { BusinessHoursEditor } from "./BusinessHoursEditor";
import { TimeOffManager } from "./TimeOffManager";

export const metadata: Metadata = { title: "Horaires et congés" };

export default function SchedulePage() {
  return (
    <div className="space-y-10">
      <BusinessHoursEditor />
      <TimeOffManager />
    </div>
  );
}
