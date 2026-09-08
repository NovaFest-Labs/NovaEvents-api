import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { validateEventId } from "./validateEventId";

function fakeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function fakeReq(id: string): Request {
  return { params: { id } } as unknown as Request;
}

describe("validateEventId", () => {
  it("calls next() for a plain zero", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeRes();
    validateEventId(fakeReq("0"), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it("calls next() for a positive decimal integer", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeRes();
    validateEventId(fakeReq("42"), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects hex notation (0x1) with 400", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeRes();
    validateEventId(fakeReq("0x1"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it("rejects exponential notation (1e2) with 400", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeRes();
    validateEventId(fakeReq("1e2"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it("rejects a float (1.5) with 400", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeRes();
    validateEventId(fakeReq("1.5"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it("rejects a negative number (-1) with 400", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeRes();
    validateEventId(fakeReq("-1"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it("rejects an empty string with 400", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeRes();
    validateEventId(fakeReq(""), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it("rejects an arbitrary string with 400", () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeRes();
    validateEventId(fakeReq("abc"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });
});
