// Firestore rules tests for Amed Cafe. Run against the local emulator (nothing touches the real database):
//   npm i -D firebase-tools @firebase/rules-unit-testing firebase
//   npx firebase emulators:exec --only firestore --project demo-amed "node --test tests/firestore.rules.test.mjs"
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, limit, serverTimestamp } from "firebase/firestore";

const KEY = "0123456789abcdef0123456789abcdef";
const GIFT = "ABCDEFGHJKMNPQRS";
const card = (o = {}) => ({ fn: "Sara", code: "RWB535", v: 3, yv: { 2026: 3 }, lv: 1794071518158, p: { drinks: [3, 0, 0, 3, 0] }, u: 1794071518158, ...o });
const meta = (o = {}) => ({ updated: 1, cafe: "Amed Cafe", countryCode: "964", staffLink: "https://amedcaferest.com/staff/", expiryDays: 60,
  programs: [{ id: "drinks", target: 7 }], showPerks: false, levels: [], rules: {}, offers: [], events: [], contact: { wa: "964750", join: false }, ...o });

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-amed", firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8080 } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    await setDoc(doc(d, "cards/" + KEY), card());
    await setDoc(doc(d, "public/meta"), meta());
    await setDoc(doc(d, "customers/07501112222"), { name: "Sara K", pin: "1234", code: "RWB535", visits: 3, cards: {}, log: [] });
    await setDoc(doc(d, "invites/AMED-ABCDEFGH"), { name: "Ali", revoked: false, perms: { stamp: true }, pinHash: "x" });
    await setDoc(doc(d, "invites/AMED-OLDX"), { name: "Old", revoked: true });
    await setDoc(doc(d, "staffclaims/legacy1"), { uid: "legacy1", code: "AMED-ABCDEFGH", name: "Ali", t: 1 });
    await setDoc(doc(d, "staff/staff1"), { name: "Rawa", active: true, role: "staff" });
    await setDoc(doc(d, "settings/card"), { programs: [] });
    await setDoc(doc(d, "private/owner"), { ok: true });
    await setDoc(doc(d, "gifts/" + GIFT), { status: "active", schema: 1, items: [{ name: "Latte", qty: 1 }], from: "A" });
    await setDoc(doc(d, "reports/amed-13653d65c4d1ffb3da62d21cf7d6dc16"), { text: "summary" });
  });
});
const anon = () => env.unauthenticatedContext().firestore();
const owner = () => env.authenticatedContext("ownerUid", { email: "amedcaferest@gmail.com", email_verified: true }).firestore();
const staff = () => env.authenticatedContext("staff1", { email: "rawa@example.com", email_verified: true }).firestore();
const legacy = () => env.authenticatedContext("legacy1", { email: "ali@example.com", email_verified: true }).firestore();
const stranger = () => env.authenticatedContext("evil", { email: "evil@example.com", email_verified: true }).firestore();
const fakeOwner = () => env.authenticatedContext("evil2", { email: "amedcaferest@gmail.com", email_verified: false }).firestore();

// ---- customers (no sign-in) ----
test("anyone can get one card by its exact key", () => assertSucceeds(getDoc(doc(anon(), "cards/" + KEY))));
test("a missing card key reads as not found (not an error)", () => assertSucceeds(getDoc(doc(anon(), "cards/ffffffffffffffffffffffffffffffff"))));
test("malformed card ids are refused", () => assertFails(getDoc(doc(anon(), "cards/RWB535"))));
test("nobody unauthenticated can list cards", () => assertFails(getDocs(collection(anon(), "cards"))));
test("signed-in strangers can't list cards", () => assertFails(getDocs(query(collection(stranger(), "cards"), limit(1)))));
test("anonymous users can't write cards", () => assertFails(setDoc(doc(anon(), "cards/" + KEY), card({ v: 999 }))));
test("public/meta is readable by everyone", () => assertSucceeds(getDoc(doc(anon(), "public/meta"))));
test("public/meta is not writable by strangers", () => assertFails(setDoc(doc(stranger(), "public/meta"), meta())));
test("gift page can get one gift", () => assertSucceeds(getDoc(doc(anon(), "gifts/" + GIFT))));
test("gifts can't be listed anonymously", () => assertFails(getDocs(collection(anon(), "gifts"))));
test("nightly summary report can be fetched by id", () => assertSucceeds(getDoc(doc(anon(), "reports/amed-13653d65c4d1ffb3da62d21cf7d6dc16"))));
test("reports can't be listed", () => assertFails(getDocs(collection(anon(), "reports"))));
test("customers (phones + PINs) are never readable without staff", async () => {
  await assertFails(getDoc(doc(anon(), "customers/07501112222")));
  await assertFails(getDocs(collection(stranger(), "customers")));
});
test("settings, invites list, activity and private are closed to strangers", async () => {
  await assertFails(getDoc(doc(stranger(), "settings/card")));
  await assertFails(getDocs(collection(stranger(), "invites")));
  await assertFails(getDocs(collection(stranger(), "activity")));
  await assertFails(getDoc(doc(stranger(), "private/owner")));
});
test("unverified e-mail claiming the owner address is not the owner", () => assertFails(getDoc(doc(fakeOwner(), "private/owner"))));
test("unknown collections are denied", () => assertFails(getDoc(doc(owner(), "secrets/x"))));

// ---- staff ----
test("owner reads private/owner (ownerCheck)", () => assertSucceeds(getDoc(doc(owner(), "private/owner"))));
test("staff (staff/{uid}) can't read private/owner", () => assertFails(getDoc(doc(staff(), "private/owner"))));
test("staff/{uid} members read customers", () => assertSucceeds(getDocs(collection(staff(), "customers"))));
test("legacy claim staff read customers", () => assertSucceeds(getDocs(collection(legacy(), "customers"))));
test("staff add a stamp (customer + card mirror)", async () => {
  await assertSucceeds(updateDoc(doc(staff(), "customers/07501112222"), { visits: 4 }));
  await assertSucceeds(setDoc(doc(staff(), "cards/" + KEY), card({ v: 4, p: { drinks: [4, 0, 0, 4, 0] } })));
});
test("staff can't inflate points in one write", async () => {
  await assertFails(updateDoc(doc(staff(), "customers/07501112222"), { visits: 500 }));
  await assertFails(setDoc(doc(staff(), "cards/" + KEY), card({ v: 500 })));
  await assertFails(setDoc(doc(staff(), "cards/" + KEY), card({ p: { drinks: [3, 0, 0, 5000, 0] } })));
});
test("negative / non-integer stamps are refused", async () => {
  await assertFails(setDoc(doc(staff(), "cards/" + KEY), card({ p: { drinks: [-1, 0, 0, 3, 0] } })));
  await assertFails(setDoc(doc(staff(), "cards/" + KEY), card({ p: { drinks: [1.5, 0, 0, 3, 0] } })));
  await assertFails(setDoc(doc(staff(), "cards/" + KEY), card({ v: -3 })));
  await assertFails(setDoc(doc(staff(), "cards/" + KEY), card({ admin: true })));
});
test("bad PIN shapes are refused on members", () => assertFails(updateDoc(doc(staff(), "customers/07501112222"), { pin: "12" })));
test("owner can correct larger numbers", () => assertSucceeds(updateDoc(doc(owner(), "customers/07501112222"), { visits: 400 })));
test("staff can't change settings; owner can", async () => {
  await assertFails(setDoc(doc(staff(), "settings/card"), { programs: [] }));
  await assertSucceeds(setDoc(doc(owner(), "settings/card"), { programs: [] }));
});
test("owner publishes public/meta; extra fields and foreign staff links refused", async () => {
  await assertSucceeds(setDoc(doc(owner(), "public/meta"), meta()));
  await assertFails(setDoc(doc(owner(), "public/meta"), meta({ cards: { [KEY]: card() } })));
  await assertFails(setDoc(doc(owner(), "public/meta"), meta({ staffLink: "https://claude.ai/artifact/x" })));
});
test("staff/{uid} is self-read only and never client-writable", async () => {
  await assertSucceeds(getDoc(doc(staff(), "staff/staff1")));
  await assertFails(getDoc(doc(stranger(), "staff/staff1")));
  await assertFails(setDoc(doc(stranger(), "staff/evil"), { role: "owner" }));
  await assertFails(setDoc(doc(owner(), "staff/evil"), { role: "owner" }));
});

// ---- legacy join codes ----
test("a signed-in user can claim an active join code for themselves", async () => {
  await assertSucceeds(getDoc(doc(stranger(), "invites/AMED-ABCDEFGH")));
  await assertSucceeds(setDoc(doc(stranger(), "staffclaims/evil"), { uid: "evil", code: "AMED-ABCDEFGH", name: "x", t: 1 }));
});
test("revoked or unknown codes can't be claimed, nor claims made for others", async () => {
  await assertFails(setDoc(doc(stranger(), "staffclaims/evil"), { uid: "evil", code: "AMED-OLDX", t: 1 }));
  await assertFails(setDoc(doc(stranger(), "staffclaims/evil"), { uid: "evil", code: "AMED-NOPE1234", t: 1 }));
  await assertFails(setDoc(doc(stranger(), "staffclaims/legacy1"), { uid: "legacy1", code: "AMED-ABCDEFGH", t: 1 }));
});
test("a revoked code stops being staff", async () => {
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), "invites/AMED-ABCDEFGH"), { revoked: true }));
  await assertFails(getDocs(collection(legacy(), "customers")));
});
test("only the owner writes invites", async () => {
  await assertFails(setDoc(doc(staff(), "invites/AMED-ZZZZZZZZ"), { name: "me", revoked: false }));
  await assertSucceeds(setDoc(doc(owner(), "invites/AMED-ZZZZZZZZ"), { name: "me", revoked: false }));
});

// ---- gifts ----
test("staff create, then redeem a gift once", async () => {
  const code = "ZZZZZZZZZZZZZZZZ";
  await assertSucceeds(setDoc(doc(staff(), "gifts/" + code), { items: [{ name: "Latte", qty: 1 }], occasion: "birthday", occasionText: "", from: "A", to: "B", message: "", lang: "en", createdBy: "x", createdByName: "x", status: "active", schema: 1, createdAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(staff(), "gifts/" + code), { status: "redeemed", redeemedAt: serverTimestamp(), redeemedBy: "x", redeemedByName: "x" }));
  await assertFails(updateDoc(doc(staff(), "gifts/" + code), { status: "active" }));
});
test("strangers can't create or redeem gifts", async () => {
  await assertFails(updateDoc(doc(stranger(), "gifts/" + GIFT), { status: "redeemed", redeemedAt: serverTimestamp(), redeemedBy: "x", redeemedByName: "x" }));
  await assertFails(deleteDoc(doc(stranger(), "gifts/" + GIFT)));
});
