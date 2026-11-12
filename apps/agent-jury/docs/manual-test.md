English · [Español](manual-test.es.md)

# Agent Jury · Manual test script

A script to test the app end to end. The rules are in the [user guide](user-guide.md) ([Español](user-guide.es.md)). Screen and button names are the English ones from the app.

Do not write real names, emails or IDs in this document (or in screenshots you share).

## Before you start

- The app in the environment you are testing, open in your browser, with the Fabric capacity switched on.
- An admin (you) and, for Test B, **two more accounts** in the tenant (a guest or a new user): an approver and an expert. **With two people a case cannot be ruled**: each answer can only get the other person's vote, and two valid votes are needed. With three it can.
- Your account is an admin, and an admin cannot also be an approver. Reopening a case needs an account with the approver role.
- **With a single approver, the cases that approver proposes can never be ruled**: their own vote does not count and ruling needs an approver's vote. For a play session we **recommend at least 2 approvers**, so every case has an approver who is not its author.
- An hour of capacity: hearings use the shared capacity; only one runs at a time, with 10 minutes of rest between hearings.
- When you don't know what to do, look at **Your turn** at the top of Home: it tells you what needs your attention now.

## Test A: on your own (about 15 minutes)

With one person a case cannot be ruled, so this part tests everything else.

- [ ] Reload with Ctrl+Shift+R: the launch screen appears (Session → Docket → All rise) and then Home.
- [ ] Home: **How it works** opens the Intro; you can skip it (**Skip intro**) and you return to Home. On the last step, **Read the full guide** opens the guide inside the app and **Back** brings you back.
- [ ] Switch EN/ES: every text changes, and nowhere do the Spanish texts use "fallo" or "fallado".
- [ ] Switch Windows to the dark theme and reload: everything is readable.
- [ ] **Clerk's office** → Agents → **+ Register an agent**: name, **Workspace ID** and **Agent ID**, copied from the agent's address in Fabric. A badly typed ID is rejected with a message. The new agent shows up right away, also in the Home and Cases switchers, without a reload.
- [ ] Clerk's office: **Show example data** is off in production; turning it on shows the example jurors and agents (labelled "Example") and the tab counters change. After a reload it is off again.
- [ ] Clerk's office → Jurors → your row → **Edit details**: change your display name and see it reflected in the list.
- [ ] **Cases** → **+ Propose a case**: propose 3 cases with an answer and a complete definition, using questions whose answer you know (see the table). The form says the question is sent to the agent exactly as written, in this language. Each case is "Open for votes" with 0 votes: proposing is not voting.
- [ ] Home → **Your turn**: after proposing your cases it says "You're up to date" (you are only waiting for others); the progress strip (Propose · Vote · Ruled · Hearing · Review) counts your cases and highlights "N cases waiting for votes".
- [ ] The lists say what happens next for you: on your cases, "You proposed it: waiting for others".
- [ ] Ticker ("Latest on the docket"): it appears on Home when there are at least 2 lines, it moves, it stops on hover or with the pause button, and each line opens its case.
- [ ] On one of your cases, **Vote for answer A** is not available to you: "Your own answer: your vote on it wouldn't count". Each answer shows what counts, the time window, who counts and the source table.
- [ ] **Export case law** is disabled and its tooltip says why (there are no ruled cases yet).
- [ ] Phone (390 px): open the app on your phone and go through Home, Cases and a case; nothing runs off the screen. In the Clerk's office the jurors appear as cards, with nothing clipped.

| Question to propose | Verified answer | Definition |
| --- | --- | --- |
| How many customers do we have in Spain? | 141 | Billing country (alternatives: 265 by shipping country, 292 either one) |
| What was our net revenue in fiscal year 2026? | 2,183,973.48 | Net of tax and freight, July 2025 to June 2026 |
| What is the average order value? | 2,226.97 | Net; the agent usually gives 2,460.80 (gross), a sure error for the demo |

## Test B: with two other people (about 45 minutes)

Best on the same call, each on their own computer. We call your admin account **Ana**, the approver **Beto** and the expert **Carla**.

**Access**

- [ ] Before adding them: Beto signs in with his account and sees "Objection!" with "You are not on this jury yet. Ask an admin to add you." and the **Copy my sign-in name** button, plus the line "Send it to an admin so they can add you." There is no retry button.
- [ ] Ana adds them in Clerk's office → **Swear in a juror**: Beto with the Approver role and Carla with the Expert role.
- [ ] On reload, each sees the Intro (their first time) and then Home; reloading again goes straight to Home.

**Ruling a case**

- [ ] Beto and Carla see "1 case waiting for your vote" in **Your turn** (with a **Vote** button); Beto, as an approver, also sees "1 case needs an approver vote".
- [ ] Ana proposes the Spain case with the answer 141 (billing country). Beto and Carla press **Vote for answer A**: with Beto's (approver) vote and Carla's, the case is **ruled** and the ticker announces it. Meanwhile the answer said "N more votes in favour needed, at least one from an approver".
- [ ] Ana proposes another case (for example the fiscal 2026 one) and only Carla votes in favour: it is **not** ruled; the list says "Waiting for an approver". When Beto votes too, it is ruled.

**Dispute**

- [ ] A new case: Ana proposes 141 and Beto proposes **another answer** (265, shipping country) with its definition. Carla votes 141 and Ana votes 265: the case becomes **disputed** and both definitions are shown.
- [ ] Beto votes 141. It stays disputed while anyone backs 265. Ana votes **against** 265 with a reason: only 141 keeps support and the case is **ruled**. (There is no majority tie-break: a dispute only ends when support is withdrawn.)
- [ ] Alternative: another ambiguous case; Ana uses **Dismiss: the question is ambiguous** with a reason and the case is dismissed and never enters a hearing.

**Export**

- [ ] Ana presses **Export case law** and opens the CSV in Excel: only ruled cases appear, accents are right, no names or emails. The file name carries the agent and the date.

**Hearing and reviewing the judge**

- [ ] Ana sees "N ruled cases ready for a hearing" in **Your turn**. In **Hearings** → **Start a hearing**: choose 1 to 3 ruled cases (maximum 5), look at the estimate and the agent version (published or draft), and start. Beto and Carla don't see the form: "Only admins can start a hearing."
- [ ] While it runs: progress is visible and another one cannot be started. If it seems stuck, **Check with Fabric** asks one question; **Cancel the hearing** stops it.
- [ ] When it finishes there is one verdict per case (Correct / Incorrect / Unclear). In **Your turn**, each juror sees "N judge verdicts to review".
- [ ] Ana, Beto and Carla review each verdict: **Yes, agree** or **No, appeal** (with a comment). If the majority corrects the judge, the ticker says "Judge overruled". Home shows trust as "n of m" (the percentage only appears from 5 decided verdicts).
- [ ] Beto (approver), reviewing the verdict of the Spain case, picks the reason "The expected answer is wrong": the case reopens, the old votes appear as "before the review" in the court record and no longer count, and Ana and Carla have to vote again. A new hearing no longer includes it. Carla (expert) can review, but that reason does not reopen the case.
- [ ] When you finish: lower the capacity or pause it.

If something fails, note the screen, the time and a screenshot with no personal data, and send it to Copilot.
