import { prisma } from "@/lib/prisma";

const RESTRICTED_ROLES = ["OFFICER", "CHECKER"] as const;

/**
 * Get current user from X-Session-Token for OFFICER/CHECKER.
 * Looks up UserSession by token; returns user if valid session exists and user is active.
 */
export async function getRestrictedSessionUser(req: Request): Promise<{
  id: string;
  fullName: string;
  phone: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
} | null> {
  const token = req.headers.get("X-Session-Token")?.trim();
  if (!token) return null;
  const session = await prisma.userSession.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
        },
      },
    },
  });
  const user = session?.user;
  return user && user.isActive && RESTRICTED_ROLES.includes(user.role as (typeof RESTRICTED_ROLES)[number])
    ? user
    : null;
}

/**
 * Resolve requester for APIs used by officer/checker.
 * For OFFICER/CHECKER, requires valid X-Session-Token and returns that user.
 * Otherwise uses requesterId and loads from DB (for ADMIN/SUPER_ADMIN).
 */
export async function getRequesterForRestrictedApi(
  req: Request,
  requesterIdFromBody: string
): Promise<{ id: string; role: string } | null> {
  const sessionUser = await getRestrictedSessionUser(req);
  if (sessionUser) return { id: sessionUser.id, role: sessionUser.role };
  const user = await prisma.user.findUnique({
    where: { id: requesterIdFromBody },
    select: { id: true, role: true },
  });
  if (!user) return null;
  if (isRestrictedRole(user.role)) return null; // officer/checker must use session
  return user;
}

export function isRestrictedRole(role: string): boolean {
  return RESTRICTED_ROLES.includes(role as (typeof RESTRICTED_ROLES)[number]);
}
