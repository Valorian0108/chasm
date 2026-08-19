import { describe, expect, it } from "vitest";
import { reducer } from "./use-toast";

type State = Parameters<typeof reducer>[0];

const toast = (id: string) => ({ id, title: `Toast ${id}`, open: true });

describe("toast reducer", () => {
  it("adds a toast and keeps only the newest one", () => {
    const withFirst = reducer(
      { toasts: [] },
      { type: "ADD_TOAST", toast: toast("1") },
    );
    const withSecond = reducer(withFirst, {
      type: "ADD_TOAST",
      toast: toast("2"),
    });

    expect(withFirst.toasts).toHaveLength(1);
    expect(withSecond.toasts).toHaveLength(1);
    expect(withSecond.toasts[0].id).toBe("2");
  });

  it("updates only the matching toast", () => {
    const state: State = { toasts: [toast("1")] };

    const updated = reducer(state, {
      type: "UPDATE_TOAST",
      toast: { id: "1", title: "Updated" },
    });
    const untouched = reducer(state, {
      type: "UPDATE_TOAST",
      toast: { id: "missing", title: "Updated" },
    });

    expect(updated.toasts[0].title).toBe("Updated");
    expect(untouched.toasts[0].title).toBe("Toast 1");
  });

  it("closes a single toast on dismiss", () => {
    const state: State = { toasts: [toast("1"), toast("2")] };

    const dismissed = reducer(state, { type: "DISMISS_TOAST", toastId: "1" });

    expect(dismissed.toasts.map((item) => item.open)).toEqual([false, true]);
  });

  it("closes every toast when no id is given", () => {
    const state: State = { toasts: [toast("1"), toast("2")] };

    const dismissed = reducer(state, { type: "DISMISS_TOAST" });

    expect(dismissed.toasts.every((item) => item.open === false)).toBe(true);
  });

  it("removes one toast by id and all toasts without an id", () => {
    const state: State = { toasts: [toast("1"), toast("2")] };

    expect(
      reducer(state, { type: "REMOVE_TOAST", toastId: "1" }).toasts.map(
        (item) => item.id,
      ),
    ).toEqual(["2"]);
    expect(reducer(state, { type: "REMOVE_TOAST" }).toasts).toEqual([]);
  });
});
