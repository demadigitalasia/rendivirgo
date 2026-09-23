import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Prisma } from "../../../generated/prisma";

function isDecimal(value: unknown): value is Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return true;
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { d?: unknown; e?: unknown; s?: unknown; toNumber?: unknown };
  return Array.isArray(candidate.d) && typeof candidate.e === "number" && typeof candidate.s === "number" && typeof candidate.toNumber === "function";
}

export function serializeDecimals(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (isDecimal(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(serializeDecimals);
  if (value instanceof Date || value instanceof Buffer || value instanceof Uint8Array) return value;
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = serializeDecimals(entry);
    }
    return output;
  }
  return value;
}

@Injectable()
export class DecimalSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeDecimals(data)));
  }
}
