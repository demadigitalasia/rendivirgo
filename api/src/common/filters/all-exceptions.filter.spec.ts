import assert from "node:assert/strict";
import { BadRequestException, HttpStatus } from "@nestjs/common";
import { describe, it } from "node:test";
import { Prisma } from "../../../generated/prisma";
import { AllExceptionsFilter } from "./all-exceptions.filter";

type CapturedResponse = {
  statusCode: number;
  body: { statusCode: number; error: string; message: string | string[] };
  status(code: number): CapturedResponse;
  json(payload: CapturedResponse["body"]): CapturedResponse;
};

function buildHost() {
  const response: CapturedResponse = {
    statusCode: 0,
    body: { statusCode: 0, error: "", message: "" },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  const request = { method: "POST", url: "/api/test" };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };
  return { host: host as never, response };
}

const prismaError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("DB error", { code, clientVersion: "test", meta });

describe("AllExceptionsFilter", () => {
  it("maps a Prisma unique-constraint error to 409 with the field name", () => {
    const filter = new AllExceptionsFilter();
    const { host, response } = buildHost();
    filter.catch(prismaError("P2002", { target: ["sku"] }), host);
    assert.equal(response.statusCode, HttpStatus.CONFLICT);
    assert.match(String(response.body.message), /sku/);
  });

  it("maps Prisma not-found to 404", () => {
    const filter = new AllExceptionsFilter();
    const { host, response } = buildHost();
    filter.catch(prismaError("P2025"), host);
    assert.equal(response.statusCode, HttpStatus.NOT_FOUND);
  });

  it("maps Prisma foreign-key conflicts to 409", () => {
    const filter = new AllExceptionsFilter();
    const { host, response } = buildHost();
    filter.catch(prismaError("P2003"), host);
    assert.equal(response.statusCode, HttpStatus.CONFLICT);
  });

  it("passes HttpExceptions through with their own status and message", () => {
    const filter = new AllExceptionsFilter();
    const { host, response } = buildHost();
    filter.catch(new BadRequestException("Bad input"), host);
    assert.equal(response.statusCode, HttpStatus.BAD_REQUEST);
    assert.equal(response.body.message, "Bad input");
  });

  it("returns 500 for unknown errors without leaking details", () => {
    const filter = new AllExceptionsFilter();
    const { host, response } = buildHost();
    filter.catch(new Error("secret stack detail"), host);
    assert.equal(response.statusCode, HttpStatus.INTERNAL_SERVER_ERROR);
    assert.equal(response.body.message, "Internal server error");
  });
});
