# GrowLens Routines and Reminder Boundary

## Supported schedules

GrowLens supports one-time, daily, weekly, and monthly tasks. A recurring task stays as one stable record. Completing it increments its completion count, records the last completion timestamp, and advances the due date.

This reschedule-on-completion design avoids generating duplicate future task records during normal local use and synchronization.

## Date behavior

- Overdue daily and weekly routines advance from the completion date so they do not remain overdue.
- Future routines remain anchored to their scheduled due date.
- Monthly routines clamp to the final valid day of shorter months. For example, January 31 advances to February 28 or 29.
- Legacy tasks without recurrence metadata remain one-time tasks.

## Existing task-screen compatibility

The original Tasks screen predates recurrence. If a recurring task is checked there, the Routines panel detects the completed recurring record, records the completion, advances its due date, and returns it to the open schedule.

## Browser reminder boundary

Browser reminders are optional and require explicit notification permission. GrowLens checks due tasks when the page or installed PWA is open, focused, or becomes visible.

This is not a guaranteed closed-app background alarm. Reliable background delivery would require a separately reviewed push or native scheduling system and should not be represented as available until implemented and tested.

## Data portability

Recurrence, completion count, and last-completed timestamps are part of the GrowLens task record. They are included in JSON backups, complete local backups, task CSV exports, plant timelines, and printable grow reports.
