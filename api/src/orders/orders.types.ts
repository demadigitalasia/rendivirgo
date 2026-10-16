import { Prisma } from "../../generated/prisma";

export const orderInclude = {
  items: true,
  customer: true,
  discount: true,
  events: { orderBy: { createdAt: "desc" as const } },
  returnRequests: {
    orderBy: { submittedAt: "desc" as const },
    include: { reviewedBy: { select: { id: true, name: true } } },
  },
} satisfies Prisma.OrderInclude;

export const orderListInclude = {
  items: true,
  customer: true,
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
export type OrderListRow = Prisma.OrderGetPayload<{ include: typeof orderListInclude }>;
export type OrderScalars = Prisma.OrderGetPayload<Record<never, never>>;
