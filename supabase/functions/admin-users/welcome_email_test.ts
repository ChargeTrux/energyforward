import { assert, assertFalse } from "jsr:@std/assert@1";
import { welcomeEmail } from "../_shared/branded-emails.ts";

const base = { name: "Test", email: "t@example.com", tempPassword: "abcd-efgh-ijkl" };

Deno.test("investor-only invite lists no material sections", () => {
  const { html } = welcomeEmail({ ...base, portals: ["Investor"] });
  assertFalse(html.includes("Videos</strong>"));
  assertFalse(html.includes("Project 3D Demo</strong>"));
  assertFalse(html.includes("Documents (Data Room)"));
  assert(html.includes("Investor Portal"));
});

Deno.test("only granted sections are listed", () => {
  const { html } = welcomeEmail({ ...base, portals: ["Investor", "Video"], investorProfiles: [{ name: "Profile A" }] });
  assert(html.includes("Videos</strong>"));
  assert(html.includes("Profile A"));
  assertFalse(html.includes("Project 3D Demo</strong>"));
});
