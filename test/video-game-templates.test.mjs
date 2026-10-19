import test from "node:test";
import assert from "node:assert/strict";

import { loadDataset, validateDataset } from "../scripts/validate-templates.mjs";

test("the video game template dataset is valid", () => {
  const dataset = loadDataset();
  const result = validateDataset(dataset);

  assert.deepEqual(result.errors, []);
  assert.ok(result.stats.templates >= 10, "expected at least 10 templates");
  assert.ok(result.stats.sections >= 50, "expected at least 50 sections");
  assert.ok(result.stats.variables >= 50, "expected at least 50 variables");
});

test("every template includes variables and multiple sections", () => {
  const dataset = loadDataset();

  for (const template of dataset.templates) {
    assert.ok(template.variables.length > 0, `${template.id} has no variables`);
    assert.ok(template.sections.length >= 5, `${template.id} has too few sections`);
  }
});

test("duplicate template ids are reported", () => {
  const dataset = loadDataset();
  dataset.templates.push(structuredClone(dataset.templates[0]));

  const result = validateDataset(dataset);

  assert.ok(
    result.errors.some((error) => error.includes("duplicates template id")),
    "expected a duplicate id error",
  );
});

test("placeholders without a matching variable are reported", () => {
  const dataset = loadDataset();
  dataset.templates[0].sections[0].body += " {{missing_variable}}";

  const result = validateDataset(dataset);

  assert.ok(
    result.errors.some((error) => error.includes('placeholder "{{missing_variable}}"')),
    "expected an undefined placeholder error",
  );
});

test("required variables that are never used are reported", () => {
  const dataset = loadDataset();
  dataset.templates[0].variables.push({
    key: "unused_required_value",
    label: "Unused required value",
    type: "string",
    required: true,
    example: "example",
    description: "A required variable that no section uses.",
  });

  const result = validateDataset(dataset);

  assert.ok(
    result.errors.some((error) =>
      error.includes('required variable "unused_required_value"'),
    ),
    "expected an unused required variable error",
  );
});
