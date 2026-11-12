# Agent Jury · User guide

Agent Jury has business people decide which answer is the right one before an AI judge scores a Fabric Data Agent. This guide explains how to play and what the rules are. To test the app end to end, use the [test script](manual-test.md) (in Spanish). Versión en español: [user-guide.es.md](user-guide.es.md).

## What it is and who does what

A Data Agent answers business questions, but nobody has told it which answer is the good one. In Agent Jury the jury first decides the expected answer to each question; then an AI judge compares what the agent answers with that answer, and the jury reviews the judge.

Each person has **one role**:

| Role | What they can do |
| --- | --- |
| Expert | Propose cases and answers, vote on them, dismiss their own cases and review the judge's verdicts |
| Approver | Everything an expert does, and also: a case is only ruled when an approver's vote confirms it, and only an approver can reopen a ruled case because its expected answer was wrong |
| Admin | Everything an expert does (their vote counts as an expert's), and also manages in the Clerk's office who is on the jury and which agents are evaluated, **starts and cancels hearings**, and can dismiss any case |

Someone who is not on the jury cannot get in: opening the app shows "Objection!" with "You are not on this jury yet. Ask an admin to add you." and a button to copy their sign-in name and send it to an admin, who adds them in the Clerk's office.

Words of the game:

- **Case**: a business question.
- **Answer** (testimony): a proposed answer to a case, with its definition.
- **Ruling**: the answer the jury accepts. The case is then **ruled**.
- **Hearing**: a run of the agent against ruled cases.
- **Verdict**: what the AI judge says (Correct, Incorrect or Unclear). "Verdict" is only for the judge; what the jury does is a "ruling".
- **Appeal**: a jury review that differs from the judge's verdict.
- **Case law**: the set of ruled cases, exportable as CSV.

## How to play

A game goes from a business question to an agreed answer, and from there to measuring the agent and the judge.

1. **Set up the courtroom (admin).** In the **Clerk's office**, add the jurors (the email they use to sign in to Fabric, and a role) and register the agent to evaluate: its name, the **Workspace ID** and the **Agent ID**, copied from the agent's address in Fabric.
2. **Propose a case.** Any juror presses **+ Propose a case** on Cases, writes the question the way a business user would ask it ("How many customers do we have in Spain?"), a category, optional tags and **their answer** with a one-sentence definition. The optional details (criterion, time window, population, source) help show where two answers differ. Proposing a case **does not count as a vote**: your own answer starts with no votes, and your vote on it never counts.
3. **Vote.** The rest of the jury opens the case and presses **Vote for answer A**, or **Vote against** (a reason is required), or proposes another answer with **Propose another answer** and its own definition. You can change your mind: the latest vote of each person stands.
4. **Rule or dispute.** A case is *ruled* when one answer has two valid votes in favour, at least one from an approver, and no approver against (details below). If two different answers have support, the case becomes a **dispute**, which is where the definitions each team uses without knowing show up (for example billing country versus shipping country).
5. **Hold a hearing (admin).** On **Hearings**, **Start a hearing**: choose the ruled questions (up to 5 for now) and the version of the agent (published or draft), and see a time estimate. A notebook in Fabric asks the agent the questions and the AI judge gives one verdict per case. The hearing page shows progress and the verdicts as they arrive.
6. **Review the judge.** Each juror reviews each verdict: **Yes, agree** or **No, appeal** (on desktop, keys A and X; J/K to move). An appeal needs a comment. When the jury's majority corrects the judge, the ticker announces it as "Judge overruled".
7. **Reopen if needed.** If an approver, while reviewing a verdict, picks the reason "The expected answer is wrong", the case reopens: earlier votes stay in the court record marked "before the review" but stop counting, and the jury votes again.
8. **Measure trust in the judge.** Home shows how often the jury agrees with the judge ("n of m"), per agent and per judge prompt version.
9. **Export the case law.** On Cases, **Export case law** downloads a CSV (`question,expected_answer,category,tags`) of the agent's ruled cases, to reuse in other evaluations.

The first time, the app shows a three-step Intro; you can replay it from Home with **How it works**.

## The rules, precisely

### When a case is ruled

An answer rules the case when all three hold:

- It has **at least 2 valid votes in favour** (the current threshold is 2).
- **At least one** of those votes is from an **approver**.
- **No approver** has voted against that answer.

A vote is valid when an active juror casts it and they are **not the author of that answer**. A vote against needs a reason; without one it does not count. An admin votes as an expert, never with an approver's weight.

Note: with the current threshold you need **at least two people voting on someone else's answer**, one of them an approver. With only two jurors nothing can be ruled (each answer can only get the other person's vote), so testing the app needs **three jurors**. With a single approver, the cases that approver proposes can never be ruled (their own vote doesn't count and ruling needs an approver's vote), so a play session should have **at least 2 approvers**.

### Dispute and how it resolves

A case is in **dispute** when:

- two or more answers each have some vote in favour, even if one has many more; or
- one answer has votes in favour and against **from approvers** at the same time.

There is no automatic tie-break and the majority does not win. A dispute is settled between the people, in one of these ways:

- whoever backed one of the answers **changes their vote** (to "against", with a reason), so that only one answer keeps support; or
- the case is **dismissed** (its author or an admin can do it) when the question is ambiguous; it stays in the record but is never used in a hearing.

Once only one answer has support, the ruling rules above apply.

### Hearings

- **Only an admin** starts (and cancels) hearings; everyone else watches and reviews them.
- Only **ruled** cases (by active jurors) that are **not reopened** can go in. At most **5 cases per hearing** for now.
- **One hearing at a time** across the whole capacity, with **10 minutes of rest** between hearings.
- Before starting, the app shows a time estimate (about 2 minutes to get ready plus about 30 seconds per question).

### Reopening (R9)

An active approver, while reviewing a hearing verdict, picks the reason "The expected answer is wrong". It does not matter what the judge said. The case goes back to "Under review": the old votes stay visible as "before the review" but do not count, and everyone has to vote again. If the new votes split between answers, the case becomes a dispute under the normal rules. An expert or an admin can review but **cannot reopen**. Since each person has a single role, an admin cannot also be an approver: reopening needs an account with the approver role.

### Trust in the judge

- It is computed **per agent and per judge prompt version** (a different prompt is a different judge): the current version prominently and earlier ones as history.
- For each verdict the **majority** of valid reviews decides; a tie stays "pending" and does not count.
- It is an agreement when the jury says the same as the judge (if the judge says "Unclear", agreement is "Ambiguous").
- Reviews with the reason "The expected answer is wrong" do not count (the judge compared well with a bad answer).
- Trust is agreements / (agreements + disagreements). The big percentage appears from 5 decided verdicts; before that, only "n of m".
- Demonstration data (rows marked "seed" or from checks) does not count.

### Other rules

| Rule | How it works |
| --- | --- |
| Changing your mind | The latest review or vote of each person stands; nothing is deleted |
| Cases and answers by someone who is no longer an active juror | Shown as "unverified"; they do not count and never enter hearings or the export |
| Example data | Whatever was seeded for demos is left out of the export |
| Export | Only the agent's ruled, not reopened cases, with no names, emails or ids; cells a spreadsheet would read as a formula get a leading `'` |

The agent does not always answer the same thing: on the Spain question it answered 141 once and 292 another time. That is why it is worth repeating hearings and watching the trend, not a single run.
