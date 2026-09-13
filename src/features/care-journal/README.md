
## Care timer Live Activity (iOS)

A feed or a nap is timed one-handed in the dark, and the phone is locked for
almost all of it. `CareTimerLiveActivity.ios.tsx` puts the running timer on the
Lock Screen and in the Dynamic Island, following the same `expo-widgets` +
`@expo/ui/swift-ui` pattern as the night shift activity.

The timer counts **up**: the `Text timerInterval` has no `countsDown`, and the
upper bound is start + 12 hours purely so the interval has an end that no real
feed or nap will reach.

The activity is driven from `startSharedCareTimer` / `stopSharedCareTimer` in
`src/api/careJournal.ts`, not from the screens, so the care journal and the
night shift both get it without either having to ask. Every call is
fire-and-forget and every failure is swallowed: the entry is already recorded
offline-first and a missing Live Activity must never delay or break logging a
feed.

The second line names the breast side, because that is the one thing a mother
cannot reconstruct from memory at 3am. Copy lives in
`careTimerActivityCopy.ts`, separated from the native surface so it can be
tested without a simulator.
