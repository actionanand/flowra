# Flowra notification behavior

Flowra schedules Android reminders from each profile’s current period prediction and that profile’s reminder settings.

## Reminder time

- Reminders are scheduled for **9:00 AM on the device’s local time**.
- If the calculated 9:00 AM time is already in the past when reminders are rebuilt, Flowra skips that reminder instead of showing a late notification.
- Reminders are rebuilt when the app starts, after backup restore, and when profile/reminder/prediction data changes.

## “Days before” behavior

The reminder offset is a single notification, not a daily sequence.

- **Period day / 0 days before**: one reminder on the predicted period day only.
- **1 day before**: one reminder one day before the predicted period date only.
- **3 days before**: one reminder three days before the predicted period date only.

Example: if the most likely period date is 24 August and the setting is 3 days before, Flowra schedules one reminder for 21 August at 9:00 AM. It does not also send reminders on 22 August, 23 August, or 24 August.

## Multiple profiles

Flowra treats reminders per profile.

- Each profile has its own reminder setting.
- If reminders are enabled for multiple profiles and each profile has a prediction, each profile can receive its own notification.
- Updating a profile or changing its reminder setting replaces that profile’s previous scheduled reminder.

## Private wording

When private notification wording is enabled, Flowra avoids profile names and period wording in the notification:

- Title: `Flowra`
- Message: `Upcoming health reminder`

When private wording is disabled, Flowra uses clearer cycle wording:

- Title: `<profile name>'s cycle reminder`
- Period day message: `Your next period may begin today.`
- Before-period message: `Your next period may begin in about <number> days.`

## Why a reminder may not appear

A reminder is not scheduled when:

- Android notification permission is not allowed.
- The profile does not have enough history for a prediction.
- The calculated reminder date/time is already in the past.
- The profile’s reminder toggle is off.
