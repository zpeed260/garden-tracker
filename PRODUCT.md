# Product

## Register

product

## Users

Single user — a home vegetable gardener in Eltham, Victoria. Uses the app outside in the garden on a mobile phone as the primary device: checking tasks at the beds, logging notes, reviewing what to do this week. Occasionally checks on a desktop browser at home. Hands may be dirty. Sunlight is real. The user is not a beginner but isn't performing expertise — they just want to grow food and keep track of it.

## Product Purpose

A personal garden management tool for five raised beds. Tracks the weekly task schedule, fertiliser rotation, plant growth stages, and provides AI photo analysis of bed health. Success looks like: the user opens it at the start of each week, knows exactly what to do, and closes it without friction.

## Brand Personality

Logical, practical, unpretentious. The tone of a knowledgeable friend who's been growing vegetables for years — gives you the right information without lecturing. Think modern Don Burke: straight-talking, grounded in real experience, occasionally warm but never sentimental.

## References

- Modern Don Burke — practical, no-nonsense, knows what actually works in an Australian backyard
- A well-kept field notebook or planting journal — organized, tactile, purposeful
- Good tool design (a quality trowel, not a gadget)

## Anti-references

- Better Homes and Gardens (older style) — too decorative, too soft, too lifestyle-magazine
- Generic "wellness" or "mindfulness" app aesthetics — pastel, rounded, inspirational-quote energy
- Over-engineered dashboards with charts and metrics everywhere
- Anything that looks like it was designed for a startup pitch deck

## Design Principles

1. **Information at a glance.** The user is standing in a garden. They need the answer fast — what to do today, which bed needs attention, what fertiliser to use. No hunting.
2. **Outdoor legibility.** High contrast, generous touch targets, text that reads in direct sunlight on a phone screen. Not decorative contrast — functional contrast.
3. **Honest plainness.** The design should feel like a well-made physical object: sturdy, purposeful, no unnecessary ornamentation. Earn every visual element.
4. **Seasonal mood.** The interface should feel connected to the growing cycle — earthy, alive, not synthetic. Not achieved through illustrations or mascots; achieved through considered color and texture.
5. **Quiet confidence.** Competent without showing off. The app knows what week it is, what's in each bed, what needs doing. It doesn't need to celebrate this with animations and congratulations.

## Accessibility & Inclusion

Primary use case is outdoors in bright sunlight on a mobile phone. High contrast ratios are non-negotiable — minimum WCAG AA, targeting AAA for critical text (task titles, bed names, stage labels). Touch targets minimum 44x44px everywhere. No reliance on color alone to convey status — always pair with text or icon.

---

## Task Scheduling

### Sow-date-relative weeks

Tasks are scheduled relative to each bed's sow date, not the global season calendar. The first time any plant in a bed is marked as sown, the bed's task clock starts at Week 1. Week 2 begins 7 days after sowing, Week 3 after 14 days, and so on.

Before any plant in a bed is sowed, the bed's task list shows a "not yet sowed" state — no tasks are presented because there is nothing to track yet.

### What "current week" means per bed

For a given bed:
- **Current week** = `floor((today − sow_date) / 7) + 1`, minimum 1 on the sow day itself
- Tasks whose `week_number` equals the current bed week are this week's tasks (expanded by default)
- Tasks whose `week_number` is less than the current bed week and are not yet completed are **overdue** — shown at the top of the task list in amber, week by week, until the user marks them done
- Tasks whose `week_number` is greater than the current bed week are upcoming (collapsed by default)

### Global (cross-bed) tasks

Some tasks apply to all beds — compost prep, fertiliser applications, frost cloth. These are tagged `bed_id = NULL` and are driven by the global season calendar (`SEASON_START`), not per-bed sow dates. They appear on the Dashboard and within each bed's task list at their scheduled global week.

### Task lifecycle

A task is in one of three states:
- **Pending** — not yet due or due this week
- **Overdue** — past its scheduled week, not completed
- **Done** — marked complete by the user

There is no separate "skip" action; marking a task complete is the only way to clear it from the overdue list. Overdue tasks persist and accumulate until resolved. This is intentional — the user should see what was missed.

### Correcting a missed sow date

If a bed was sowed but the app wasn't opened that day, the week clock will be wrong. Once a bed is fully sowed, an "Edit date" button appears next to the sow confirmation. Tapping it shows a date picker (capped at today) that updates the `planted_date` for all plants in the bed — recalculating `bed_week` and the entire task schedule immediately. This corrects overdue calculations retrospectively.

---

## Beds

### Bed 5 — Lettuce (as of 2026-05-17)

Bed 5 was replanted with Lettuce (All Year variety) on 2026-05-17, replacing the previous Spinach/Silverbeet/Kale mix. Two rows run the full length of the bed (2 cols × 8 rows = 16 plants). The bed was sowed on the same day, so its task clock began at Week 1 on 2026-05-17.
