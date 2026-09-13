import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateTriage,
  getCallChecklist,
  getSymptomsForStage,
  TRIAGE_SYMPTOMS
} from "./triageRules.ts";

test("every symptom has a stage, an urgency and a unique id", () => {
  const ids = new Set();
  for (const symptom of TRIAGE_SYMPTOMS) {
    assert.ok(symptom.label.length > 0, `${symptom.id} needs a label`);
    assert.ok(
      ["pregnancy", "postpartum_mother", "baby"].includes(symptom.stage),
      `${symptom.id} has an unknown stage`
    );
    assert.ok(
      ["emergency", "same_day", "monitor"].includes(symptom.urgency),
      `${symptom.id} has an unknown urgency`
    );
    assert.ok(!ids.has(symptom.id), `duplicate id ${symptom.id}`);
    ids.add(symptom.id);
  }
});

test("each stage offers all three urgency levels", () => {
  // A stage that only ever answers "call now" trains the reader to ignore it.
  for (const stage of ["pregnancy", "postpartum_mother", "baby"]) {
    const urgencies = new Set(
      getSymptomsForStage(stage, 40).map((symptom) => symptom.urgency)
    );
    assert.equal(urgencies.size, 3, `${stage} is missing an urgency level`);
  }
});

test("nothing selected never produces an urgency", () => {
  const outcome = evaluateTriage([]);
  assert.equal(outcome.urgency, null);
  assert.equal(outcome.matched.length, 0);
});

test("one red flag outranks any number of mild complaints", () => {
  const outcome = evaluateTriage([
    "pregnancy_heartburn",
    "pregnancy_cramps",
    "pregnancy_bleeding"
  ]);

  assert.equal(outcome.urgency, "emergency");
  assert.equal(outcome.headline, "Şimdi ara");
});

test("the most urgent selection decides, not the most common one", () => {
  const outcome = evaluateTriage([
    "baby_reflux",
    "baby_stool",
    "baby_fever_older"
  ]);

  assert.equal(outcome.urgency, "same_day");
});

test("only mild symptoms are reported as worth watching", () => {
  const outcome = evaluateTriage(["postpartum_afterpains", "postpartum_hairloss"]);
  assert.equal(outcome.urgency, "monitor");
});

test("unknown ids are ignored rather than treated as a symptom", () => {
  const outcome = evaluateTriage(["not_a_real_symptom"]);
  assert.equal(outcome.urgency, null);
});

test("fetal movement is only offered once movements can be assessed", () => {
  const early = getSymptomsForStage("pregnancy", 20).map((item) => item.id);
  const late = getSymptomsForStage("pregnancy", 32).map((item) => item.id);

  assert.ok(!early.includes("pregnancy_movement"));
  assert.ok(late.includes("pregnancy_movement"));
});

test("an unknown gestational week hides week-dependent symptoms", () => {
  const unknown = getSymptomsForStage("pregnancy", null).map((item) => item.id);
  assert.ok(!unknown.includes("pregnancy_movement"));
  // Symptoms that matter at any week are still offered.
  assert.ok(unknown.includes("pregnancy_bleeding"));
});

test("a stage only ever returns its own symptoms", () => {
  for (const stage of ["pregnancy", "postpartum_mother", "baby"]) {
    for (const symptom of getSymptomsForStage(stage, 40)) {
      assert.equal(symptom.stage, stage);
    }
  }
});

test("the call checklist leads with what the stage is asked first", () => {
  assert.match(getCallChecklist("pregnancy")[0], /hafta/);
  assert.match(getCallChecklist("postpartum_mother")[0], /Doğum tarihin/);
  assert.match(getCallChecklist("baby")[0], /Bebeğin doğum tarihi/);
});

test("newborn fever is an emergency and older infant fever is not", () => {
  assert.equal(evaluateTriage(["baby_fever_newborn"]).urgency, "emergency");
  assert.equal(evaluateTriage(["baby_fever_older"]).urgency, "same_day");
});

test("self-harm thoughts are always routed to immediate help", () => {
  assert.equal(evaluateTriage(["postpartum_thoughts"]).urgency, "emergency");
});
