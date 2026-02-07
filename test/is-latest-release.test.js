import test from "ava";
import isLatestRelease from "../lib/is-latest-release.js";

test("Test for empty object", (t) => {
  const branch = {};
  t.is(isLatestRelease(branch), "false");
});

test("Test if type release and main is used correctly", (t) => {
  const branch = {
    type: "release",
    main: true,
  };
  t.is(isLatestRelease(branch), "true");
});

test("Test if type prerelease is used correctly", (t) => {
  const branch = {
    type: "prerelease",
    main: true,
  };
  t.is(isLatestRelease(branch), "false");
});

test("Test if type main property as boolean is used correctly", (t) => {
  const branch = {
    type: "release",
    main: false,
  };
  t.is(isLatestRelease(branch), "false");
});

test("Test maintenance branch returns false", (t) => {
  const branch = {
    type: "maintenance",
    main: false,
  };
  t.is(isLatestRelease(branch), "false");
});
