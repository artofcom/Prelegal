# Prelegal

## Status

This project is in its initial setup phase.

- Repository created (GitHub: `artofcom/Prelegal`)
- Local git repository initialized on branch `main`
- Initial video game template dataset added
- No application source code or project scaffold yet

## Overview

_Prellegal_ is intended to be a web application (stack and scope TBD) that helps users generate and manage legal documents.

## Template Dataset

The first deliverable is a machine-readable dataset of legal document templates for video game developers, publishers, and community-facing game services.

- `data/video-game-templates.json` — 12 templates with structured variables and sections
- `data/video-game-templates.schema.json` — JSON Schema describing the dataset
- `scripts/validate-templates.mjs` — validates structure and placeholder consistency
- `test/video-game-templates.test.mjs` — Node tests for the dataset and validator

Placeholders in template sections are written as `{{variable_key}}` so a document generation system can later substitute user-specific values.

### Validate the dataset

```bash
npm run validate:templates
npm test
```

> Templates are provided for informational purposes only and are not legal advice.

## Getting Started

_Instructions will be added once the project scaffold exists._
