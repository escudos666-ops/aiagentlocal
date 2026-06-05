import { headers } from "next/headers";
import AssistantClient from "./assistant-client";

function getDisplayName(
  email: string | null,
  encodedFullName: string | null,
  encoding: string | null
) {
  if (encodedFullName && encoding === "percent-encoded-utf-8") {
    try {
      return decodeURIComponent(encodedFullName);
    } catch {
      return email ?? "there";
    }
  }

  if (email) {
    return email.split("@")[0] ?? email;
  }

  return "there";
}

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const displayName = getDisplayName(
    email,
    requestHeaders.get("oai-authenticated-user-full-name"),
    requestHeaders.get("oai-authenticated-user-full-name-encoding")
  );

  return <AssistantClient displayName={displayName} email={email} />;
}
