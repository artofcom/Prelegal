import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

export const defaultDatasetPath = resolve(
  currentDirectory,
  "../data/video-game-templates.json",
);

const CATEGORIES = new Set([
  "Licensing",
  "Terms of Service",
  "Privacy",
  "Confidentiality",
  "Contracting",
  "Monetization",
  "Community",
  "Compliance",
  "Promotions",
]);

const VARIABLE_TYPES = new Set([
  "string",
  "text",
  "number",
  "boolean",
  "date",
  "url",
  "email",
]);

const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;
const TAG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const VARIABLE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;
const PLACEHOLDER_PATTERN = /\{\{(.*?)\}\}/g;

export function loadDataset(path = defaultDatasetPath) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function validateDataset(dataset) {
  const errors = [];
  const warnings = [];

  if (!isObject(dataset)) {
    return {
      errors: ["Dataset must be a JSON object."],
      warnings,
      stats: emptyStats(),
    };
  }

  const requiredRootFields = [
    "datasetId",
    "name",
    "version",
    "lastUpdated",
    "locale",
    "description",
    "disclaimer",
    "templates",
  ];

  for (const field of requiredRootFields) {
    if (!(field in dataset)) {
      errors.push(`Dataset is missing required field "${field}".`);
    }
  }

  if (
    typeof dataset.datasetId === "string" &&
    !SLUG_PATTERN.test(dataset.datasetId)
  ) {
    errors.push('Dataset field "datasetId" must use lowercase letters, numbers, and hyphens.');
  }

  if (typeof dataset.version === "string" && !SEMVER_PATTERN.test(dataset.version)) {
    errors.push('Dataset field "version" must be a semantic version such as 1.0.0.');
  }

  if (
    typeof dataset.lastUpdated === "string" &&
    !DATE_PATTERN.test(dataset.lastUpdated)
  ) {
    errors.push('Dataset field "lastUpdated" must use YYYY-MM-DD format.');
  }

  if (typeof dataset.locale === "string" && !LOCALE_PATTERN.test(dataset.locale)) {
    errors.push('Dataset field "locale" must look like en-US.');
  }

  for (const field of ["name", "description", "disclaimer"]) {
    if (typeof dataset[field] === "string" && dataset[field].trim() === "") {
      errors.push(`Dataset field "${field}" must not be empty.`);
    }
  }

  if (!Array.isArray(dataset.templates) || dataset.templates.length === 0) {
    errors.push('Dataset field "templates" must be a non-empty array.');
    return { errors, warnings, stats: emptyStats() };
  }

  const templateIds = new Set();
  const templateSlugs = new Set();
  const stats = {
    templates: dataset.templates.length,
    sections: 0,
    variables: 0,
    placeholders: 0,
  };

  dataset.templates.forEach((template, index) => {
    const path = `templates[${index}]`;
    validateTemplate(template, path, {
      errors,
      warnings,
      stats,
      templateIds,
      templateSlugs,
    });
  });

  return { errors, warnings, stats };
}

function validateTemplate(template, path, context) {
  const { errors, warnings, stats, templateIds, templateSlugs } = context;

  if (!isObject(template)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  const requiredFields = [
    "id",
    "slug",
    "title",
    "category",
    "summary",
    "description",
    "jurisdiction",
    "tags",
    "version",
    "variables",
    "sections",
  ];

  for (const field of requiredFields) {
    if (!(field in template)) {
      errors.push(`${path} is missing required field "${field}".`);
    }
  }

  if (typeof template.id === "string") {
    if (!SLUG_PATTERN.test(template.id)) {
      errors.push(`${path}.id must use lowercase letters, numbers, and hyphens.`);
    } else if (templateIds.has(template.id)) {
      errors.push(`${path}.id duplicates template id "${template.id}".`);
    } else {
      templateIds.add(template.id);
    }
  }

  if (typeof template.slug === "string") {
    if (!SLUG_PATTERN.test(template.slug)) {
      errors.push(`${path}.slug must use lowercase letters, numbers, and hyphens.`);
    } else if (templateSlugs.has(template.slug)) {
      errors.push(`${path}.slug duplicates template slug "${template.slug}".`);
    } else {
      templateSlugs.add(template.slug);
    }
  }

  if (typeof template.version === "string" && !SEMVER_PATTERN.test(template.version)) {
    errors.push(`${path}.version must be a semantic version such as 1.0.0.`);
  }

  if (typeof template.category === "string" && !CATEGORIES.has(template.category)) {
    errors.push(
      `${path}.category "${template.category}" is not one of: ${[...CATEGORIES].join(", ")}.`,
    );
  }

  if (typeof template.summary === "string" && template.summary.length > 200) {
    errors.push(`${path}.summary must be 200 characters or fewer.`);
  }

  for (const field of [
    "id",
    "slug",
    "title",
    "category",
    "summary",
    "description",
    "jurisdiction",
  ]) {
    if (typeof template[field] === "string" && template[field].trim() === "") {
      errors.push(`${path}.${field} must not be empty.`);
    }
  }

  validateTags(template.tags, `${path}.tags`, errors);

  const variables = validateVariables(template.variables, `${path}.variables`, errors);
  stats.variables += Array.isArray(template.variables) ? template.variables.length : 0;

  const placeholders = validateSections(template.sections, `${path}.sections`, errors);
  stats.sections += Array.isArray(template.sections) ? template.sections.length : 0;
  stats.placeholders += placeholders.size;

  if (variables && placeholders) {
    for (const variable of variables) {
      if (!placeholders.has(variable.key)) {
        if (variable.required) {
          errors.push(
            `${path} declares required variable "${variable.key}" but never uses it in a section.`,
          );
        } else {
          warnings.push(
            `${path} declares optional variable "${variable.key}" but never uses it in a section.`,
          );
        }
      }
    }

    for (const placeholder of placeholders) {
      if (!variables.some((variable) => variable.key === placeholder)) {
        errors.push(
          `${path} uses placeholder "{{${placeholder}}}" but does not declare it as a variable.`,
        );
      }
    }
  }
}

function validateTags(tags, path, errors) {
  if (!Array.isArray(tags) || tags.length === 0) {
    errors.push(`${path} must be a non-empty array.`);
    return;
  }

  const seen = new Set();

  tags.forEach((tag, index) => {
    if (typeof tag !== "string" || !TAG_PATTERN.test(tag)) {
      errors.push(`${path}[${index}] must use lowercase letters, numbers, and hyphens.`);
      return;
    }

    if (seen.has(tag)) {
      errors.push(`${path}[${index}] duplicates tag "${tag}".`);
    }

    seen.add(tag);
  });
}

function validateVariables(variables, path, errors) {
  if (!Array.isArray(variables) || variables.length === 0) {
    errors.push(`${path} must be a non-empty array.`);
    return null;
  }

  const seen = new Set();
  const validVariables = [];

  variables.forEach((variable, index) => {
    const variablePath = `${path}[${index}]`;

    if (!isObject(variable)) {
      errors.push(`${variablePath} must be an object.`);
      return;
    }

    for (const field of ["key", "label", "type", "required", "example", "description"]) {
      if (!(field in variable)) {
        errors.push(`${variablePath} is missing required field "${field}".`);
      }
    }

    if (typeof variable.key === "string") {
      if (!VARIABLE_KEY_PATTERN.test(variable.key)) {
        errors.push(
          `${variablePath}.key must use lowercase letters, numbers, and underscores.`,
        );
      } else if (seen.has(variable.key)) {
        errors.push(`${variablePath}.key duplicates variable "${variable.key}".`);
      } else {
        seen.add(variable.key);
      }
    }

    if (typeof variable.type === "string" && !VARIABLE_TYPES.has(variable.type)) {
      errors.push(
        `${variablePath}.type "${variable.type}" is not one of: ${[...VARIABLE_TYPES].join(", ")}.`,
      );
    }

    if (typeof variable.required !== "boolean") {
      errors.push(`${variablePath}.required must be a boolean.`);
    }

    for (const field of ["label", "example", "description"]) {
      if (typeof variable[field] !== "string") {
        errors.push(`${variablePath}.${field} must be a string.`);
      }
    }

    if (typeof variable.description === "string" && variable.description.trim() === "") {
      errors.push(`${variablePath}.description must not be empty.`);
    }

    validVariables.push(variable);
  });

  return validVariables;
}

function validateSections(sections, path, errors) {
  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push(`${path} must be a non-empty array.`);
    return null;
  }

  const seenIds = new Set();
  const placeholders = new Set();

  sections.forEach((section, index) => {
    const sectionPath = `${path}[${index}]`;

    if (!isObject(section)) {
      errors.push(`${sectionPath} must be an object.`);
      return;
    }

    for (const field of ["id", "heading", "body"]) {
      if (!(field in section)) {
        errors.push(`${sectionPath} is missing required field "${field}".`);
      }
    }

    if (typeof section.id === "string") {
      if (!SLUG_PATTERN.test(section.id)) {
        errors.push(
          `${sectionPath}.id must use lowercase letters, numbers, and hyphens.`,
        );
      } else if (seenIds.has(section.id)) {
        errors.push(`${sectionPath}.id duplicates section "${section.id}".`);
      } else {
        seenIds.add(section.id);
      }
    }

    for (const field of ["heading", "body"]) {
      if (typeof section[field] !== "string") {
        errors.push(`${sectionPath}.${field} must be a string.`);
      } else if (section[field].trim() === "") {
        errors.push(`${sectionPath}.${field} must not be empty.`);
      }
    }

    if (typeof section.body === "string") {
      for (const match of section.body.matchAll(PLACEHOLDER_PATTERN)) {
        const key = match[1].trim();

        if (!VARIABLE_KEY_PATTERN.test(key)) {
          errors.push(
            `${sectionPath}.body contains malformed placeholder "{{${match[1]}}}".`,
          );
          continue;
        }

        placeholders.add(key);
      }
    }
  });

  return placeholders;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emptyStats() {
  return { templates: 0, sections: 0, variables: 0, placeholders: 0 };
}

const isMainModule =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  const result = validateDataset(loadDataset());

  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`Error: ${error}`);
    }

    console.error(
      `\nTemplate validation failed with ${result.errors.length} error(s).`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Validated ${result.stats.templates} templates, ${result.stats.sections} sections, ${result.stats.variables} variables, and ${result.stats.placeholders} unique placeholders.`,
    );
  }
}
