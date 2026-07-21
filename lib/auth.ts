import { ConfidentialClientApplication, Configuration } from "@azure/msal-node";

let cachedCca: ConfidentialClientApplication | undefined;

// Built lazily so importing this module (e.g. during `next build`'s page-data
// collection) never requires AZURE_* secrets to be set.
export function getCca(): ConfidentialClientApplication {
  if (!cachedCca) {
    const config: Configuration = {
      auth: {
        clientId: process.env.AZURE_CLIENT_ID as string,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET as string,
      },
    };
    cachedCca = new ConfidentialClientApplication(config);
  }
  return cachedCca;
}

// Delegated scopes: acts as the signed-in user, limited to their own calendar.
export const SCOPES = [
  "Calendars.ReadWrite",
  "offline_access",
  "openid",
  "profile",
];

export const REDIRECT_URI = process.env.AZURE_REDIRECT_URI as string;
