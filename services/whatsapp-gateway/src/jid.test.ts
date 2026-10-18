import assert from "node:assert/strict";
import { test } from "node:test";

import { extractContent, humanDelayMs, jidFromPhone, phoneFromKey } from "./jid.js";

test("phoneFromKey", () => {
  assert.equal(phoneFromKey({ remoteJid: "393331234567@s.whatsapp.net" }), "+393331234567");
  assert.equal(phoneFromKey({ remoteJid: "1234@lid", remoteJidAlt: "393331234567@s.whatsapp.net" }), "+393331234567");
  assert.equal(phoneFromKey({ remoteJid: "1234@lid" }), "lid:1234");
  assert.equal(phoneFromKey({ remoteJid: "123-456@g.us" }), null);
  assert.equal(phoneFromKey({ remoteJid: "status@broadcast" }), null);
});

test("jidFromPhone", () => {
  assert.equal(jidFromPhone("+39 333 1234567"), "393331234567@s.whatsapp.net");
  assert.equal(jidFromPhone("lid:1234"), "1234@lid");
});

test("extractContent", () => {
  assert.deepEqual(extractContent({ conversation: "ciao" }), { text: "ciao", mediaType: null });
  assert.deepEqual(extractContent({ extendedTextMessage: { text: "ok" } }), { text: "ok", mediaType: null });
  assert.deepEqual(extractContent({ audioMessage: { mimetype: "audio/ogg; codecs=opus" } }), { text: "", mediaType: "audio/ogg" });
  assert.deepEqual(extractContent({ ephemeralMessage: { message: { conversation: "x" } } }), { text: "x", mediaType: null });
  assert.equal(extractContent({ reactionMessage: {} }).mediaType, "ignore");
});

test("humanDelayMs", () => {
  assert.equal(humanDelayMs("ciao", () => 0), 700);
  assert.ok(humanDelayMs("x".repeat(1000), () => 1) <= 5500);
});
