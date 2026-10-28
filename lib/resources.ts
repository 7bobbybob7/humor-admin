/**
 * Registry of the admin's table-backed resources.
 *
 * The simple ones are described here and rendered by one generic list/form
 * pair, so adding a table is a config entry rather than three new pages.
 * Resources whose view carries real meaning - generation requests with their
 * responses, images with an upload - have bespoke pages instead.
 *
 * `capabilities` mirrors the brief exactly: prompt chains and their steps are
 * read-only, the mix is read/update, and nothing here can be created or
 * deleted unless the brief asks for it.
 */

export type FieldType = "text" | "textarea" | "number" | "boolean" | "select";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  max?: number;
  help?: string;
  /** For `select`: fill the options from another table. */
  optionsFrom?: { table: string; value: string; label: string };
  /** For `select`: a fixed option list. */
  options?: { value: string; label: string }[];
};

export type Capability = "create" | "read" | "update" | "delete";

export type Resource = {
  slug: string;
  table: string;
  title: string;
  blurb: string;
  capabilities: Capability[];
  /** Columns fetched for the list view. */
  select: string;
  /** Columns shown as table headers, in order. */
  list: { name: string; label: string; kind?: "bool" | "date" | "mono" | "long" }[];
  fields: Field[];
  order: { column: string; ascending: boolean };
};

export const RESOURCES: Resource[] = [
  {
    slug: "llm-providers",
    table: "llm_providers",
    title: "LLM providers",
    blurb: "Vendors the generator can call.",
    capabilities: ["create", "read", "update", "delete"],
    select: "id, name, slug, docs_url, is_active, created_at",
    list: [
      { name: "name", label: "Name" },
      { name: "slug", label: "Slug", kind: "mono" },
      { name: "docs_url", label: "Docs", kind: "mono" },
      { name: "is_active", label: "Active", kind: "bool" },
      { name: "created_at", label: "Added", kind: "date" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 80 },
      { name: "slug", label: "Slug", type: "text", required: true, max: 40,
        help: "Lowercase identifier, unique." },
      { name: "docs_url", label: "Docs URL", type: "text", max: 300 },
      { name: "is_active", label: "Active", type: "boolean" },
    ],
    order: { column: "created_at", ascending: true },
  },
  {
    slug: "llm-models",
    table: "llm_models",
    title: "LLM models",
    blurb:
      "The generator tries active models in priority order, lowest first, and records each attempt.",
    capabilities: ["create", "read", "update", "delete"],
    select:
      "id, provider_id, model_key, display_name, priority, is_active, notes, created_at",
    list: [
      { name: "display_name", label: "Model" },
      { name: "model_key", label: "API key name", kind: "mono" },
      { name: "priority", label: "Priority" },
      { name: "is_active", label: "Active", kind: "bool" },
      { name: "notes", label: "Notes", kind: "long" },
    ],
    fields: [
      { name: "provider_id", label: "Provider", type: "select", required: true,
        optionsFrom: { table: "llm_providers", value: "id", label: "name" } },
      { name: "model_key", label: "API key name", type: "text", required: true, max: 120,
        help: "Exactly what the SDK is called with, e.g. gemini-flash-latest." },
      { name: "display_name", label: "Display name", type: "text", required: true, max: 120 },
      { name: "priority", label: "Priority", type: "number",
        help: "Lower is tried first." },
      { name: "is_active", label: "Active", type: "boolean" },
      { name: "notes", label: "Notes", type: "textarea", max: 500 },
    ],
    order: { column: "priority", ascending: true },
  },
  {
    slug: "prompt-chains",
    table: "prompt_chains",
    title: "Prompt chains",
    blurb: "Named prompt pipelines. Read-only — edit the steps and the mix instead.",
    capabilities: ["read"],
    select: "id, name, slug, description, is_active, created_at",
    list: [
      { name: "name", label: "Name" },
      { name: "slug", label: "Slug", kind: "mono" },
      { name: "description", label: "Description", kind: "long" },
      { name: "is_active", label: "Active", kind: "bool" },
    ],
    fields: [],
    order: { column: "id", ascending: true },
  },
  {
    slug: "prompt-chain-steps",
    table: "prompt_chain_steps",
    title: "Prompt chain steps",
    blurb:
      "Ordered templates concatenated to build a prompt. {{topic}}, {{count}}, {{terms}} and {{examples}} are substituted at run time.",
    capabilities: ["read"],
    select: "id, chain_id, step_order, label, template, is_active",
    list: [
      { name: "chain_id", label: "Chain" },
      { name: "step_order", label: "#" },
      { name: "label", label: "Step" },
      { name: "template", label: "Template", kind: "long" },
      { name: "is_active", label: "Active", kind: "bool" },
    ],
    fields: [],
    order: { column: "id", ascending: true },
  },
  {
    slug: "prompt-chain-mix",
    table: "prompt_chain_mix",
    title: "Prompt chain mix",
    blurb:
      "How traffic is split between chains. A request picks a chain at random, weighted by these numbers; weight 0 retires a chain without deleting it.",
    capabilities: ["read", "update"],
    select: "id, chain_id, weight, updated_at",
    list: [
      { name: "chain_id", label: "Chain" },
      { name: "weight", label: "Weight" },
      { name: "updated_at", label: "Updated", kind: "date" },
    ],
    fields: [
      { name: "weight", label: "Weight", type: "number", required: true,
        help: "Relative share of traffic. 0 disables the chain." },
    ],
    order: { column: "id", ascending: true },
  },
  {
    slug: "terms",
    table: "terms",
    title: "Terms",
    blurb:
      "Vocabulary steering. Active terms are folded into the prompt as words to avoid or prefer.",
    capabilities: ["create", "read", "update", "delete"],
    select: "id, term, kind, note, is_active, created_at",
    list: [
      { name: "term", label: "Term" },
      { name: "kind", label: "Kind" },
      { name: "note", label: "Why", kind: "long" },
      { name: "is_active", label: "Active", kind: "bool" },
    ],
    fields: [
      { name: "term", label: "Term", type: "text", required: true, max: 60 },
      { name: "kind", label: "Kind", type: "select", required: true,
        options: [
          { value: "avoid", label: "avoid" },
          { value: "prefer", label: "prefer" },
        ] },
      { name: "note", label: "Why", type: "textarea", max: 300 },
      { name: "is_active", label: "Active", type: "boolean" },
    ],
    order: { column: "id", ascending: true },
  },
  {
    slug: "examples",
    table: "ai_generation_examples",
    title: "AI generation examples",
    blurb:
      "Few-shot examples. Active examples for the chosen chain are shown to the model as the target voice.",
    capabilities: ["create", "read", "update", "delete"],
    select: "id, chain_id, topic, example_caption, is_active, created_at",
    list: [
      { name: "chain_id", label: "Chain" },
      { name: "topic", label: "Topic" },
      { name: "example_caption", label: "Caption", kind: "long" },
      { name: "is_active", label: "Active", kind: "bool" },
    ],
    fields: [
      { name: "chain_id", label: "Chain", type: "select",
        optionsFrom: { table: "prompt_chains", value: "id", label: "name" } },
      { name: "topic", label: "Topic", type: "text", required: true, max: 120 },
      { name: "example_caption", label: "Example caption", type: "textarea",
        required: true, max: 300 },
      { name: "is_active", label: "Active", type: "boolean" },
    ],
    order: { column: "id", ascending: true },
  },
  {
    slug: "signup-domains",
    table: "allowed_signup_domains",
    title: "Allowed signup domains",
    blurb: "Email domains permitted to create an account.",
    capabilities: ["create", "read", "update", "delete"],
    select: "id, domain, note, is_active, created_at",
    list: [
      { name: "domain", label: "Domain", kind: "mono" },
      { name: "note", label: "Note", kind: "long" },
      { name: "is_active", label: "Active", kind: "bool" },
      { name: "created_at", label: "Added", kind: "date" },
    ],
    fields: [
      { name: "domain", label: "Domain", type: "text", required: true, max: 120,
        help: "Bare domain, e.g. columbia.edu — no @ and no scheme." },
      { name: "note", label: "Note", type: "text", max: 200 },
      { name: "is_active", label: "Active", type: "boolean" },
    ],
    order: { column: "id", ascending: true },
  },
  {
    slug: "whitelisted-emails",
    table: "whitelisted_emails",
    title: "Whitelisted e-mail addresses",
    blurb: "Individual addresses allowed regardless of domain.",
    capabilities: ["create", "read", "update", "delete"],
    select: "id, email, note, is_active, created_at",
    list: [
      { name: "email", label: "Email", kind: "mono" },
      { name: "note", label: "Note", kind: "long" },
      { name: "is_active", label: "Active", kind: "bool" },
      { name: "created_at", label: "Added", kind: "date" },
    ],
    fields: [
      { name: "email", label: "Email", type: "text", required: true, max: 200 },
      { name: "note", label: "Note", type: "text", max: 200 },
      { name: "is_active", label: "Active", type: "boolean" },
    ],
    order: { column: "id", ascending: true },
  },
];

export function getResource(slug: string): Resource | undefined {
  return RESOURCES.find((r) => r.slug === slug);
}

export function can(resource: Resource, capability: Capability): boolean {
  return resource.capabilities.includes(capability);
}
