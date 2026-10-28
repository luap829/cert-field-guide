# CERT Field Guide - Milton Township

An offline field reference for Milton Township CERT volunteers. It is an installable web app (PWA) for iPhone, iPad, and Android. It will be adopted as the official guide of the registered Milton Township CERT program once the final changes are made and approved.

**Status: DRAFT. Not for field use until it has been reviewed.** The medical, triage, and procedural content is pending review by a CERT instructor and the local CERT program. Until then, use it for study only. In an incident, follow your training, your team leader, and local protocols.

Live app: https://luap829.github.io/cert-field-guide/

## Sources and credit
- **FEMA**, *CERT Basic Training Participant Manual* (2019 update): https://www.ready.gov/sites/default/files/2019.CERT_.Basic_.PM_FINAL_508c.pdf
- **"CERT Triage & Mass Casualty Incidents" (Optional Unit)**, by FEMA; a copy was provided by the Milton Township CERT program (not bundled in the app). No author, publisher, date, or usage statement is printed in the document itself.
- **CERT logo:** National CERT program (FEMA), used by the registered Milton Township CERT program per the CERT Logo Usage Guide. The logo is shown unaltered.
- **Milton Township, DuPage County CERT Code of Conduct**, provided by the program (cover and printed pages 1–4). It appears under Local Protocols in the program’s own wording. Individual names are left out.

This is a **condensed field reference**, condensed and adapted (reworded, and corrected in places) from FEMA material; see the original manual for exact text. It is **not a FEMA product** and is **not endorsed by FEMA** or DHS. Most items cite a source and page (for example "FEMA CERT Basic PM (2019), p. 3-4" or "FEMA CERT Triage & MCI unit, p. 17"). Some do not: the Milton Township CERT Motto and the safety reminder on the welcome page have no page citation, and the Illinois "Status: Black" note cites Illinois law rather than a page. When the app opens, a welcome page shows the official CERT logo, the Milton Township CERT mission statement, the Milton Township CERT Motto, and a safety reminder; tap Continue to go to the home screen. Manual misprints and contradictions are corrected or flagged in the app's **About & Sources** screen.

**Wording rule.** Black is a CERT triage category, not a legal pronouncement of death; CERT volunteers do not pronounce death; they only confirm whether a person meets the Black triage criteria. In Illinois, death is certified by a physician, APRN, or PA, or by the coroner or medical examiner (410 ILCS 535/18; 55 ILCS 5/3-3013), and EMS rules on withholding CPR for obvious signs apply to licensed EMS personnel under medical direction, not bystanders (77 Ill. Adm. Code 515.380(c)). The app uses only "Status: Black" for that triage outcome.

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
