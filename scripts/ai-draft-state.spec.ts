import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareAiApply, canUndoAi } from "../lib/ai-draft-state";

const input = { generatedAt: "v1", currentVersion: "v1", draft: { metaTitle: "New title", metaTitleId: "Judul baru" }, current: { metaTitle: "Old title", metaTitleId: "" }, selected: {}, language: "both", mode: "replace" };
test("stale AI results cannot overwrite newer form changes", () => assert.throws(() => prepareAiApply({...input,currentVersion:"v2"}), /source changed/));
test("fill empty keeps existing copy and fills only empty fields", () => assert.deepEqual(prepareAiApply({...input,mode:"empty"}),{metaTitle:"Old title",metaTitleId:"Judul baru"}));
test("language and field selection preserve other values", () => {
  assert.deepEqual(prepareAiApply({...input,language:"id"}),{metaTitle:"Old title",metaTitleId:"Judul baru"});
  assert.deepEqual(prepareAiApply({...input,selected:{metaTitle:false}}),{metaTitle:"Old title",metaTitleId:"Judul baru"});
});
test("undo refuses to overwrite edits made after applying AI", () => {
  const applied=prepareAiApply(input);
  assert.equal(canUndoAi(applied,applied),true);
  assert.equal(canUndoAi({...applied,metaTitle:"Manual edit"},applied),false);
});
