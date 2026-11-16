// Arena 231 -- shell models: ENT-09 breadcrumb from the hub map, ENT-09a stop stack. Pure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBreadcrumb, parentCrumb } from "./breadcrumb";
import { MAX_STOPS, pushStop, stopInboxHref, stopKicker, stopKey } from "./eventStops";
import type { ProgressionNotice } from "../game/progressionPresentation";
import type { CareerEvent } from "../../lib/career/careerEvents";

test("breadcrumb: hub landing is one crumb, a tab adds itself, a detail page names its object", () => {
  assert.deepEqual(buildBreadcrumb("/career"), [{ label: "Idag" }]);
  assert.deepEqual(buildBreadcrumb("/career/squad"), [{ label: "Laget" }]);
  assert.deepEqual(buildBreadcrumb("/career/tactics"), [{ label: "Laget", href: "/career/squad" }, { label: "Taktik" }]);
  const player = buildBreadcrumb("/career/squad/p-42", { player: (id) => (id === "p-42" ? "Lindqvist" : undefined) });
  assert.deepEqual(player, [{ label: "Laget", href: "/career/squad" }, { label: "Trupp", href: "/career/squad" }, { label: "Lindqvist" }]);
  assert.deepEqual(parentCrumb(player), { label: "Trupp", href: "/career/squad" });
  assert.equal(parentCrumb(buildBreadcrumb("/career/squad")), null);
  assert.deepEqual(buildBreadcrumb("/career/transfers/offers/o1").at(-1), { label: "Bud" });
  assert.deepEqual(buildBreadcrumb("/career/clubs/x", { club: () => "Önnered" }).at(-1), { label: "Önnered" });
  assert.deepEqual(buildBreadcrumb("/career/fixtures/f1").at(-1), { label: "Match" });
  for (const path of ["/career/inbox", "/career/finance", "/career/media/press/x", "/career/settings"]) {
    const crumbs = buildBreadcrumb(path);
    assert.ok(crumbs.length >= 1);
    assert.equal(crumbs.at(-1)!.href, undefined, `${path}: the current page is never a link`);
  }
});

test("event stops: typed kicker, inbox link from the event, de-duplicated stack capped at five", () => {
  const event = (id: string, type: CareerEvent["type"] = "PLAYER_INJURED") => ({ id, type }) as unknown as CareerEvent;
  const n = (title: string, kind: ProgressionNotice["kind"], e?: CareerEvent): ProgressionNotice => ({ title, detail: "", kind, navigateHref: "/career", actionHref: "/career", actionLabel: "Öppna →", event: e });
  assert.equal(stopKicker(n("a", "matchday", event("m", "MATCHDAY_READY"))), "Matchdag");
  assert.equal(stopKicker(n("a", "news", event("i"))), "Medicinskt");
  assert.equal(stopKicker(n("a", "decision", event("b", "BOARD_UPDATE"))), "Ditt beslut · Styrelsen");
  assert.equal(stopKicker(n("a", "calendar")), "Kalendern");
  assert.equal(stopInboxHref(n("a", "news", event("e1"))), `/career/inbox?message=${encodeURIComponent("msg:e1")}`);
  assert.equal(stopInboxHref(n("a", "calendar")), null);
  let stops: ProgressionNotice[] = [];
  for (let i = 0; i < 7; i++) stops = pushStop(stops, n(`t${i}`, "news", event(`e${i}`)));
  assert.equal(stops.length, MAX_STOPS);
  assert.equal(stops.at(-1)!.title, "t6");
  const again = pushStop(stops, n("t3 again", "news", event("e3")));
  assert.equal(again.length, MAX_STOPS);
  assert.equal(again.filter((s) => stopKey(s) === "event:e3").length, 1);
  assert.equal(again.at(-1)!.title, "t3 again");
});
