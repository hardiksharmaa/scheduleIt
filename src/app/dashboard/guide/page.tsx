import { Metadata } from "next";
import GuideClient from "./GuideClient";

export const metadata: Metadata = { title: "User Guide — ScheduleIt" };

export default function GuidePage() {
  return <GuideClient />;
}
