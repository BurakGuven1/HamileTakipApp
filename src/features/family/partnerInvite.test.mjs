import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPartnerInviteMessage,
  getPartnerInviteState
} from "./partnerInvite.ts";

test("the invite names the inviter when the name is known", () => {
  const message = buildPartnerInviteMessage({
    code: "ab12cd",
    lifeStage: "pregnancy",
    motherName: "Elif"
  });

  assert.match(message, /^Elif seni/);
});

test("a missing name still produces a sendable invite", () => {
  const message = buildPartnerInviteMessage({
    code: "ab12cd",
    lifeStage: "pregnancy",
    motherName: "   "
  });

  assert.match(message, /^Seni/);
  assert.match(message, /AB12CD/);
});

test("the code is always shown in one canonical case", () => {
  // It gets typed by hand on the other phone, so it must match the screen.
  const message = buildPartnerInviteMessage({
    code: "  ab12cd  ",
    lifeStage: "postpartum"
  });

  assert.match(message, /Aile kodu: AB12CD/);
  assert.ok(!message.includes("ab12cd"));
});

test("the invite says what the partner gets, per life stage", () => {
  const pregnancy = buildPartnerInviteMessage({
    code: "x",
    lifeStage: "pregnancy"
  });
  const postpartum = buildPartnerInviteMessage({
    code: "x",
    lifeStage: "postpartum"
  });

  assert.match(pregnancy, /Randevuları/);
  assert.match(postpartum, /gece vardiyasını/);
  assert.notEqual(pregnancy, postpartum);
});

test("the invite explains what to do with the code", () => {
  const message = buildPartnerInviteMessage({ code: "x", lifeStage: "pregnancy" });
  assert.match(message, /giriş ekranında bu kodu gir/);
});

test("a mother with no partner yet is shown the invite", () => {
  assert.equal(
    getPartnerInviteState({ hasCode: true, isFamilyMember: false, memberCount: 0 }),
    "invite"
  );
});

test("a mother whose partner joined is not asked to invite again", () => {
  assert.equal(
    getPartnerInviteState({ hasCode: true, isFamilyMember: false, memberCount: 1 }),
    "linked"
  );
});

test("the partner is never shown an invite to the account they joined", () => {
  assert.equal(
    getPartnerInviteState({ hasCode: true, isFamilyMember: true, memberCount: 0 }),
    "member"
  );
  assert.equal(
    getPartnerInviteState({ hasCode: false, isFamilyMember: true, memberCount: 3 }),
    "member"
  );
});

test("no code means nothing to share, so nothing is offered", () => {
  assert.equal(
    getPartnerInviteState({ hasCode: false, isFamilyMember: false, memberCount: 0 }),
    "unavailable"
  );
});
