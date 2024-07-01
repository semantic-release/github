import test from "ava";
import isPrerelease from "../lib/is-prerelease.js";

test("Test for empty object", (t) => {
  const branch = {};
  t.is(isPrerelease(branch), false);
});

test("Test if prerelease true property as boolean is used correctly", (t) => {
  const branch = {
    prerelease: true,
  };
  t.is(isPrerelease(branch), true);
});

test("Test if prerelease false property as boolean is used correctly", (t) => {
  const branch = {
    prerelease: false,
  };
  t.is(isPrerelease(branch), false);
});

test("Test if prerelease property as string is used correctly", (t) => {
  const branch = {
    prerelease: "rc",
  };
  t.is(isPrerelease(branch), true);
});

test("Test if prerelease type is used correctly", (t) => {
  const branch = {
    type: "prerelease",
  };
  t.is(isPrerelease(branch), true);
});

test("Test if prerelease type and main is used correctly", (t) => {
  const branch = {
    type: "release",
    main: false,
  };
  t.is(isPrerelease(branch), true);
});

test("Test if prerelease type and main in addition to prerelease is used correctly", (t) => {
  const branch = {
    type: "release",
    main: false,
    prerelease: false,
  };
  t.is(isPrerelease(branch), false);
});
