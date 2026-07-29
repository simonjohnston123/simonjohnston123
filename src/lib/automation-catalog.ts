// Pure, client-safe catalogue of automation triggers & actions.
// No server imports here so the builder UI (client components) can use it too.

export type TriggerKey =
  | "CONTACT_CREATED"
  | "TAG_ADDED"
  | "OPPORTUNITY_CREATED"
  | "FORM_SUBMITTED"
  | "MANUAL";

export type ActionKey =
  | "SEND_EMAIL"
  | "SEND_SMS"
  | "ADD_TAG"
  | "CREATE_TASK"
  | "CREATE_NOTE"
  | "WAIT";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number";
  placeholder?: string;
  optional?: boolean;
};

export const TRIGGERS: Record<TriggerKey, { label: string; description: string; live: boolean }> = {
  CONTACT_CREATED: {
    label: "Contact created",
    description: "Runs the moment a new contact is added to this business.",
    live: true,
  },
  TAG_ADDED: {
    label: "Tag added",
    description: "Runs when a specific tag is applied to a contact.",
    live: false,
  },
  OPPORTUNITY_CREATED: {
    label: "Opportunity created",
    description: "Runs when a new opportunity enters a pipeline.",
    live: false,
  },
  FORM_SUBMITTED: {
    label: "Form / booking submitted",
    description: "Runs when a website form or booking is submitted.",
    live: true,
  },
  MANUAL: {
    label: "Manual / test only",
    description: "Only runs when you trigger it by hand. Great for testing.",
    live: true,
  },
};

export const ACTIONS: Record<
  ActionKey,
  { label: string; icon: string; description: string; fields: FieldDef[]; note?: string }
> = {
  SEND_EMAIL: {
    label: "Send email",
    icon: "✉",
    description: "Send an email to the contact.",
    fields: [
      { key: "subject", label: "Subject", type: "text", placeholder: "Thanks for reaching out" },
      { key: "body", label: "Body", type: "textarea", placeholder: "Hi {{firstName}}, ..." },
    ],
    note: "Recorded in the contact's conversation. Real delivery activates when an email provider is connected.",
  },
  SEND_SMS: {
    label: "Send SMS",
    icon: "💬",
    description: "Send a text message to the contact.",
    fields: [{ key: "body", label: "Message", type: "textarea", placeholder: "Hi {{firstName}}, ..." }],
    note: "Recorded in the contact's conversation. Real delivery activates when an SMS provider is connected.",
  },
  ADD_TAG: {
    label: "Add tag",
    icon: "🏷",
    description: "Apply a tag to the contact.",
    fields: [{ key: "tag", label: "Tag", type: "text", placeholder: "lead" }],
  },
  CREATE_TASK: {
    label: "Create task",
    icon: "✓",
    description: "Create a follow-up task for the team.",
    fields: [
      { key: "title", label: "Task title", type: "text", placeholder: "Call {{firstName}}" },
      { key: "dueInDays", label: "Due in (days)", type: "number", placeholder: "1", optional: true },
    ],
  },
  CREATE_NOTE: {
    label: "Add note",
    icon: "📝",
    description: "Attach an internal note to the contact.",
    fields: [{ key: "body", label: "Note", type: "textarea", placeholder: "..." }],
  },
  WAIT: {
    label: "Wait / delay",
    icon: "⏱",
    description: "Pause before the next step.",
    fields: [{ key: "minutes", label: "Wait (minutes)", type: "number", placeholder: "60" }],
    note: "Recorded in v1 but runs instantly — real delays activate when the scheduler is enabled.",
  },
};

export const ACTION_KEYS = Object.keys(ACTIONS) as ActionKey[];
export const TRIGGER_KEYS = Object.keys(TRIGGERS) as TriggerKey[];
