# CERT Field Guide (draft)

An offline field reference for CERT volunteers. It is an installable web app (PWA) for iPhone, iPad, and Android.

**Status: DRAFT. Not for field use until it has been reviewed.** The medical, triage, and procedural content is pending review by a CERT instructor and the local CERT program. Until then, use it for study only. In an incident, follow your training, your team leader, and local protocols.

Live app: https://luap829.github.io/cert-field-guide/

## Sources and credit
- **FEMA**, *CERT Basic Training Participant Manual* (2019 update): https://www.ready.gov/sites/default/files/2019.CERT_.Basic_.PM_FINAL_508c.pdf
- **"CERT Triage & Mass Casualty Incidents" (Optional Unit)**, as used by the local CERT program. No publisher, date, or usage statement is printed in it.
- **Milton Township, DuPage County CERT Code of Conduct**, provided by the program (cover and printed pages 1–4). It appears under Local Protocols in the program’s own wording. Individual names are left out.

This is a **condensed field reference**. It is **not a FEMA product** and is **not endorsed by FEMA**, DHS, or the authors or publisher of the triage unit. Every item cites a page in its source. When the app opens, a welcome page shows the Milton Township CERT mission statement, motto, and safety reminder; tap Continue to go to the home screen. Manual misprints and contradictions are corrected or flagged in the app's **About & Sources** screen.

**Wording rule.** Under Illinois rules, a non-medical professional may make a determination of death only in cases of decapitation. The app therefore uses only "Black" for that triage category.

## Privacy and offline design
- **No data collected.** There are no accounts, analytics, cookies, trackers, or third-party fonts or scripts, and no network calls after the first load.
- **Counts only.** The tally counters store counts (no names, conditions, or locations) on your device only, and you can reset them at any time.
- **Works offline.** A service worker saves every file on the first visit, so the app then works in Airplane Mode.

## Add it to an iPhone home screen
1. Open https://luap829.github.io/cert-field-guide/ in **Safari**.
2. Tap **Share** (the square with an up arrow), then **Add to Home Screen**, then **Add**.
3. While you have signal, **open it once from the new icon** and wait a few seconds. The home-screen app keeps its own offline copy.
4. Test it: turn on Airplane Mode and open the icon.

On an iPad, the Share button is at the top right. On Android (Chrome), use the ⋮ menu, then **Install app**.

## Repository contents
This repository holds only the built static app (`index.html`, `css/`, `js/`, `data/`, `icons/`, `manifest.webmanifest`, `sw.js`). Source PDFs, text extracts, and planning files are not included.
