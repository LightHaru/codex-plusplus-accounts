function emailFromAuthString(raw) {
  try {
    return emailFromAuth(JSON.parse(raw));
  } catch {
    return null;
  }
}

function emailFromAuth(auth) {
  return profileFromAuth(auth).email || null;
}

function profileFromAuthString(raw) {
  try {
    return profileFromAuth(JSON.parse(raw));
  } catch {
    return {};
  }
}

function profileFromAuth(auth) {
  const direct = auth?.email || auth?.user?.email || auth?.account?.email;
  const profile = {};
  if (typeof direct === "string" && direct.includes("@")) profile.email = direct;

  const idToken = auth?.tokens?.id_token;
  if (typeof idToken !== "string") {
    if (typeof direct === "string" && direct.includes("@")) profile.email = direct;
    return profile;
  }
  const [, payload] = idToken.split(".");
  if (!payload) return profile;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const authClaims = claims["https://api.openai.com/auth"];
    if (typeof claims.email === "string" && claims.email.includes("@")) {
      profile.email = claims.email;
    } else if (typeof direct === "string" && direct.includes("@")) {
      profile.email = direct;
    }
    if (typeof claims.name === "string" && claims.name.trim()) profile.name = claims.name.trim();
    if (typeof authClaims?.chatgpt_plan_type === "string") {
      profile.plan = authClaims.chatgpt_plan_type;
    }
    const defaultOrganization = Array.isArray(authClaims?.organizations)
      ? authClaims.organizations.find((organization) => organization?.is_default)
      : null;
    if (typeof defaultOrganization?.title === "string") {
      profile.organization = defaultOrganization.title;
    }
    return profile;
  } catch {
    return profile;
  }
}

module.exports = { emailFromAuthString, emailFromAuth, profileFromAuthString, profileFromAuth };
