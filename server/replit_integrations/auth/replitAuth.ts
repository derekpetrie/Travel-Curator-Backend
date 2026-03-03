import type { Express, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

export type AuthenticatedUser = {
sub: string;
email?: string;
[key: string]: unknown;
};

declare global {
namespace Express {
interface User {
claims?: AuthenticatedUser;
}
}
}

function getAuthConfig() {
const domain = process.env.AUTH0_DOMAIN;
const audience = process.env.AUTH0_AUDIENCE;

if (!domain || !audience) {
throw new Error("Missing AUTH0_DOMAIN or AUTH0_AUDIENCE");
}

const issuer = `https://${domain}/`;
return { domain, audience, issuer };
}

let jwks: jwksClient.JwksClient | null = null;

function getJwksClient() {
if (jwks) return jwks;
const { domain } = getAuthConfig();
jwks = jwksClient({
jwksUri: `https://${domain}/.well-known/jwks.json`,
cache: true,
cacheMaxEntries: 5,
cacheMaxAge: 10 * 60 * 1000,
rateLimit: true,
jwksRequestsPerMinute: 10,
});
return jwks;
}

async function verifyBearerToken(token: string): Promise<AuthenticatedUser> {
const { audience, issuer } = getAuthConfig();
const decoded = jwt.decode(token, { complete: true }) as { header?: { kid?: string } } | null;

if (!decoded?.header?.kid) {
throw new Error("Invalid token header");
}

const key = await getJwksClient().getSigningKey(decoded.header.kid);
const signingKey = key.getPublicKey();

const claims = jwt.verify(token, signingKey, {
algorithms: ["RS256"],
audience,
issuer,
}) as AuthenticatedUser;

return claims;
}

export function getSession() {
return (_req: any, _res: any, next: any) => next();
}

export async function setupAuth(_app: Express) {
// Auth0 JWT bearer auth does not require session middleware by default.
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
try {
const authHeader = req.headers.authorization as string | undefined;
if (!authHeader?.startsWith("Bearer ")) {
return res.status(401).json({ message: "Unauthorized" });
}

const token = authHeader.slice("Bearer ".length).trim();
const claims = await verifyBearerToken(token);

req.user = { claims };
return next();
} catch (_error) {
return res.status(401).json({ message: "Unauthorized" });
}
};
