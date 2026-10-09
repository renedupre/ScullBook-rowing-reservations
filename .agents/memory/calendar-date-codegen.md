---
name: Calendar-date code generation
description: Prevent generated date validators from changing calendar-only rowing dates into timestamps.
---

Keep calendar-only rowing dates as validated YYYY-MM-DD strings in both request and response schemas. Orval's Zod generator otherwise emits Date values when useDates is enabled, even for OpenAPI format: date.

**Why:** The template's date coercion initially conflicted with PostgreSQL calendar-date columns and can introduce timezone shifts. Turning off useDates and date coercion preserves the user's selected day.

**How to apply:** Retain string-based generated date validation when changing the API generator or introducing additional calendar-only fields. Timestamp fields may need a separate explicit handling strategy.
