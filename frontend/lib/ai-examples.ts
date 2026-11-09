import type { AIOperation } from "./api";

export const fictionalExamples: Record<AIOperation | "question", readonly string[]> = {
  care_plan: [
    "Fictional coordination note: Mira has an upcoming clinic visit on 2026-11-18. Asha will organize the appointment folder, Dev will arrange transport, and Priya will check whether someone can accompany Mira. The pickup time and clinic entrance still need confirmation.",
    "Fictional coordination note: Mira's family is planning a week of postpartum support. Asha is available on Monday and Wednesday, Dev can coordinate groceries, and Priya will organize meal preparation. Weekend coverage has not been assigned.",
    "Fictional coordination note: The family wants a shared care checklist for the coming week. Dev will confirm the next appointment, Asha will prepare the requested documents, and Priya will coordinate household support. The appointment date is still unconfirmed."
  ],

  summarize: [
    "Fictional coordination note: During Sunday's family discussion, Mira confirmed that her clinic appointment is on 2026-11-18 at 10:30 AM. Asha agreed to prepare the documents, Dev offered to arrange transport, and Priya volunteered to accompany Mira. The pickup location remains undecided.",
    "Fictional coordination note: The clinic informed Mira that the appointment location has changed. Asha will verify the new address. Dev has already collected the requested folder, but transport has not been confirmed. The family will discuss arrangements tomorrow.",
    "Fictional coordination note: Mira's family reviewed their weekly responsibilities. Priya completed the grocery shopping, Asha prepared the appointment folder, and Dev still needs to confirm the vehicle. Nobody has confirmed who will accompany Mira."
  ],

  extract_tasks: [
    "Fictional coordination note: By 2026-11-18, Asha will prepare Mira's appointment folder. Dev will confirm transport by 2026-11-17. Priya will check the clinic address. The family still needs to decide the pickup location.",
    "Fictional coordination note: Dev agreed to call the clinic tomorrow to verify the appointment time. Asha will organize the requested documents, and Priya will prepare a list of questions Mira wants to discuss during the visit.",
    "Fictional coordination note: The family is organizing weekend support. Priya will prepare meals on Saturday, Dev will arrange groceries, and Asha will coordinate Sunday coverage. The Sunday caregiver has not been confirmed."
  ],

  appointment_prep: [
    "Fictional coordination note: Mira has a clinic appointment on 2026-11-18 at 10:30 AM. Asha will accompany her, Dev will arrange transport, and Priya will prepare the previously requested documents. The clinic entrance and pickup time still need confirmation.",
    "Fictional coordination note: Asha will accompany Mira to her next prenatal visit. Mira wants to ask about her upcoming appointment schedule and the documents needed for future visits. The exact appointment time and clinic location have not yet been confirmed.",
    "Fictional coordination note: Mira's follow-up appointment is scheduled for Friday morning. Dev has offered to drive, and Asha will prepare the appointment folder. The family needs to confirm the exact time, parking arrangements, and who will accompany Mira inside."
  ],

  handoff_draft: [
    "Fictional coordination note: Dev was originally responsible for arranging Mira's transport but is unavailable on 2026-11-18. Asha has agreed to take over transport coordination. Dev needs to share the clinic address and confirm whether a vehicle has already been booked.",
    "Fictional coordination note: Priya has been coordinating Mira's weekend meal preparation but will be away on Sunday. Asha has agreed to take over. Priya will share the grocery list and meal schedule. The handover time is not confirmed.",
    "Fictional coordination note: Asha has prepared Mira's appointment folder and will transfer responsibility for carrying it to Dev. The folder contains the previously requested documents. Dev has not yet acknowledged the handoff."
  ],

  update_draft: [
    "Fictional coordination note: Mira's appointment documents are ready. Asha has completed the folder, Dev has confirmed transport, and Priya will accompany Mira. The family still needs to agree on the pickup location.",
    "Fictional coordination note: This week's family support arrangements are progressing. Priya completed grocery shopping, Asha organized Monday's meals, and Dev confirmed Wednesday's transport. Weekend responsibilities remain unassigned.",
    "Fictional coordination note: Mira's clinic appointment was rescheduled to 2026-11-20. Asha has informed the family, but Dev has not confirmed whether transport can be moved to the new date. The updated appointment time is still pending."
  ],

  nutrition_notes: [
    "Fictional meal notes: Mira recorded breakfast as oatmeal and banana at 8:30 AM, lunch as rice and lentils at 1 PM, and an evening snack of fruit. Water intake was recorded twice. Dinner details have not yet been entered.",
    "Fictional meal notes: The family prepared vegetable rice for lunch and soup for dinner. Mira noted that she prefers smaller meals during busy days. Asha offered to help organize tomorrow's meal preparation. No nutritional targets were specified.",
    "Fictional meal notes: Breakfast included toast and fruit. Lunch was prepared by Priya, and Dev arranged groceries for the evening. Mira wants to maintain a simple meal and hydration diary. The afternoon snack was not recorded."
  ],

  question: [
    "Fictional example question: Based on the current care workspace, which coordination tasks are still pending, who is responsible, and which details need confirmation?",
    "Fictional example question: Which caregiver handoffs are awaiting acknowledgement, and what information should be confirmed before responsibilities are transferred?",
    "Fictional example question: What upcoming appointments and care responsibilities are recorded in the workspace, and which arrangements remain unresolved?"
  ]
};

export function fictionalExampleAt(mode: keyof typeof fictionalExamples, index: number) {
  const examples = fictionalExamples[mode];
  return examples[index % examples.length];
}