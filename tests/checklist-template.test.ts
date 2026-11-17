import assert from "node:assert/strict";
import test from "node:test";
import { hasChecklistForEnvironment } from "../src/lib/checklist-template.ts";

test("impede mais de um checklist para o mesmo cômodo", () => {
  const templates = [
    { id: "checklist-kitchen", environment_type: "kitchen" as const },
    { id: "checklist-bedroom", environment_type: "bedroom" as const },
  ];

  assert.equal(hasChecklistForEnvironment(templates, "kitchen"), true);
  assert.equal(hasChecklistForEnvironment(templates, "bathroom"), false);
  assert.equal(hasChecklistForEnvironment(templates, "kitchen", "checklist-kitchen"), false);
});
