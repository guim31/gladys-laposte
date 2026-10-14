# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-10-14

### Added

- Track La Poste parcels (Colissimo, Chronopost, tracked letters) with the official La Poste "Suivi" API v2 and a
  free API key: "Add a parcel", "Remove a parcel" and "Read the parcels now" in the configuration.
- One "La Poste parcels" device: parcels on the way, out for delivery, to pick up, with a problem, recently
  delivered, and a summary sentence.
- "My parcels" dashboard widget: status badge, last event and date, details and link to laposte.fr.
- Scene triggers: a parcel is out for delivery, delivered, awaits pickup, has a problem.
- Scene actions: "Track a parcel" (also finds the number in a mail subject) and "Read my parcels".
- Each parcel is read every 30 minutes (adjustable), never once delivered, and removed 7 days after delivery
  (adjustable).
- English, French, German and Spanish everywhere.

[Unreleased]: https://github.com/guim31/gladys-laposte/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-laposte/releases/tag/v1.0.0
