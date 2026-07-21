// ===========================================================================
// ONBOARDING TEMPLATE  —  EDIT THIS FILE TO MATCH YOUR PROGRAM
// ===========================================================================
// dayOffset  = business days from cohort start (0 = start date itself, 1 = next
//              business day, ...). Weekends are skipped automatically.
// startTime  = 24-hour local time ("09:00", "13:30").
// duration   = minutes.
// body       = simple HTML is allowed (<b>, <br>, <ul><li>, links, etc.).
//
// Convention: "Session: ..." items are the fixed curriculum — keep them in
// the same relative order and front-loaded in the morning. Everything else
// (lunch, e-learning, shadowing blocks, check-ins) is flexible filler and can
// move around them.
//
// NOTE: times below were transcribed from a screenshot of the real "US
// Onboarding" week and rounded to clean increments — exact minute boundaries
// on the busier days (Mon 9-11am, Thu's five back-to-back sessions) were hard
// to read precisely. Review and adjust before relying on this for a real
// cohort.

export const TIME_ZONE = "Eastern Standard Time";

export interface OnboardingSession {
  title: string;
  dayOffset: number;
  startTime: string;
  duration: number;
  location: string;
  body: string;
}

export const ONBOARDING_TEMPLATE: OnboardingSession[] = [
  // ---- Monday ----
  {
    title: "Welcome to Coverdash With the People Team!",
    dayOffset: 0,
    startTime: "09:00",
    duration: 30,
    location: "Teams",
    body: "Welcome to Coverdash! Overview of our mission, org structure, and your first-week roadmap.",
  },
  {
    title: "Session: Introduction to Coverdash",
    dayOffset: 0,
    startTime: "09:30",
    duration: 60,
    location: "Teams",
    body: "Introduction to Coverdash: what we do, how the business works, and where you fit in.",
  },
  {
    title: "Welcome to the Growth Team",
    dayOffset: 0,
    startTime: "10:30",
    duration: 30,
    location: "Teams",
    body: "Meet the Growth team and get an overview of how the team operates.",
  },
  {
    title: "Session: Customer Deep Dive",
    dayOffset: 0,
    startTime: "11:00",
    duration: 60,
    location: "Teams",
    body: "Deep dive on our customers: who they are, what they need, and how we serve them.",
  },
  {
    title: "Lunch",
    dayOffset: 0,
    startTime: "12:00",
    duration: 60,
    location: "",
    body: "Lunch break.",
  },
  {
    title: "E-Learning",
    dayOffset: 0,
    startTime: "13:00",
    duration: 60,
    location: "",
    body: "Self-paced e-learning modules.",
  },
  {
    title: "Sales Onboarding: Shadowing & Process Walkthrough (Agenda Below)",
    dayOffset: 0,
    startTime: "14:00",
    duration: 120,
    location: "Teams",
    body: "Shadow the sales team and walk through the sales process. Agenda TBD.",
  },
  {
    title: "E-Learning",
    dayOffset: 0,
    startTime: "16:00",
    duration: 60,
    location: "",
    body: "Self-paced e-learning modules.",
  },
  {
    title: "End-of-Day Sales Team Check-In",
    dayOffset: 0,
    startTime: "17:00",
    duration: 30,
    location: "Teams",
    body: "Quick check-in with the sales team to close out the day.",
  },

  // ---- Tuesday ----
  {
    title: "Session: GL, BOP, Property",
    dayOffset: 1,
    startTime: "09:00",
    duration: 120,
    location: "Teams",
    body: "Coverage overview: General Liability, BOP, and Property.",
  },
  {
    title: "All Hands",
    dayOffset: 1,
    startTime: "11:00",
    duration: 60,
    location: "Teams",
    body: "Company All Hands.",
  },
  {
    title: "Session: Professional Liability & Executive Risk AE",
    dayOffset: 1,
    startTime: "12:00",
    duration: 60,
    location: "Teams",
    body: "Coverage overview: Professional Liability and Executive Risk, with an AE perspective.",
  },
  {
    title: "Lunch",
    dayOffset: 1,
    startTime: "13:00",
    duration: 30,
    location: "",
    body: "Lunch break.",
  },
  {
    title: "Sales Onboarding: Shadowing & Process Walkthrough (Agenda Below)",
    dayOffset: 1,
    startTime: "13:30",
    duration: 60,
    location: "Teams",
    body: "Shadow the sales team and walk through the sales process. Agenda TBD.",
  },
  {
    title: "E-Learning",
    dayOffset: 1,
    startTime: "14:30",
    duration: 60,
    location: "",
    body: "Self-paced e-learning modules.",
  },
  {
    title: "Sales Onboarding: Shadowing & Process Walkthrough (Agenda Below)",
    dayOffset: 1,
    startTime: "15:30",
    duration: 60,
    location: "Teams",
    body: "Shadow the sales team and walk through the sales process. Agenda TBD.",
  },
  {
    title: "End-of-Day Sales Team Check-In",
    dayOffset: 1,
    startTime: "16:30",
    duration: 30,
    location: "Teams",
    body: "Quick check-in with the sales team to close out the day.",
  },

  // ---- Wednesday ----
  {
    title: "Session: Workers Comp & Auto",
    dayOffset: 2,
    startTime: "09:00",
    duration: 60,
    location: "Teams",
    body: "Coverage overview: Workers Comp and Auto.",
  },
  {
    title: "Session: Wholesalers and Non-Admitted Pt.1",
    dayOffset: 2,
    startTime: "10:00",
    duration: 60,
    location: "Teams",
    body: "Wholesalers and non-admitted markets, part 1.",
  },
  {
    title: "Session: Admin App & Ascend",
    dayOffset: 2,
    startTime: "11:00",
    duration: 60,
    location: "Teams",
    body: "Tooling walkthrough: the Admin App and Ascend.",
  },
  {
    title: "Lunch",
    dayOffset: 2,
    startTime: "12:00",
    duration: 30,
    location: "",
    body: "Lunch break.",
  },
  {
    title: "Sales Onboarding: Shadowing & Process Walkthrough (Agenda Below)",
    dayOffset: 2,
    startTime: "12:30",
    duration: 90,
    location: "Teams",
    body: "Shadow the sales team and walk through the sales process. Agenda TBD.",
  },
  {
    title: "E-Learning",
    dayOffset: 2,
    startTime: "14:00",
    duration: 60,
    location: "",
    body: "Self-paced e-learning modules.",
  },
  {
    title: "Sales Onboarding: Shadowing & Process Walkthrough (Agenda Below)",
    dayOffset: 2,
    startTime: "15:00",
    duration: 90,
    location: "Teams",
    body: "Shadow the sales team and walk through the sales process. Agenda TBD.",
  },
  {
    title: "End-of-Day Sales Team Check-In",
    dayOffset: 2,
    startTime: "16:30",
    duration: 30,
    location: "Teams",
    body: "Quick check-in with the sales team to close out the day.",
  },

  // ---- Thursday ----
  {
    title: "Session: Wholesalers & Non-Admitted Pt.2",
    dayOffset: 3,
    startTime: "09:00",
    duration: 60,
    location: "Teams",
    body: "Wholesalers and non-admitted markets, part 2.",
  },
  {
    title: "Session: Quoting with Internal Rater & Manual Quoting Tool",
    dayOffset: 3,
    startTime: "10:00",
    duration: 60,
    location: "Teams",
    body: "Quoting walkthrough using the internal rater and manual quoting tool.",
  },
  {
    title: "Session: Close & LAQ",
    dayOffset: 3,
    startTime: "11:00",
    duration: 90,
    location: "Teams",
    body: "Closing process and LAQ.",
  },
  {
    title: "Lunch",
    dayOffset: 3,
    startTime: "12:30",
    duration: 30,
    location: "",
    body: "Lunch break.",
  },
  {
    title: "Session: SIT Tool",
    dayOffset: 3,
    startTime: "13:00",
    duration: 60,
    location: "Teams",
    body: "Walkthrough of the SIT tool.",
  },
  {
    title: "Session: Wholesalers & Non-Admitted Pt.3",
    dayOffset: 3,
    startTime: "14:00",
    duration: 60,
    location: "Teams",
    body: "Wholesalers and non-admitted markets, part 3.",
  },
  {
    title: "Inboxes/Workflows",
    dayOffset: 3,
    startTime: "15:00",
    duration: 60,
    location: "Teams",
    body: "Walkthrough of shared inboxes and workflows.",
  },
  {
    title: "Carrier Portals Access Check in",
    dayOffset: 3,
    startTime: "16:00",
    duration: 30,
    location: "Teams",
    body: "Confirm access to carrier portals.",
  },
  {
    title: "End-of-Day Sales Team Check-In",
    dayOffset: 3,
    startTime: "16:30",
    duration: 30,
    location: "Teams",
    body: "Quick check-in with the sales team to close out the day.",
  },

  // ---- Friday ----
  {
    title: "Session: Warm Transfers",
    dayOffset: 4,
    startTime: "09:00",
    duration: 60,
    location: "Teams",
    body: "How to handle warm transfers.",
  },
  {
    title: "Sales Onboarding: Shadowing & Process Walkthrough (Agenda Below)",
    dayOffset: 4,
    startTime: "10:00",
    duration: 120,
    location: "Teams",
    body: "Shadow the sales team and walk through the sales process. Agenda TBD.",
  },
  {
    title: "Session: Close Templates",
    dayOffset: 4,
    startTime: "12:00",
    duration: 30,
    location: "Teams",
    body: "Walkthrough of close templates.",
  },
  {
    title: "Lunch",
    dayOffset: 4,
    startTime: "12:30",
    duration: 30,
    location: "",
    body: "Lunch break.",
  },
  {
    title: "Daily Operating Rhythm w/ Ray",
    dayOffset: 4,
    startTime: "13:00",
    duration: 60,
    location: "Teams",
    body: "Daily operating rhythm with Ray.",
  },
  {
    title: "Sales Onboarding: Shadowing & Process Walkthrough (Agenda Below)",
    dayOffset: 4,
    startTime: "14:00",
    duration: 120,
    location: "Teams",
    body: "Shadow the sales team and walk through the sales process. Agenda TBD.",
  },
  {
    title: "End-of-Day Sales Team Check-In",
    dayOffset: 4,
    startTime: "16:00",
    duration: 30,
    location: "Teams",
    body: "Quick check-in with the sales team to close out the day.",
  },
];
